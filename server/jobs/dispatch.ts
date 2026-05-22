import { documentIngestionQueue } from "./queues";

/**
 * Dispatch a document for ingestion.
 * In development: always processes inline (no worker needed).
 * In production: adds to BullMQ queue so the worker picks it up.
 */
export async function dispatchIngestion(documentId: string): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    const { processDocument } = await import("@/server/services/ingestion-service");
    processDocument(documentId).catch((err) =>
      console.error(`[ingestion] document ${documentId} failed:`, err)
    );
    return;
  }

  try {
    await documentIngestionQueue.add("process-document", { documentId });
  } catch (err) {
    console.error("[queue] Failed to enqueue, falling back to inline processing:", err);
    const { processDocument } = await import("@/server/services/ingestion-service");
    processDocument(documentId).catch((e) =>
      console.error(`[ingestion] document ${documentId} failed:`, e)
    );
  }
}
