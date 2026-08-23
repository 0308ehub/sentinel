import { prisma } from "@/lib/db/prisma";
import { buildLearnerContext } from "@/lib/learner/memory";
import { buildRealtimeInstructions, REALTIME_MODEL, REALTIME_VOICE } from "@/lib/ai/realtime";
import { stageForTurn } from "@/lib/ai/planner";
import OpenAI from "openai";

async function main() {
  const child = await prisma.child.findFirst({
    where: { name: "Maya" },
    orderBy: { createdAt: "desc" },
    include: { mentorProfile: true },
  });
  if (!child) throw new Error("no test child");

  const session = await prisma.session.findFirst({
    where: { childId: child.id },
    orderBy: { startedAt: "desc" },
  });

  const ctx = await buildLearnerContext(child.id, session?.id);
  const stage = stageForTurn(0, false);

  console.log("=".repeat(70));
  console.log(buildRealtimeInstructions(ctx, stage, "Next move: PROBE on cross_ten_subtraction."));
  console.log("=".repeat(70));

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const secret = await client.realtime.clientSecrets.create({
    expires_after: { anchor: "created_at", seconds: 600 },
    session: {
      type: "realtime",
      model: REALTIME_MODEL,
      instructions: buildRealtimeInstructions(ctx, stage),
      audio: {
        input: {
          transcription: { model: "whisper-1" },
          turn_detection: { type: "semantic_vad" },
          noise_reduction: { type: "near_field" },
        },
        output: { voice: REALTIME_VOICE, speed: 0.95 },
      },
    },
  });
  console.log("\nTOKEN MINTED with full learner context ✓");
  console.log("model:", REALTIME_MODEL, "| voice:", REALTIME_VOICE, "| expires:", secret.expires_at);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
