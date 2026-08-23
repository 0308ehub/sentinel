import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { CONCEPTS } from "../lib/curriculum/concepts";
import { PREREQUISITE_EDGES } from "../lib/curriculum/graph";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  for (const c of CONCEPTS) {
    await prisma.concept.upsert({ where: { id: c.id }, update: c, create: c });
  }
  console.log(`seeded ${CONCEPTS.length} concepts`);

  for (const e of PREREQUISITE_EDGES) {
    await prisma.conceptEdge.upsert({
      where: { sourceId_targetId: { sourceId: e.sourceId, targetId: e.targetId } },
      update: {},
      create: e,
    });
  }
  console.log(`seeded ${PREREQUISITE_EDGES.length} prerequisite edges`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
