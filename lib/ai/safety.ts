import Anthropic from "@anthropic-ai/sdk";

const SAFETY_MODEL = "claude-haiku-4-5-20251001";

export interface SafetyVerdict {
  safe: boolean;
  reason?: string;
  category?: string;
}

export const SAFE_FALLBACK_RESPONSE =
  "Let's keep going with our learning! Want to try another question with me?";

/**
 * Deterministic pre-filter. Cheap, runs first, catches the unambiguous cases.
 * Patterns are intentionally conservative — the classifier handles nuance.
 */
const HARD_PATTERNS: { pattern: RegExp; category: string }[] = [
  { pattern: /\b(kill|hurt|cut)\s+(my|your)self\b|\bsuicide\b|\bwant to die\b/i, category: "self_harm" },
  { pattern: /\b(home address|where do you live|what school|phone number|credit card)\b/i, category: "pii_solicitation" },
  { pattern: /\bdon'?t tell (your |my )?(mom|dad|parents|mum)\b|\bkeep .* secret from\b/i, category: "secrecy" },
  { pattern: /\b(sex|porn|naked|nude)\b/i, category: "sexual_content" },
  { pattern: /\b(gun|knife|weapon)\b.*\b(use|get|buy|make)\b/i, category: "violence" },
];

function hardCheck(text: string): SafetyVerdict | null {
  for (const { pattern, category } of HARD_PATTERNS) {
    if (pattern.test(text)) {
      return { safe: false, category, reason: `matched hard rule: ${category}` };
    }
  }
  return null;
}

async function classify(text: string, direction: "input" | "output"): Promise<SafetyVerdict> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const subject =
    direction === "input"
      ? "a message written by a child aged 5-9 to their AI tutor"
      : "a message an AI tutor is about to say to a child aged 5-9";

  const res = await client.messages.create({
    model: SAFETY_MODEL,
    max_tokens: 128,
    system:
      `You are a safety classifier for a children's education product. You will be given ${subject}. ` +
      `Reply with ONLY a JSON object: {"safe": boolean, "category": string|null, "reason": string|null}. ` +
      `Unsafe categories: self_harm, violence, sexual_content, pii_solicitation, secrecy, ` +
      `emotional_dependency, claims_to_be_human, off_domain. ` +
      `Ordinary school subjects, feelings, and childhood topics are SAFE. Be permissive about normal childhood talk.`,
    messages: [{ role: "user", content: text }],
  });

  const raw = res.content.find((b) => b.type === "text");
  const parsed = JSON.parse(
    (raw && "text" in raw ? raw.text : "{}").replace(/^[^{]*/, "").replace(/[^}]*$/, "")
  );
  return {
    safe: parsed.safe !== false,
    category: parsed.category ?? undefined,
    reason: parsed.reason ?? undefined,
  };
}

/** Screens what the child said before it reaches the planner. */
export async function checkChildInput(text: string): Promise<SafetyVerdict> {
  const hard = hardCheck(text);
  if (hard) return hard;
  try {
    return await classify(text, "input");
  } catch (err) {
    // Fail closed: an unavailable classifier must not open the gate.
    return {
      safe: false,
      category: "classifier_unavailable",
      reason: err instanceof Error ? err.message : "unknown classifier error",
    };
  }
}

/** Screens what the tutor is about to say before it reaches the child. */
export async function checkTutorOutput(text: string): Promise<SafetyVerdict> {
  const hard = hardCheck(text);
  if (hard) return hard;
  try {
    return await classify(text, "output");
  } catch (err) {
    return {
      safe: false,
      category: "classifier_unavailable",
      reason: err instanceof Error ? err.message : "unknown classifier error",
    };
  }
}
