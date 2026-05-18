import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/helpers";
import { apiSuccess, apiError } from "@/types";
import type { OpportunityStatus } from "@prisma/client";

async function verifyOpportunityAccess(opportunityId: string, userId: string) {
  const opp = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    include: {
      workspace: {
        include: { organization: { include: { memberships: { where: { userId } } } } },
      },
    },
  });
  if (!opp || opp.workspace.organization.memberships.length === 0) return null;
  return opp;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ opportunityId: string }> }
) {
  try {
    const { opportunityId } = await params;
    const user = await requireUser();
    const opp = await verifyOpportunityAccess(opportunityId, user.id);
    if (!opp) return Response.json(apiError("NOT_FOUND", "Opportunity not found"), { status: 404 });

    const full = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      include: { painPoint: true, prds: { select: { id: true, title: true, createdAt: true } }, tickets: true },
    });

    return Response.json(apiSuccess(full));
  } catch {
    return Response.json(apiError("UNAUTHORIZED", "Not authorized"), { status: 401 });
  }
}

const PatchSchema = z.object({
  status: z.enum(["PROPOSED", "ACCEPTED", "REJECTED", "IN_PROGRESS", "SHIPPED"]).optional(),
  proposedSolution: z.string().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ opportunityId: string }> }
) {
  try {
    const { opportunityId } = await params;
    const user = await requireUser();
    const opp = await verifyOpportunityAccess(opportunityId, user.id);
    if (!opp) return Response.json(apiError("NOT_FOUND", "Opportunity not found"), { status: 404 });

    const body = await request.json();
    const data = PatchSchema.parse(body);

    const updated = await prisma.opportunity.update({
      where: { id: opportunityId },
      data: { status: data.status as OpportunityStatus | undefined, proposedSolution: data.proposedSolution },
    });

    if (data.status === "ACCEPTED") {
      await prisma.productEvent.create({
        data: { workspaceId: opp.workspaceId, event: "opportunity_accepted", properties: { opportunityId } },
      });
    } else if (data.status === "REJECTED") {
      await prisma.productEvent.create({
        data: { workspaceId: opp.workspaceId, event: "opportunity_rejected", properties: { opportunityId } },
      });
    }

    return Response.json(apiSuccess(updated));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(apiError("VALIDATION_ERROR", "Invalid input", error.issues), { status: 400 });
    }
    return Response.json(apiError("INTERNAL_ERROR", "Failed to update"), { status: 500 });
  }
}
