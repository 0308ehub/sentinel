import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { apiSuccess, apiError } from "@/types";

const PatchSchema = z.object({
  content: z.string().min(1),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string; digestId: string }> }
) {
  try {
    const { workspaceId, digestId } = await params;
    await requireWorkspaceAccess(workspaceId);

    let body: z.infer<typeof PatchSchema>;
    try {
      body = PatchSchema.parse(await req.json());
    } catch {
      return Response.json(apiError("VALIDATION_ERROR", "Invalid input"), { status: 400 });
    }

    const digest = await prisma.digest.findFirst({
      where: { id: digestId, workspaceId },
    });
    if (!digest) {
      return Response.json(apiError("NOT_FOUND", "Digest not found"), { status: 404 });
    }

    const updated = await prisma.digest.update({
      where: { id: digestId },
      data: { content: body.content },
    });

    return Response.json(apiSuccess(updated));
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("unauthorized")) {
      return Response.json(apiError("UNAUTHORIZED", "Not authorized"), { status: 401 });
    }
    return Response.json(apiError("INTERNAL_ERROR", "Internal server error"), { status: 500 });
  }
}
