export type FixVerificationDecision =
  | { verdict: "not_fixed"; complaints: number }
  | { verdict: "fixed"; complaints: 0 }
  | null;

export function decideFixVerification(input: {
  startedAt: string;
  now: string;
  complaints: Array<{ author: string }>;
}): FixVerificationDecision {
  const people = new Set(input.complaints.map((item) => item.author.trim().toLowerCase()).filter(Boolean));
  if (people.size >= 2) return { verdict: "not_fixed", complaints: input.complaints.length };
  const ageDays = (Date.parse(input.now) - Date.parse(input.startedAt)) / 86_400_000;
  if (ageDays >= 14 && input.complaints.length === 0) return { verdict: "fixed", complaints: 0 };
  return null;
}
