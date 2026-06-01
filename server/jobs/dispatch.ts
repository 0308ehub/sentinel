/**
 * Dispatch a document for ingestion.
 * Always processes inline as a fire-and-forget background promise.
 * Vercel serverless keeps the function alive until the promise settles
 * (up to maxDuration on the calling route).
 */
export async function dispatchIngestion(documentId: string): Promise<void> {
  const { processDocument } = await import("@/server/services/ingestion-service");
  processDocument(documentId).catch((err) =>
    console.error(`[ingestion] document ${documentId} failed:`, err)
  );
}
