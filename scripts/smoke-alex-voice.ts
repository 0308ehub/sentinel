import { prisma } from "@/lib/db/prisma";
import { buildLearnerContext } from "@/lib/learner/memory";
import { buildRealtimeInstructions } from "@/lib/ai/realtime";

async function main() {
  const alex = await prisma.child.findFirstOrThrow({
    where: { name: "Alex" }, orderBy: { createdAt: "desc" },
  });
  const last = await prisma.session.findFirst({
    where: { childId: alex.id, summary: { not: null } },
    orderBy: { startedAt: "desc" },
  });
  const ctx = await buildLearnerContext(alex.id);
  const out = buildRealtimeInstructions(ctx, 3, undefined, {
    isFirstEver: false,
    lastSessionSummary: last?.summary ?? null,
  });
  // Just the parts that carry the learner model into the room.
  const start = out.indexOf("THINGS THEY LIKE");
  console.log(out.slice(start));
}
main().catch((e)=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
