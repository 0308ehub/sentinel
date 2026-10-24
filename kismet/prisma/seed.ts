/**
 * Prisma seed script — run after `npx prisma generate && npx prisma db push`
 * Mirrors src/lib/data/seed.ts for PostgreSQL persistence
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.upsert({
    where: { slug: "acme" },
    update: {},
    create: { name: "Acme Inc", slug: "acme" },
  });

  const product = await prisma.product.upsert({
    where: { id: "product-acme" },
    update: {},
    create: {
      id: "product-acme",
      organizationId: org.id,
      name: "Acme Platform",
      description: "B2B SaaS platform for workflow automation",
      status: "ACTIVE",
    },
  });

  console.log(`Seeded organization ${org.name} with product ${product.name}`);
  console.log("Import full seed data from src/lib/data/seed.ts for complete graph");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
