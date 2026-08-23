import { prisma } from "@/lib/db/prisma";
import { buildParentReport, masteryLabel, confidenceLabel } from "@/lib/learner/report";

async function main() {
  const alex = await prisma.child.findFirstOrThrow({
    where: { name: "Alex" }, orderBy: { createdAt: "desc" },
  });
  const r = await buildParentReport(alex.id);
  console.log(`═══ DASHBOARD: ${r.child.name}, age ${r.child.ageYears} · mentor "${r.child.mentorProfile?.mentorName}" ═══\n`);
  console.log("THIS WEEK:", JSON.stringify(r.stats), "\n");
  console.log("WHAT ALEX IS LEARNING");
  for (const s of r.skills) console.log(`  ${s.concept.label.padEnd(30)} ${masteryLabel(s)}`);
  console.log("\nWHAT WE'VE NOTICED");
  for (const h of r.hypotheses) console.log(`  [${confidenceLabel(h.confidence)}] ${h.description}`);
  if (r.provisionalCount) console.log(`  (+${r.provisionalCount} still being checked, not shown)`);
  console.log("\nWHAT WORKS:", r.bestStrategies.map((s) => `${s.strategy} ×${s.count}`).join(", "));
  console.log("INTERESTS:", r.interests.map((i) => i.label).join(", "));
  console.log("WHAT'S NEXT:", r.nextConceptIds.join(", "));
  console.log("SESSIONS:", r.sessions.length);
}
main().catch((e)=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
