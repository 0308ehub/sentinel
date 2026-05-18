import { Worker } from "bullmq";
import IORedis from "ioredis";
import { synthesizeWorkspace } from "@/server/services/synthesis-service";

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const workspaceSynthesisWorker = new Worker(
  "workspace-synthesis",
  async (job) => {
    const { workspaceId } = job.data as { workspaceId: string };
    console.log(`[worker] Synthesizing workspace ${workspaceId}`);
    await synthesizeWorkspace(workspaceId);
    console.log(`[worker] Completed synthesis for ${workspaceId}`);
  },
  {
    connection,
    concurrency: 1,
  }
);

workspaceSynthesisWorker.on("failed", (job, err) => {
  console.error(`[worker] Synthesis job ${job?.id} failed:`, err.message);
});
