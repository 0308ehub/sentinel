import { prisma } from "@/lib/db/prisma";
import { buildLearnerContext } from "@/lib/learner/memory";
import { buildRealtimeInstructions } from "@/lib/ai/realtime";

async function main() {
  const parent = await prisma.user.upsert({
    where: { clerkId: "smoke_parent" }, update: {},
    create: { clerkId: "smoke_parent", email: "smoke@example.com" },
  });
  await prisma.child.deleteMany({ where: { parentId: parent.id, name: "MediumTest" } });
  const child = await prisma.child.create({
    data: { parentId: parent.id, name: "MediumTest", ageYears: 6,
      consentGrantedAt: new Date(), mentorProfile: { create: {} } },
  });
  const ctx = await buildLearnerContext(child.id);
  const out = buildRealtimeInstructions(ctx, 3, undefined, { isFirstEver: false });
  const block = out.split("WHAT YOU CAN ACTUALLY ASK THEM TO DO")[1]?.split("WHAT YOU NEVER DO")[0];
  console.log("WHAT YOU CAN ACTUALLY ASK THEM TO DO" + block);
  await prisma.child.delete({ where: { id: child.id } });
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
