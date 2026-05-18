import { Queue } from "bullmq";
import IORedis from "ioredis";

let _connection: IORedis | null = null;

function getRedisConnection() {
  if (!_connection) {
    _connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
  }
  return _connection;
}

let _ingestionQueue: Queue | null = null;
export function getDocumentIngestionQueue() {
  if (!_ingestionQueue) {
    _ingestionQueue = new Queue("document-ingestion", {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    });
  }
  return _ingestionQueue;
}

let _synthesisQueue: Queue | null = null;
export function getWorkspaceSynthesisQueue() {
  if (!_synthesisQueue) {
    _synthesisQueue = new Queue("workspace-synthesis", {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: "fixed", delay: 5000 },
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    });
  }
  return _synthesisQueue;
}

// Backwards-compat named exports used by API routes
export const documentIngestionQueue = { add: (...args: Parameters<Queue["add"]>) => getDocumentIngestionQueue().add(...args) };
export const workspaceSynthesisQueue = { add: (...args: Parameters<Queue["add"]>) => getWorkspaceSynthesisQueue().add(...args) };
