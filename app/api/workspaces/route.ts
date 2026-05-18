import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/helpers";
import { apiSuccess, apiError } from "@/types";

const CreateWorkspaceSchema = z.object({
  organizationId: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export async function GET() {
  try {
    const user = await requireUser();
    const memberships = await prisma.membership.findMany({ where: { userId: user.id } });
    const orgIds = memberships.map((m) => m.organizationId);

    const workspaces = await prisma.workspace.findMany({
      where: { organizationId: { in: orgIds } },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { documents: true, painPoints: true, opportunities: true } },
        organization: { select: { name: true, slug: true } },
      },
    });

    return Response.json(apiSuccess(workspaces));
  } catch {
    return Response.json(apiError("UNAUTHORIZED", "Not authenticated"), { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const { organizationId, name, description } = CreateWorkspaceSchema.parse(body);

    // Verify user belongs to org
    const membership = await prisma.membership.findUnique({
      where: { userId_organizationId: { userId: user.id, organizationId } },
    });
    if (!membership) {
      return Response.json(apiError("UNAUTHORIZED", "Not a member of this organization"), { status: 403 });
    }

    const workspace = await prisma.workspace.create({
      data: { organizationId, name, description },
    });

    return Response.json(apiSuccess(workspace), { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(apiError("VALIDATION_ERROR", "Invalid input", error.issues), { status: 400 });
    }
    return Response.json(apiError("INTERNAL_ERROR", "Failed to create workspace"), { status: 500 });
  }
}
