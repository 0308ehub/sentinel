/**
 * Sentinel Autonomous PM Service
 *
 * Queues, reviews, and executes PM actions autonomously.
 * Human approval gates are enforced unless autoApprove is configured.
 */

import { prisma } from "@/lib/db/prisma";
import type { SentinelActionType } from "@prisma/client";

// ─── Queue an action for review ──────────────────────────────────────────────

export async function queueAction(params: {
  workspaceId: string;
  type: SentinelActionType;
  title: string;
  description: string;
  payload: Record<string, unknown>;
  triggeredBy?: string;
  autoApprove?: boolean;
}) {
  const { workspaceId, type, title, description, payload, triggeredBy = "system", autoApprove = false } = params;

  // Deduplicate: don't queue the same type twice if already pending
  const existing = await prisma.sentinelAction.findFirst({
    where: { workspaceId, type, status: "PENDING_REVIEW" },
  });
  if (existing) return existing;

  const action = await prisma.sentinelAction.create({
    data: {
      id: `sa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      workspaceId,
      type,
      title,
      description,
      payload: payload as never,
      triggeredBy,
      status: autoApprove ? "APPROVED" : "PENDING_REVIEW",
    },
  });

  if (autoApprove) {
    executeAction(action.id).catch((err) =>
      console.error(`[sentinel-pm] Auto-execute ${action.id} failed:`, err)
    );
  }

  return action;
}

// ─── Approve and execute ──────────────────────────────────────────────────────

export async function approveAndExecute(actionId: string) {
  await prisma.sentinelAction.update({
    where: { id: actionId },
    data: { status: "APPROVED", reviewedAt: new Date() },
  });
  return executeAction(actionId);
}

export async function rejectAction(actionId: string) {
  return prisma.sentinelAction.update({
    where: { id: actionId },
    data: { status: "REJECTED", reviewedAt: new Date() },
  });
}

// ─── Execute an approved action ───────────────────────────────────────────────

export async function executeAction(actionId: string) {
  const action = await prisma.sentinelAction.findUniqueOrThrow({ where: { id: actionId } });

  await prisma.sentinelAction.update({
    where: { id: actionId },
    data: { status: "EXECUTING", executedAt: new Date() },
  });

  try {
    let result: Record<string, unknown> = {};

    switch (action.type) {
      case "SYNTHESIZE_WORKSPACE": {
        const { synthesizeWorkspace } = await import("./synthesis-service");
        const r = await synthesizeWorkspace(action.workspaceId);
        result = { painPoints: r.painPoints.length, opportunities: r.opportunities.length };

        // Queue ticket generation if opportunities found
        if (r.opportunities.length > 0) {
          const topOpp = r.opportunities.sort((a, b) => b.totalScore - a.totalScore)[0];
          await queueAction({
            workspaceId: action.workspaceId,
            type: "GENERATE_TICKETS",
            title: `Generate tickets for "${topOpp.title}"`,
            description: `${r.opportunities.length} new opportunities found. Generate engineering tickets for the top opportunity (score: ${topOpp.totalScore.toFixed(0)}).`,
            payload: { opportunityId: topOpp.id, allOpportunityIds: r.opportunities.map((o) => o.id) },
            triggeredBy: "auto-post-synthesis",
          });
        }
        break;
      }

      case "GENERATE_TICKETS": {
        const { generateEngineeringTickets } = await import("./ticket-service");
        const payload = action.payload as Record<string, unknown>;
        const opportunityId = payload.opportunityId as string | undefined;
        const prdId = payload.prdId as string | undefined;

        const r = await generateEngineeringTickets({ workspaceId: action.workspaceId, opportunityId, prdId });
        result = { ticketCount: r.tickets.length, epic: r.epic.title };

        // Queue Linear push if connector available
        const linear = await prisma.connector.findFirst({
          where: { workspaceId: action.workspaceId, type: "LINEAR", status: "ACTIVE" },
        });
        if (linear && r.tickets.length > 0) {
          await queueAction({
            workspaceId: action.workspaceId,
            type: "PUSH_TO_LINEAR",
            title: `Push ${r.tickets.length} tickets to Linear`,
            description: `${r.tickets.length} engineering tickets are ready. Export them to your Linear workspace.`,
            payload: { ticketIds: r.tickets.map((t) => t.id) },
            triggeredBy: "auto-post-ticket-gen",
          });
        }
        break;
      }

      case "PUSH_TO_LINEAR": {
        const { createLinearIssue } = await import("./connectors/linear");
        const connector = await prisma.connector.findFirst({
          where: { workspaceId: action.workspaceId, type: "LINEAR", status: "ACTIVE" },
        });
        if (!connector) throw new Error("No active Linear connector");

        const payload = action.payload as { ticketIds: string[] };
        const { LinearConfig } = await import("./connectors/types") as never as { LinearConfig: never };
        const config = connector.config as unknown as import("./connectors/types").LinearConfig;

        let pushed = 0;
        for (const ticketId of payload.ticketIds) {
          const ticket = await prisma.engineeringTicket.findUnique({ where: { id: ticketId } });
          if (!ticket || ticket.externalLinearId) continue;
          try {
            const issue = await createLinearIssue(config, {
              title: ticket.title,
              description: ticket.description,
              priority: ticket.priority,
            });
            await prisma.engineeringTicket.update({
              where: { id: ticketId },
              data: { externalLinearId: issue.id, externalLinearUrl: issue.url },
            });
            pushed++;
          } catch { /* skip individual failures */ }
        }
        result = { pushed };
        break;
      }

      case "SYNC_LINEAR_STATUS": {
        const { syncLinear } = await import("./connectors/linear");
        const connectors = await prisma.connector.findMany({
          where: { workspaceId: action.workspaceId, type: "LINEAR", status: "ACTIVE" },
        });

        let synced = 0;
        for (const connector of connectors) {
          const config = connector.config as unknown as import("./connectors/types").LinearConfig;
          const issues = await syncLinear(config);

          // Update ticket statuses that match linear issue IDs
          for (const issue of issues) {
            const ticket = await prisma.engineeringTicket.findFirst({
              where: { workspaceId: action.workspaceId, externalLinearId: issue.externalId },
            });
            if (!ticket) continue;

            // Map Linear status to our TicketStatus
            const linearStatus = (issue.metadata?.state ?? "").toLowerCase();
            let ticketStatus: "BACKLOG" | "IN_SPRINT" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" = "BACKLOG";
            if (linearStatus.includes("progress") || linearStatus.includes("started")) ticketStatus = "IN_PROGRESS";
            else if (linearStatus.includes("review")) ticketStatus = "IN_REVIEW";
            else if (linearStatus.includes("done") || linearStatus.includes("complete")) ticketStatus = "DONE";
            else if (linearStatus.includes("backlog")) ticketStatus = "BACKLOG";
            else if (linearStatus.includes("todo") || linearStatus.includes("sprint")) ticketStatus = "IN_SPRINT";

            if (ticket.status !== ticketStatus) {
              await prisma.engineeringTicket.update({ where: { id: ticket.id }, data: { status: ticketStatus } });
              synced++;
            }
          }
        }
        result = { synced };
        break;
      }

      case "IMPORT_DOCUMENTS": {
        const payload = action.payload as { connectorId: string; externalIds: string[] };
        const connector = await prisma.connector.findUnique({ where: { id: payload.connectorId } });
        if (!connector) throw new Error("Connector not found");

        const { requireUser } = await import("@/lib/auth/helpers");
        let userId: string;
        try {
          const user = await requireUser();
          userId = user.id;
        } catch {
          // Cron context — find first workspace member
          const member = await prisma.membership.findFirst({
            where: { organization: { workspaces: { some: { id: action.workspaceId } } } },
            include: { user: true },
          });
          if (!member) throw new Error("No workspace member found");
          userId = member.userId;
        }

        let imported = 0;
        if (connector.type === "GMAIL") {
          const { syncGmailById } = await import("./connectors/gmail");
          const config = connector.config as unknown as import("./connectors/types").GmailConfig;
          const docs = await syncGmailById(config, payload.externalIds);

          for (const doc of docs) {
            const exists = await prisma.document.findFirst({
              where: { workspaceId: action.workspaceId, externalId: doc.externalId },
            });
            if (exists) continue;

            const document = await prisma.document.create({
              data: {
                id: `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
                workspaceId: action.workspaceId,
                uploadedById: userId,
                title: doc.title,
                rawText: doc.text,
                sourceType: "EMAIL",
                status: "PENDING",
                connectorId: connector.id,
                externalId: doc.externalId,
                metadata: doc.metadata ?? {},
              },
            });

            const { dispatchIngestion } = await import("@/server/jobs/dispatch");
            dispatchIngestion(document.id).catch(() => {});
            imported++;
          }
        }

        result = { imported };

        // Queue synthesis after import
        if (imported > 0) {
          await queueAction({
            workspaceId: action.workspaceId,
            type: "SYNTHESIZE_WORKSPACE",
            title: "Re-synthesize workspace",
            description: `${imported} new documents were imported. Re-run synthesis to extract new pain points and update opportunities.`,
            payload: {},
            triggeredBy: "auto-post-import",
          });
        }
        break;
      }

      case "GENERATE_DIGEST": {
        const { generateWorkspaceDigest } = await import("./digest-service");
        result = await generateWorkspaceDigest(action.workspaceId);
        break;
      }

      case "SCAN_CONNECTOR": {
        result = await scanAllConnectors(action.workspaceId);
        break;
      }
    }

    await prisma.sentinelAction.update({
      where: { id: actionId },
      data: { status: "COMPLETED", result: result as never },
    });

    return { success: true, result };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.sentinelAction.update({
      where: { id: actionId },
      data: { status: "FAILED", result: { error: msg } as never },
    });
    throw err;
  }
}

