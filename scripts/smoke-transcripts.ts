import { prisma } from "@/lib/db/prisma";

async function main() {
  const alex = await prisma.child.findFirstOrThrow({
    where: { name: "Alex" }, orderBy: { createdAt: "desc" },
  });
  const sessions = await prisma.session.findMany({
    where: { childId: alex.id },
    orderBy: { startedAt: "asc" },
    include: { _count: { select: { messages: true } } },
  });
  for (const s of sessions) {
    console.log(`${s.startedAt.toDateString()}  ${String(s._count.messages).padStart(2)} msgs  ${s.summary ?? ""}`);
  }
  console.log("\n--- first session transcript ---");
  const first = await prisma.message.findMany({
    where: { sessionId: sessions[0].id }, orderBy: { createdAt: "asc" },
  });
  for (const m of first) console.log(`  ${m.role.padEnd(5)} ${m.content}`);
}
main().catch((e)=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
