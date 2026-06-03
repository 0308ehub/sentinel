import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { apiSuccess, apiError } from "@/types";
import { generateWorkspaceDigest } from "@/server/services/digest-service";
import { after } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    await requireWorkspaceAccess(workspaceId);

    const digests = await prisma.digest.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });

    return Response.json(apiSuccess(digests));
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("unauthorized")) {
      return Response.json(apiError("UNAUTHORIZED", "Not authorized"), { status: 401 });
    }
    return Response.json(apiError("INTERNAL_ERROR", "Internal server error"), { status: 500 });
  }
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    await requireWorkspaceAccess(workspaceId);

    let digest: Awaited<ReturnType<typeof generateWorkspaceDigest>> | null = null;

    after(async () => {
      // No fire-and-forget needed here; we return the result directly.
    });

    digest = await generateWorkspaceDigest(workspaceId, "MANUAL");

    return Response.json(apiSuccess(digest), { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("unauthorized")) {
      return Response.json(apiError("UNAUTHORIZED", "Not authorized"), { status: 401 });
    }
    return Response.json(apiError("INTERNAL_ERROR", "Failed to generate digest"), { status: 500 });
  }
}
