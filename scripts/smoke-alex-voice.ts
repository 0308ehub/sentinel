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
  const section = process.env.SECTION;
  if (section) {
    const i = out.indexOf(section);
    console.log(i === -1 ? `(section "${section}" not found)` : out.slice(i, i + 1600));
  } else {
    const start = out.indexOf("THINGS THEY LIKE");
    console.log(out.slice(start));
  }
}
main().catch((e)=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
