import { prisma } from "@/lib/db/prisma";
import { processChildTurn } from "@/lib/learner/pipeline";
import { streamTutorResponse } from "@/lib/ai/tutor";

async function main() {
  const parent = await prisma.user.upsert({
    where: { clerkId: "smoke_parent" },
    update: {},
    create: { clerkId: "smoke_parent", email: "smoke@example.com", name: "Smoke Parent" },
  });

  await prisma.child.deleteMany({ where: { parentId: parent.id, name: "Maya" } });
  const child = await prisma.child.create({
    data: {
      parentId: parent.id,
      name: "Maya",
      ageYears: 7,
      gradeLabel: "1st grade",
      interests: ["dinosaurs", "drawing"],
      consentGrantedAt: new Date(),
      consentVersion: "2026-08-22",
      mentorProfile: { create: {} },
    },
  });

  const session = await prisma.session.create({ data: { childId: child.id } });
  console.log("child:", child.name, "| session:", session.id, "\n");

  const inputs = process.env.SMOKE_INPUTS
    ? JSON.parse(process.env.SMOKE_INPUTS)
    : ["17 minus 9 is 10", "I did 9 take away 7 and then put the 1 back on"];

  for (const text of inputs) {
    console.log(`\n${"=".repeat(70)}\nCHILD: ${text}`);
    const turn = await processChildTurn(session.id, text);

    console.log(`\n  ACTION:      ${turn.planner.next_action}`);
    console.log(`  TARGET:      ${turn.planner.target ?? "—"}`);
    console.log(`  STRATEGY:    ${turn.planner.strategy ?? "—"}`);
    console.log(`  CORRECTNESS: ${turn.planner.correctness}`);
    console.log(`  PATTERN:     ${turn.planner.reasoning_pattern ?? "—"}`);
    console.log(`  OBSERVATION: ${turn.planner.observation}`);
    console.log(`  REASON:      ${turn.planner.reason}`);
    console.log(`  HYPOTHESES:`);
    for (const h of turn.planner.updated_hypotheses) {
      console.log(`    [${h.confidence.toFixed(2)}] ${h.type}: ${h.description}`);
    }
    console.log(`  MEMORY:`);
    for (const m of turn.planner.memory_updates) {
      console.log(`    (${m.type}) ${m.label}`);
    }

    process.stdout.write("\n  NOVA: ");
    let full = "";
    for await (const chunk of streamTutorResponse({ planner: turn.planner, context: turn.context })) {
      full += chunk;
    }
    console.log(full);
    await prisma.message.create({
      data: { sessionId: session.id, role: "TUTOR", content: full, action: turn.planner.next_action },
    });
  }

  console.log(`\n${"=".repeat(70)}\nPERSISTED STATE\n`);
  const [hyps, mems, skills, obs] = await Promise.all([
    prisma.hypothesis.findMany({ where: { childId: child.id } }),
    prisma.memoryNode.findMany({ where: { childId: child.id } }),
    prisma.learnerSkillState.findMany({ where: { childId: child.id }, include: { concept: true } }),
    prisma.observation.findMany({ where: { childId: child.id } }),
  ]);
  console.log(`observations: ${obs.length}`);
  console.log(`hypotheses:   ${hyps.length}`);
  for (const h of hyps) console.log(`   [${h.confidence.toFixed(2)}] ${h.status} ${h.type}`);
  console.log(`memory nodes: ${mems.length}`);
  for (const m of mems) console.log(`   (${m.type}) ${m.label}`);
  console.log(`skill states: ${skills.length}`);
  for (const s of skills) console.log(`   ${s.concept.label}: mastery ${s.masteryProbability.toFixed(2)}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
