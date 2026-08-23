import { prisma } from "@/lib/db/prisma";
import { buildParentReport, masteryLabel, confidenceLabel } from "@/lib/learner/report";

async function main() {
  const child = await prisma.child.findFirst({
    where: { hypotheses: { some: {} } },
    orderBy: { createdAt: "desc" },
  });
  if (!child) return console.log("no child with data yet");

  const r = await buildParentReport(child.id);
  console.log(`REPORT FOR ${r.child.name} (age ${r.child.ageYears})`);
  console.log(`mentor: ${r.child.mentorProfile?.mentorName ?? "unnamed"}\n`);
  console.log("THIS WEEK:", JSON.stringify(r.stats));
  console.log("\nWHAT THEY'RE LEARNING:");
  for (const s of r.skills) console.log(`  ${s.concept.label.padEnd(28)} ${masteryLabel(s)}`);
  console.log("\nWHAT WE'VE NOTICED:");
  for (const h of r.hypotheses) console.log(`  [${confidenceLabel(h.confidence)}] ${h.description}`);
  console.log("\nWHAT WORKS:", r.bestStrategies.map((s) => s.strategy).join(", ") || "(nothing yet)");
  console.log("INTERESTS:", r.interests.map((i) => i.label).join(", ") || "(none)");
  console.log("WHAT'S NEXT:", r.nextConceptIds.join(", ") || "(none)");
  console.log("SESSIONS:", r.sessions.length);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
