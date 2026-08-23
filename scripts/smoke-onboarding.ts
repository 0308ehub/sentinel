import { prisma } from "@/lib/db/prisma";
import { buildLearnerContext } from "@/lib/learner/memory";
import { buildRealtimeInstructions } from "@/lib/ai/realtime";

async function main() {
  const parent = await prisma.user.upsert({
    where: { clerkId: "smoke_parent" },
    update: {},
    create: { clerkId: "smoke_parent", email: "smoke@example.com" },
  });
  await prisma.child.deleteMany({ where: { parentId: parent.id, name: "OnboardTest" } });
  const child = await prisma.child.create({
    data: {
      parentId: parent.id, name: "Michael", ageYears: 7, gradeLabel: "2nd grade",
      interests: ["lego", "space"], consentGrantedAt: new Date(),
      mentorProfile: { create: {} },
    },
  });
  const ctx = await buildLearnerContext(child.id);
  const out = buildRealtimeInstructions(ctx, 1, undefined, { isFirstEver: true });
  console.log("RIGHT NOW" + out.split("RIGHT NOW")[1].split("THINGS THEY LIKE")[0]);
  console.log("HOW TO OPEN" + out.split("HOW TO OPEN")[1]);
  await prisma.child.delete({ where: { id: child.id } });
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
