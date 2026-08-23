import { prisma } from "@/lib/db/prisma";

/** Mirrors what /api/sessions returns, to confirm the view empties after a clear. */
async function loadView(childId: string) {
  const existing = await prisma.session.findFirst({
    where: { childId, status: "ACTIVE", startedAt: { gte: new Date(Date.now() - 12 * 3600_000) } },
    orderBy: { startedAt: "desc" },
  });
  const session = existing ?? (await prisma.session.create({ data: { childId } }));
  const messages = await prisma.message.findMany({
    where: { sessionId: session.id }, orderBy: { createdAt: "asc" },
  });
  return { sessionId: session.id, visible: messages.filter((m) => m.role === "TUTOR").length };
}

async function main() {
  const alex = await prisma.child.findFirstOrThrow({
    where: { name: "Alex" }, orderBy: { createdAt: "desc" },
  });

  const s = await prisma.session.create({ data: { childId: alex.id } });
  for (const t of ["hello there", "second thing"]) {
    await prisma.message.create({ data: { sessionId: s.id, role: "TUTOR", content: t } });
  }
  console.log("before clear:", await loadView(alex.id));

  await prisma.$transaction(async (tx) => {
    await tx.observation.updateMany({ where: { childId: alex.id, sessionId: s.id }, data: { sessionId: null } });
    await tx.intervention.updateMany({ where: { childId: alex.id, sessionId: s.id }, data: { sessionId: null } });
    await tx.session.deleteMany({ where: { id: s.id, childId: alex.id } });
    await tx.session.updateMany({
      where: { childId: alex.id, status: "ACTIVE" },
      data: { status: "COMPLETED", endedAt: new Date() },
    });
  });

  const after = await loadView(alex.id);
  console.log("after clear: ", after, "  <- visible must be 0");

  const survived = await prisma.session.count({ where: { childId: alex.id, summary: { not: null } } });
  const hyp = await prisma.hypothesis.count({ where: { childId: alex.id } });
  console.log(`seeded sessions still present: ${survived}, hypotheses: ${hyp}`);

  await prisma.session.deleteMany({ where: { id: after.sessionId } });
}
main().catch((e)=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
