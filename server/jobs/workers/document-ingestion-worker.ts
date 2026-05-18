import { Worker } from "bullmq";
import IORedis from "ioredis";
import { processDocument } from "@/server/services/ingestion-service";

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const documentIngestionWorker = new Worker(
  "document-ingestion",
  async (job) => {
    const { documentId } = job.data as { documentId: string };
    console.log(`[worker] Processing document ${documentId}`);
    await processDocument(documentId);
    console.log(`[worker] Completed document ${documentId}`);
  },
  {
    connection,
    concurrency: 3,
  }
);

documentIngestionWorker.on("failed", (job, err) => {
  console.error(`[worker] Job ${job?.id} failed:`, err.message);
});

documentIngestionWorker.on("completed", (job) => {
  console.log(`[worker] Job ${job.id} completed`);
});
