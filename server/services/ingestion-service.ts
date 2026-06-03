import { prisma } from "@/lib/db/prisma";
import { parseDocumentContent } from "@/lib/ingestion/parse-document";
import { chunkText } from "@/lib/ingestion/chunk-text";
import { ai } from "@/lib/ai/provider";
import { updateDocumentStatus } from "./document-service";
import { extractDocumentInsights } from "./extraction-service";

export async function processDocument(documentId: string, rawInput?: Buffer | string): Promise<void> {
  try {
    const document = await prisma.document.findUniqueOrThrow({
      where: { id: documentId },
    });

    // PARSING
    await updateDocumentStatus(documentId, "PARSING");

    let parsedText: string;

    if (rawInput !== undefined) {
      // Fast path: content was passed directly from the upload route — no DB read needed.
      const parsed = await parseDocumentContent(rawInput, document.fileType ?? "txt");
      parsedText = parsed.text;
      // Persist rawText so reprocess and search can use it later.
      await prisma.document.update({
        where: { id: documentId },
        data: { rawText: parsedText },
      });
    } else {
      // Reprocess path: read content that was previously stored.
      const stored = document.rawText ?? document.storageKey ?? "";
      const parsed = await parseDocumentContent(stored, document.fileType ?? "txt");
      parsedText = parsed.text;
      if (!document.rawText) {
        await prisma.document.update({
          where: { id: documentId },
          data: { rawText: parsedText },
        });
      }
    }

    // CHUNKING
    await updateDocumentStatus(documentId, "CHUNKING");
    const textChunks = chunkText(parsedText);

    // EMBEDDING
    await updateDocumentStatus(documentId, "EMBEDDING");

    // Delete old chunks before re-processing
    await prisma.documentChunk.deleteMany({ where: { documentId } });

    const texts = textChunks.map((c) => c.content);
    const embeddings = await ai.embedTexts(texts);

    // Save chunks with embeddings using raw SQL (pgvector)
    for (let i = 0; i < textChunks.length; i++) {
      const chunk = textChunks[i];
      const embedding = embeddings[i];
      const vectorStr = `[${embedding.join(",")}]`;

      await prisma.$executeRaw`
        INSERT INTO "DocumentChunk" (id, "workspaceId", "documentId", index, content, "tokenCount", embedding, "createdAt")
        VALUES (
          ${generateId()},
          ${document.workspaceId},
          ${documentId},
          ${chunk.index},
          ${chunk.content},
          ${chunk.tokenCount},
          ${vectorStr}::vector,
          NOW()
        )
      `;
    }

    // COMPLETED — mark as soon as embeddings are stored so users can synthesize immediately
    await updateDocumentStatus(documentId, "COMPLETED");

    // Extraction runs after completion (non-blocking for the user).
    // The after() context in dispatch.ts keeps the process alive so this still
    // finishes and populates insights — it just no longer gates synthesis.
    extractDocumentInsights(documentId).catch((extractErr) =>
      console.error(`[ingestion] Extraction failed for ${documentId} (non-fatal):`, extractErr)
    );

    // Track event
    await prisma.productEvent.create({
      data: {
        workspaceId: document.workspaceId,
        event: "document_processed",
        properties: { documentId, chunkCount: textChunks.length },
      },
    });

    // Trigger autonomous PM hook
    import("@/server/services/autonomous-pm").then(({ onDocumentIngested }) =>
      onDocumentIngested(document.workspaceId).catch(() => {})
    );
  } catch (error) {
    console.error(`[ingestion] Failed to process document ${documentId}:`, error);
    await updateDocumentStatus(documentId, "FAILED", String(error));

    const doc = await prisma.document.findUnique({ where: { id: documentId } });
    if (doc) {
      await prisma.productEvent.create({
        data: {
          workspaceId: doc.workspaceId,
          event: "document_failed",
          properties: { documentId, error: String(error) },
        },
      });
    }

    throw error;
  }
}

function generateId(): string {
  return `c${Math.random().toString(36).slice(2, 11)}${Date.now().toString(36)}`;
}
