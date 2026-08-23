/**
 * Seeds a demo child with a lived-in learner model.
 *
 * Alex is built around the spec's hero case: fluent with addition, competent at
 * subtraction that stays inside a ten, and reliably wrong the moment a problem
 * crosses one — because he subtracts each digit on its own. The number line is
 * what has worked. A demo conversation should surface that without being told.
 *
 * Run: npx tsx scripts/seed-demo-child.ts  (idempotent — recreates Alex)
 */
import { prisma } from "@/lib/db/prisma";
import { embedText } from "@/lib/ai/openai-embeddings";

const PARENT_CLERK_ID = process.env.DEMO_PARENT_CLERK_ID ?? "";
const DAY = 86_400_000;
const ago = (d: number) => new Date(Date.now() - d * DAY);

async function main() {
  const parent = PARENT_CLERK_ID
    ? await prisma.user.findUniqueOrThrow({ where: { clerkId: PARENT_CLERK_ID } })
    : await prisma.user.findFirstOrThrow({ orderBy: { createdAt: "asc" } });

  console.log(`seeding under parent: ${parent.email}`);
  await prisma.child.deleteMany({ where: { parentId: parent.id, name: "Alex" } });

  const alex = await prisma.child.create({
    data: {
      parentId: parent.id,
      name: "Alex",
      ageYears: 7,
      gradeLabel: "2nd grade",
      readingLevel: "reading simple chapter books",
      mathLevel: "confident to 20, shaky past a ten",
      interests: ["rockets", "space", "drawing", "dogs"],
      goals: ["feel confident with subtraction", "read a chapter book alone"],
      strugglesWith: ["takeaway problems that cross ten"],
      consentGrantedAt: ago(24),
      consentVersion: "2026-08-22",
      createdAt: ago(24),
      mentorProfile: {
        create: { mentorName: "Comet", mentorNamedAt: ago(24) },
      },
    },
  });

  // ── Mastery ────────────────────────────────────────────────────────────────
  const skills: [string, Partial<Record<string, number>> & { p: number; c: number }][] = [
    ["counting_to_20", { p: 0.95, c: 0.9, ind: 8, ret: 3, tr: 2 }],
    ["number_magnitude", { p: 0.92, c: 0.88, ind: 6, ret: 2, tr: 2 }],
    ["addition_within_10", { p: 0.94, c: 0.9, ind: 9, ret: 3, tr: 2 }],
    ["subtraction_within_10", { p: 0.88, c: 0.85, ind: 6, ret: 2, tr: 1 }],
    ["addition_within_20", { p: 0.81, c: 0.8, ind: 5, ret: 1, tr: 1 }],
    ["subtraction_within_20", { p: 0.64, c: 0.72, ind: 3, ret: 1, tr: 0, f: 2 }],
    ["cross_ten_subtraction", { p: 0.22, c: 0.78, ind: 0, ret: 0, tr: 0, f: 6, pr: 2 }],
    ["place_value_tens_ones", { p: 0.15, c: 0.3, ind: 0, ret: 0, tr: 0, f: 1 }],
    ["letter_recognition", { p: 0.97, c: 0.95, ind: 10, ret: 3, tr: 2 }],
    ["phonemic_awareness", { p: 0.9, c: 0.86, ind: 7, ret: 2, tr: 1 }],
    ["cvc_decoding", { p: 0.86, c: 0.84, ind: 6, ret: 2, tr: 1 }],
    ["sight_words", { p: 0.58, c: 0.6, ind: 3, ret: 0, tr: 0, f: 2 }],
    ["evidence_giving", { p: 0.72, c: 0.7, ind: 4, ret: 1, tr: 1 }],
    ["counterexample_finding", { p: 0.35, c: 0.45, ind: 1, ret: 0, tr: 0, f: 1 }],
  ];

  for (const [conceptId, v] of skills) {
    await prisma.learnerSkillState.create({
      data: {
        childId: alex.id,
        conceptId,
        masteryProbability: v.p,
        confidence: v.c,
        independentSuccesses: v.ind ?? 0,
        promptedSuccesses: v.pr ?? 0,
        failures: v.f ?? 0,
        retentionChecksPassed: v.ret ?? 0,
        transferSuccesses: v.tr ?? 0,
        lastTestedAt: ago(2),
        nextRetentionCheckAt: new Date(Date.now() + 3 * DAY),
      },
    });
  }

  // ── Sessions and transcript ────────────────────────────────────────────────
  const sessionDays = [21, 17, 13, 9, 5, 2];
  const sessionIds: string[] = [];
  for (const d of sessionDays) {
    const s = await prisma.session.create({
      data: {
        childId: alex.id,
        status: "COMPLETED",
        startedAt: ago(d),
        endedAt: new Date(ago(d).getTime() + 11 * 60_000),
        summary:
          d === 2
            ? "Worked on 15 - 8 using the number line. Alex got there by going to ten first, then back three."
            : null,
      },
    });
    sessionIds.push(s.id);
  }

  const lastSession = sessionIds[sessionIds.length - 1];
  const transcript: [("TUTOR" | "CHILD"), string][] = [
    ["TUTOR", "Hi Alex. Last time we were doing takeaways. Want to try one with the number line?"],
    ["CHILD", "okay"],
    ["TUTOR", "Fifteen take away eight. Picture the line — you're standing on fifteen."],
    ["CHILD", "um... seven?"],
    ["TUTOR", "That's it. How did you get there?"],
    ["CHILD", "i went back to ten first and then three more"],
    ["TUTOR", "That's exactly the trick. Going to ten first makes the jump easier to hold onto."],
  ];
  for (let i = 0; i < transcript.length; i++) {
    const [role, content] = transcript[i];
    await prisma.message.create({
      data: {
        sessionId: lastSession,
        role,
        content,
        action: role === "TUTOR" ? (i === 2 ? "CHANGE_REPRESENTATION" : "PROBE") : null,
        targetConcept: role === "TUTOR" ? "cross_ten_subtraction" : null,
        createdAt: new Date(ago(2).getTime() + i * 40_000),
      },
    });
  }

  // ── Hypotheses ─────────────────────────────────────────────────────────────
  const hypotheses = [
    {
      type: "digitwise_subtraction",
      description:
        "Alex subtracts each digit on its own instead of treating the number as one quantity, so 17 - 9 comes out as 10.",
      confidence: 0.89,
      status: "CONFIRMED" as const,
      conceptId: "cross_ten_subtraction",
      evidence: 5,
    },
    {
      type: "responds_to_spatial_representation",
      description:
        "Alex works things out much more reliably when he can picture them on a number line than when the problem is only spoken.",
      confidence: 0.84,
      status: "CONFIRMED" as const,
      conceptId: null,
      evidence: 4,
    },
    {
      type: "explains_before_answering",
      description:
        "Alex has started describing his method before giving an answer, which he did not do three weeks ago.",
      confidence: 0.71,
      status: "ACTIVE" as const,
      conceptId: "explanation_quality",
      evidence: 3,
    },
    {
      type: "loses_track_crossing_ten",
      description:
        "When counting backwards past a ten, Alex sometimes lands one off, which looks like a working-memory slip rather than a misunderstanding.",
      confidence: 0.62,
      status: "ACTIVE" as const,
      conceptId: "cross_ten_subtraction",
      evidence: 3,
    },
    {
      type: "guesses_when_tired",
      description: "Late in a session Alex answers faster and less accurately.",
      confidence: 0.38,
      status: "ACTIVE" as const,
      conceptId: null,
      evidence: 1,
    },
  ];

  for (const h of hypotheses) {
    const obs = [];
    for (let i = 0; i < h.evidence; i++) {
      obs.push(
        await prisma.observation.create({
          data: {
            childId: alex.id,
            sessionId: sessionIds[i % sessionIds.length],
            conceptId: h.conceptId,
            prompt: "What is 17 - 9?",
            response: i === 0 ? "ten" : "eight",
            correctness: i !== 0,
            reasoningEvidence: ["explained method aloud"],
            reasoningPattern: h.type,
            createdAt: ago(20 - i * 3),
          },
        })
      );
    }
    await prisma.hypothesis.create({
      data: {
        childId: alex.id,
        type: h.type,
        description: h.description,
        confidence: h.confidence,
        status: h.status,
        conceptId: h.conceptId,
        createdAt: ago(20),
        supportingEvidence: { connect: obs.map((o) => ({ id: o.id })) },
      },
    });
  }

  // ── Knowledge graph ────────────────────────────────────────────────────────
  const nodes = [
    ["INTEREST", "rockets", "Alex is very into rockets and launches; he asks about them often.", 0.95, 0.7, 9],
    ["INTEREST", "drawing", "Alex draws most days, usually spaceships.", 0.9, 0.6, 6],
    ["INTEREST", "dogs", "Alex has a dog called Biscuit.", 0.88, 0.55, 4],
    ["PERSON", "Biscuit", "Alex's dog. Comes up in his examples a lot.", 0.9, 0.5, 4],
    ["PERSON", "Mia", "Alex's younger sister. He sometimes explains things to her.", 0.8, 0.5, 3],
    ["MISCONCEPTION", "digitwise subtraction", "Treats the two digits as separate numbers when subtracting.", 0.89, 0.95, 5],
    ["TEACHING_STRATEGY", "number line", "Going to ten first, then back the rest. This is what made it click.", 0.86, 0.9, 6],
    ["TEACHING_STRATEGY", "rocket countdown framing", "Counting down from a launch number holds his attention.", 0.7, 0.75, 3],
    ["REASONING_PATTERN", "counts on from the larger number", "Alex adds by starting at the bigger number rather than counting all.", 0.82, 0.7, 5],
    ["GOAL", "read a chapter book on his own", "Something Alex mentions wanting to do.", 0.75, 0.6, 2],
    ["EXPERIENCE", "built a model rocket", "Alex built one with his dad and talked about it for a whole session.", 0.85, 0.5, 2],
    ["CONCEPT", "cross-ten subtraction", "The thing Alex is currently working through.", 0.9, 0.95, 7],
  ] as const;

  const created: Record<string, string> = {};
  for (const [type, label, description, confidence, importance, evidenceCount] of nodes) {
    const n = await prisma.memoryNode.create({
      data: {
        childId: alex.id,
        type,
        label,
        description,
        confidence,
        importance,
        evidenceCount,
        firstObservedAt: ago(22),
        lastObservedAt: ago(2),
      },
    });
    created[label] = n.id;
    try {
      const vec = await embedText(`${label}. ${description}`);
      await prisma.$executeRawUnsafe(
        `UPDATE "MemoryNode" SET embedding = $1::vector WHERE id = $2`,
        `[${vec.join(",")}]`,
        n.id
      );
    } catch {
      // Embeddings are a nicety here; the demo works without them.
    }
  }

  const edges: [string, string, string][] = [
    ["cross-ten subtraction", "digitwise subtraction", "CAUSED_BY"],
    ["number line", "cross-ten subtraction", "IMPROVED_BY"],
    ["rocket countdown framing", "rockets", "EXPLAINED_BY"],
    ["digitwise subtraction", "cross-ten subtraction", "CONFUSES_WITH"],
    ["rockets", "drawing", "PREFERS"],
    ["Biscuit", "dogs", "INTERESTED_IN"],
  ];
  for (const [src, tgt, relationship] of edges) {
    if (!created[src] || !created[tgt]) continue;
    await prisma.memoryEdge.create({
      data: {
        sourceNodeId: created[src],
        targetNodeId: created[tgt],
        relationship: relationship as never,
        confidence: 0.85,
        evidenceCount: 3,
      },
    });
  }

  // ── Interventions: what has and hasn't worked ──────────────────────────────
  const interventions: [string, string, boolean, number][] = [
    ["number_line", "CHANGE_REPRESENTATION", true, 20],
    ["number_line", "CHANGE_REPRESENTATION", true, 13],
    ["number_line", "EXPLAIN", true, 9],
    ["number_line", "REINFORCE", true, 2],
    ["counters", "GIVE_EXAMPLE", false, 17],
    ["counters", "CHANGE_REPRESENTATION", false, 13],
    ["decompose_to_ten", "EXPLAIN", true, 5],
    ["decompose_to_ten", "PROBE", true, 2],
    ["story_framing", "GIVE_EXAMPLE", true, 17],
    ["count_back", "EXPLAIN", false, 21],
  ];
  for (const [strategy, action, successful, d] of interventions) {
    await prisma.intervention.create({
      data: {
        childId: alex.id,
        conceptId: "cross_ten_subtraction",
        action: action as never,
        strategy,
        successful,
        evaluatedAt: ago(d),
        createdAt: ago(d),
        rationale: successful ? "Alex followed it and got there" : "Did not land",
      },
    });
  }

  // ── Milestones ─────────────────────────────────────────────────────────────
  const events: [string, string, number][] = [
    ["MISCONCEPTION_DETECTED", "Noticed Alex subtracts digits separately when a problem crosses ten.", 20],
    ["MASTERY_REACHED", "Addition within 20 is secure — independent, retained, and transferred.", 13],
    ["TRANSFER_DEMONSTRATED", "Used the number line on an unfamiliar problem without being prompted.", 5],
    ["RETENTION_PASSED", "Still solid on subtraction within 10 a week later.", 2],
  ];
  for (const [type, summary, d] of events) {
    await prisma.learningEvent.create({
      data: {
        childId: alex.id,
        conceptId: "cross_ten_subtraction",
        type: type as never,
        summary,
        createdAt: ago(d),
      },
    });
  }

  const counts = await Promise.all([
    prisma.learnerSkillState.count({ where: { childId: alex.id } }),
    prisma.hypothesis.count({ where: { childId: alex.id } }),
    prisma.memoryNode.count({ where: { childId: alex.id } }),
    prisma.memoryEdge.count({ where: { source: { childId: alex.id } } }),
    prisma.observation.count({ where: { childId: alex.id } }),
    prisma.intervention.count({ where: { childId: alex.id } }),
    prisma.session.count({ where: { childId: alex.id } }),
  ]);
  console.log(
    `\nAlex seeded: skills=${counts[0]} hypotheses=${counts[1]} nodes=${counts[2]} ` +
      `edges=${counts[3]} observations=${counts[4]} interventions=${counts[5]} sessions=${counts[6]}`
  );
  console.log(`\n  dashboard: /children/${alex.id}`);
  console.log(`  conversation: /learn/${alex.id}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
