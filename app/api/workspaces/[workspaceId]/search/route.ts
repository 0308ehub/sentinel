import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { apiSuccess, apiError } from "@/types";
import { ai } from "@/lib/ai/provider";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    await requireWorkspaceAccess(workspaceId);

    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim();
    if (!q || q.length < 2) {
      return Response.json(apiSuccess({ results: [], query: q }));
    }

    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "12"), 30);

    const [embedding] = await ai.embedTexts([q]);
    const vectorStr = `[${embedding.join(",")}]`;

    const rows = await prisma.$queryRaw<Array<{
      chunkId: string;
      documentId: string;
      documentTitle: string;
      sourceType: string;
      content: string;
      similarity: number;
    }>>`
      SELECT
        dc.id AS "chunkId",
        dc."documentId",
        d.title AS "documentTitle",
        d."sourceType",
        dc.content,
        1 - (dc.embedding <=> ${vectorStr}::vector) AS similarity
      FROM "DocumentChunk" dc
      JOIN "Document" d ON d.id = dc."documentId"
      WHERE dc."workspaceId" = ${workspaceId}
        AND d.status = 'COMPLETED'
        AND dc.embedding IS NOT NULL
        AND 1 - (dc.embedding <=> ${vectorStr}::vector) > 0.1
      ORDER BY dc.embedding <=> ${vectorStr}::vector
      LIMIT ${limit}
    `;

    return Response.json(apiSuccess({ results: rows, query: q }));
  } catch (err) {
    console.error("[search]", err);
    return Response.json(apiError("INTERNAL_ERROR", "Search failed"), { status: 500 });
  }
}
