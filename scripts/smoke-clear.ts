import { prisma } from "@/lib/db/prisma";

async function main() {
  const parent = await prisma.user.upsert({
    where: { clerkId: "smoke_parent" },
    update: {},
    create: { clerkId: "smoke_parent", email: "smoke@example.com" },
  });

  await prisma.child.deleteMany({ where: { parentId: parent.id, name: "ClearTest" } });
  const child = await prisma.child.create({
    data: {
      parentId: parent.id, name: "ClearTest", ageYears: 7,
      consentGrantedAt: new Date(), mentorProfile: { create: { mentorName: "Zip" } },
    },
  });
  const session = await prisma.session.create({ data: { childId: child.id } });
  await prisma.message.create({ data: { sessionId: session.id, role: "CHILD", content: "hi" } });
  const obs = await prisma.observation.create({
    data: { childId: child.id, sessionId: session.id, prompt: "p", response: "r" },
  });
  await prisma.hypothesis.create({ data: { childId: child.id, type: "t", description: "d" } });
  await prisma.intervention.create({
    data: { childId: child.id, sessionId: session.id, action: "PROBE", strategy: "s" },
  });
  const a = await prisma.memoryNode.create({ data: { childId: child.id, type: "INTEREST", label: "a" } });
  const b = await prisma.memoryNode.create({ data: { childId: child.id, type: "INTEREST", label: "b" } });
  await prisma.memoryEdge.create({
    data: { sourceNodeId: a.id, targetNodeId: b.id, relationship: "INTERESTED_IN" },
  });
  await prisma.learnerSkillState.create({
    data: { childId: child.id, conceptId: "counting_to_20" },
  });

  const count = async (label: string) => {
    const [m, o, h, i, n, e, s, sess] = await Promise.all([
      prisma.message.count({ where: { session: { childId: child.id } } }),
      prisma.observation.count({ where: { childId: child.id } }),
      prisma.hypothesis.count({ where: { childId: child.id } }),
      prisma.intervention.count({ where: { childId: child.id } }),
      prisma.memoryNode.count({ where: { childId: child.id } }),
      prisma.memoryEdge.count({ where: { source: { childId: child.id } } }),
      prisma.learnerSkillState.count({ where: { childId: child.id } }),
      prisma.session.count({ where: { childId: child.id } }),
    ]);
    console.log(`${label.padEnd(22)} msg=${m} obs=${o} hyp=${h} int=${i} node=${n} edge=${e} skill=${s} sess=${sess}`);
  };

  await count("seeded");

  // scope: conversation
  await prisma.$transaction(async (tx) => {
    await tx.observation.updateMany({ where: { childId: child.id }, data: { sessionId: null } });
    await tx.intervention.updateMany({ where: { childId: child.id }, data: { sessionId: null } });
    await tx.session.deleteMany({ where: { childId: child.id } });
  });
  await count("after conversation");
  console.log("  ^ learner model must survive: obs/hyp/node/skill all non-zero\n");

  // scope: everything
  await prisma.$transaction(async (tx) => {
    await tx.memoryEdge.deleteMany({ where: { source: { childId: child.id } } });
    await tx.memoryNode.deleteMany({ where: { childId: child.id } });
    await tx.hypothesis.deleteMany({ where: { childId: child.id } });
    await tx.intervention.deleteMany({ where: { childId: child.id } });
    await tx.observation.deleteMany({ where: { childId: child.id } });
    await tx.learnerSkillState.deleteMany({ where: { childId: child.id } });
    await tx.learningEvent.deleteMany({ where: { childId: child.id } });
    await tx.mentorProfile.updateMany({
      where: { childId: child.id },
      data: { mentorName: null, mentorNamedAt: null },
    });
    await tx.session.deleteMany({ where: { childId: child.id } });
  });
  await count("after everything");
  const mp = await prisma.mentorProfile.findUnique({ where: { childId: child.id } });
  console.log("  mentorName reset to:", mp?.mentorName);
  console.log("  child still exists:", Boolean(await prisma.child.findUnique({ where: { id: child.id } })));

  await prisma.child.delete({ where: { id: child.id } });
  console.log("\ncleaned up test child");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
