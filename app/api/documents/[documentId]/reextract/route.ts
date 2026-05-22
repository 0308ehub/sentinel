import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/helpers";
import { apiSuccess, apiError } from "@/types";
import { updateDocumentStatus } from "@/server/services/document-service";
import { extractDocumentInsights } from "@/server/services/extraction-service";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;
    const user = await requireUser();

    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        workspace: { include: { organization: { include: { memberships: { where: { userId: user.id } } } } } },
      },
    });

    if (!doc || doc.workspace.organization.memberships.length === 0) {
      return Response.json(apiError("UNAUTHORIZED", "Not authorized"), { status: 403 });
    }

    // Delete only the AI-derived records for this document — chunks/embeddings stay intact
    await Promise.all([
      prisma.documentExtraction.deleteMany({ where: { documentId } }),
      prisma.insight.deleteMany({ where: { workspaceId: doc.workspaceId, evidenceIds: { hasSome: [documentId] } } }),
      prisma.painPoint.deleteMany({ where: { workspaceId: doc.workspaceId, evidenceIds: { hasSome: [documentId] } } }),
    ]);

    await updateDocumentStatus(documentId, "EXTRACTING");

    // Run inline (same pattern as dispatchIngestion in dev)
    ;(async () => {
      try {
        await extractDocumentInsights(documentId);
        await updateDocumentStatus(documentId, "COMPLETED");
      } catch (err) {
        console.error(`[reextract] failed for ${documentId}:`, err);
        await updateDocumentStatus(documentId, "FAILED", String(err));
      }
    })();

    return Response.json(apiSuccess({ documentId, status: "EXTRACTING" }));
  } catch {
    return Response.json(apiError("INTERNAL_ERROR", "Failed to re-extract"), { status: 500 });
  }
}
