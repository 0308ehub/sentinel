/**
 * Dispatch a document for ingestion.
 * Synchronous — starts the background promise and returns immediately so
 * callers can respond to the HTTP client without waiting for the module
 * import or any processing.
 *
 * Pass rawInput when the caller already has the file bytes/text in memory
 * so the background worker can skip the large DB read on first ingestion.
 */
export function dispatchIngestion(documentId: string, rawInput?: Buffer | string): void {
  import("@/server/services/ingestion-service")
    .then(({ processDocument }) =>
      processDocument(documentId, rawInput).catch((err) =>
        console.error(`[ingestion] document ${documentId} failed:`, err)
      )
    )
    .catch((err) => console.error(`[ingestion] import failed for ${documentId}:`, err));
}