// ─── Scan connectors for new content ─────────────────────────────────────────

export async function scanAllConnectors(workspaceId: string) {
  const connectors = await prisma.connector.findMany({
    where: { workspaceId, status: "ACTIVE" },
  });

  let totalCandidates = 0;

  for (const connector of connectors) {
    try {
      if (connector.type === "GMAIL") {
        const { scanGmail } = await import("./connectors/gmail");
        const config = connector.config as unknown as import("./connectors/types").GmailConfig;
        const candidates = await scanGmail(config, 50);

        // Filter out already imported
        const alreadyImported = await prisma.document.findMany({
          where: { workspaceId, connectorId: connector.id },
          select: { externalId: true },
        });
        const importedIds = new Set(alreadyImported.map((d) => d.externalId));
        const newCandidates = candidates.filter(
          (c) => !importedIds.has(c.externalId) && c.relevanceScore >= 0.4
        );

        if (newCandidates.length > 0) {
          await queueAction({
            workspaceId,
            type: "IMPORT_DOCUMENTS",
            title: `Import ${newCandidates.length} relevant emails`,
            description: `Sentinel scanned your Gmail and found ${newCandidates.length} relevant emails (relevance ≥40%) not yet imported. Top: "${newCandidates[0].subject}".`,
            payload: {
              connectorId: connector.id,
              externalIds: newCandidates.map((c) => c.externalId),
              preview: newCandidates.slice(0, 5).map((c) => ({
                subject: c.subject,
                from: c.from,
                score: c.relevanceScore,
              })),
            },
            triggeredBy: "cron-scan",
          });
          totalCandidates += newCandidates.length;
        }
      }
    } catch (err) {
      console.error(`[sentinel-pm] Scan connector ${connector.id} failed:`, err);
    }
  }

  return { totalCandidates };
}

// ─── Auto-trigger after document ingestion ────────────────────────────────────

export async function onDocumentIngested(workspaceId: string) {
  const settings = await prisma.workspaceSettings.findUnique({ where: { workspaceId } });
  if (!settings?.autoSynthesizeOnIngest) return;

  // Check if synthesis is already pending or executing
  const pending = await prisma.sentinelAction.findFirst({
    where: { workspaceId, type: "SYNTHESIZE_WORKSPACE", status: { in: ["PENDING_REVIEW", "APPROVED", "EXECUTING"] } },
  });
  if (pending) return;

  await queueAction({
    workspaceId,
    type: "SYNTHESIZE_WORKSPACE",
    title: "Auto-synthesize workspace",
    description: "New documents finished processing. Re-synthesizing to extract updated insights and opportunities.",
    payload: {},
    triggeredBy: "doc-ingestion",
    autoApprove: settings.autoSynthesizeOnIngest,
  });
}
