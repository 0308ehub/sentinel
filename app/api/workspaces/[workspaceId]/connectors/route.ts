import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { unauthorizedResponse, internalErrorResponse } from "@/lib/auth/helpers";
import { apiSuccess, apiError } from "@/types";
import { z } from "zod";

export async function GET(_req: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  try {
    await requireWorkspaceAccess(workspaceId);
  } catch {
    return unauthorizedResponse();
  }

  try {
    const connectors = await prisma.connector.findMany({
      where: { workspaceId },
      include: { syncLogs: { orderBy: { startedAt: "desc" }, take: 3 } },
      orderBy: { createdAt: "asc" },
    });
    return Response.json(apiSuccess(connectors));
  } catch (err) {
    return internalErrorResponse(err instanceof Error ? err.message : "Failed to fetch connectors");
  }
}

const CreateConnectorSchema = z.object({
  type: z.enum(["GMAIL", "SLACK", "LINEAR", "JIRA", "INTERCOM", "ZENDESK", "HUBSPOT", "NOTION"]),
  name: z.string().min(1),
  config: z.record(z.string(), z.unknown()),
});

export async function POST(req: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  try {
    await requireWorkspaceAccess(workspaceId);
  } catch {
    return unauthorizedResponse();
  }

  try {
    const body = await req.json();
    const parsed = CreateConnectorSchema.safeParse(body);
    if (!parsed.success) return Response.json(apiError("VALIDATION_ERROR", "Invalid input", parsed.error.issues), { status: 400 });

    const connector = await prisma.connector.create({
      data: {
        workspaceId,
        type: parsed.data.type,
        name: parsed.data.name,
        config: parsed.data.config as Record<string, string>,
        status: "ACTIVE",
      },
    });

    return Response.json(apiSuccess(connector), { status: 201 });
  } catch (err) {
    return internalErrorResponse(err instanceof Error ? err.message : "Failed to create connector");
  }
}
