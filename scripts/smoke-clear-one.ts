import { prisma } from "@/lib/db/prisma";

async function main() {
  const parent = await prisma.user.upsert({
    where: { clerkId: "smoke_parent" }, update: {},
    create: { clerkId: "smoke_parent", email: "smoke@example.com" },
  });
  await prisma.child.deleteMany({ where: { parentId: parent.id, name: "ScopeTest" } });
  const child = await prisma.child.create({
    data: { parentId: parent.id, name: "ScopeTest", ageYears: 7,
      consentGrantedAt: new Date(), mentorProfile: { create: { mentorName: "Zip" } } },
  });

  const ids: string[] = [];
  for (let i = 0; i < 3; i++) {
    const s = await prisma.session.create({ data: { childId: child.id } });
    ids.push(s.id);
    await prisma.message.create({ data: { sessionId: s.id, role: "CHILD", content: `msg ${i}` } });
    await prisma.observation.create({
      data: { childId: child.id, sessionId: s.id, prompt: "p", response: `r${i}` },
    });
  }
  await prisma.hypothesis.create({ data: { childId: child.id, type: "t", description: "d" } });

  const snap = async (label: string) => {
    const [sess, msg, obs, hyp] = await Promise.all([
      prisma.session.count({ where: { childId: child.id } }),
      prisma.message.count({ where: { session: { childId: child.id } } }),
      prisma.observation.count({ where: { childId: child.id } }),
      prisma.hypothesis.count({ where: { childId: child.id } }),
    ]);
    console.log(`${label.padEnd(26)} sessions=${sess} messages=${msg} observations=${obs} hypotheses=${hyp}`);
  };
  await snap("seeded 3 sessions");

  const target = ids[1];
  await prisma.$transaction(async (tx) => {
    await tx.observation.updateMany({ where: { childId: child.id, sessionId: target }, data: { sessionId: null } });
    await tx.intervention.updateMany({ where: { childId: child.id, sessionId: target }, data: { sessionId: null } });
    await tx.session.deleteMany({ where: { id: target, childId: child.id } });
  });
  await snap("after clearing ONE");
  console.log("  ^ expect sessions=2, messages=2, observations still 3, hypotheses still 1");

  await prisma.child.delete({ where: { id: child.id } });
  console.log("\ncleaned up");
}
main().catch((e)=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
