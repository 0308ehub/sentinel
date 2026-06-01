import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { apiSuccess, apiError } from "@/types";

const Schema = z.object({
  autoSynthesizeOnIngest: z.boolean().optional(),
  autoImportHighScore: z.boolean().optional(),
  autoPushToLinear: z.boolean().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    await requireWorkspaceAccess(workspaceId);
    const settings = await prisma.workspaceSettings.findUnique({ where: { workspaceId } });
    return Response.json(apiSuccess(settings));
  } catch {
    return Response.json(apiError("UNAUTHORIZED", "Not authorized"), { status: 401 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    await requireWorkspaceAccess(workspaceId);
    const data = Schema.parse(await req.json());

    const settings = await prisma.workspaceSettings.upsert({
      where: { workspaceId },
      create: {
        id: `ws_${Date.now().toString(36)}`,
        workspaceId,
        ...data,
      },
      update: data,
    });
    return Response.json(apiSuccess(settings));
  } catch {
    return Response.json(apiError("INTERNAL_ERROR", "Failed to update settings"), { status: 500 });
  }
}
