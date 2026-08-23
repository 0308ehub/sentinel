import Anthropic from "@anthropic-ai/sdk";
import type { PlannerOutput, LearnerContext } from "@/lib/shared/types";

const TUTOR_MODEL = "claude-sonnet-5";

const SYSTEM = `You are Nova, a warm and curious AI mentor talking with a young child (age 5-9).

HOW YOU SPEAK
- Short sentences. Simple words. One idea at a time.
- Warm and encouraging, never gushing or saccharine.
- Ask ONE question per turn, never a list of questions.
- 1-3 sentences unless you are telling a very short story.
- Use the child's name occasionally, not every turn.

WHAT YOU NEVER DO
- Never reveal how you work. Never say "hypothesis", "concept", "planner",
  "confidence", "assessment", or any internal mechanic.
- Never claim to be human. If asked, say plainly and kindly that you are a computer
  program that likes learning together.
- Never encourage secrecy from parents.
- Never ask for personal identifying information — address, school, phone number.
- Never shame a wrong answer. Wrong answers are interesting information.

You will receive a PEDAGOGICAL GOAL describing what this turn should accomplish.
Express it naturally as something a kind tutor would actually say. Do not narrate
the goal itself — perform it.`;

function actionGuidance(p: PlannerOutput): string {
  switch (p.next_action) {
    case "PROBE":
      return "Ask one specific question that will reveal how the child is thinking.";
    case "EXPLAIN":
      return "Explain the idea simply and concretely, then check understanding with a short question.";
    case "GIVE_EXAMPLE":
      return "Walk through one clear worked example, thinking out loud as you go.";
    case "ASK_CHILD_TO_EXPLAIN":
      return "Warmly invite the child to describe how they worked it out. Show genuine curiosity.";
    case "REINFORCE":
      return "Acknowledge what they did well, specifically, then offer one similar problem.";
    case "REVIEW":
      return "Gently revisit the earlier idea without making it feel like going backwards.";
    case "ADVANCE":
      return "Introduce the next idea with a little excitement.";
    case "CHANGE_REPRESENTATION":
      return `Switch to a different way of showing it${p.strategy ? ` — use the ${p.strategy.replace(/_/g, " ")}` : ""}. Describe it vividly so the child can picture it.`;
  }
}

export interface TutorTurnInput {
  planner: PlannerOutput;
  context: LearnerContext;
}

/** Streams the child-facing turn. Yields text chunks. */
export async function* streamTutorResponse(input: TutorTurnInput): AsyncGenerator<string> {
  const { planner, context } = input;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const recent = context.recentTranscript
    .slice(-6)
    .map((m) => `${m.role === "CHILD" ? context.childName : "Nova"}: ${m.content}`)
    .join("\n");

  const prompt = [
    `CHILD: ${context.childName}, age ${context.ageYears}`,
    context.interests.length ? `INTERESTS: ${context.interests.join(", ")}` : "",
    recent ? `\nRECENT CONVERSATION:\n${recent}` : "",
    `\nPEDAGOGICAL GOAL FOR THIS TURN: ${planner.response_goal}`,
    `HOW TO APPROACH IT: ${actionGuidance(planner)}`,
    planner.observation ? `\nWHAT YOU JUST NOTICED (do not say this aloud): ${planner.observation}` : "",
    `\nNow say your next turn to ${context.childName}.`,
  ]
    .filter(Boolean)
    .join("\n");

  const stream = await client.messages.create({
    model: TUTOR_MODEL,
    max_tokens: 400,
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
    stream: true,
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }
}
