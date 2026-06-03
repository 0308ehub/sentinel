import { after } from "next/server";

/**
 * Dispatch a document for ingestion.
 * Returns immediately so callers can respond to the HTTP client without
 * blocking. Uses Next.js `after()` to keep the serverless execution context
 * alive until processing finishes — without it, Vercel kills the function
 * after the response is sent and embeddings are never written.
 *
 * Pass rawInput when the caller already has the file bytes/text in memory
 * so the ingestion service can skip the large DB read on first ingestion.
 */
export function dispatchIngestion(documentId: string, rawInput?: Buffer | string): void {
  const task = import("@/server/services/ingestion-service")
    .then(({ processDocument }) =>
      processDocument(documentId, rawInput).catch((err) =>
        console.error(`[ingestion] document ${documentId} failed:`, err)
      )
    )
    .catch((err) => console.error(`[ingestion] import failed for ${documentId}:`, err));

  after(task);
}
