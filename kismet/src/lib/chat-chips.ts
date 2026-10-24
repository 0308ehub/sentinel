export interface ChatChip {
  id: string;
  label: string;
  hint: string;
  prompt: string;
}

export const CHAT_CHIPS: ChatChip[] = [
  {
    id: "deepdive",
    label: "Deep dive",
    hint: "Longer, with the evidence laid out",
    prompt:
      "Deep dive mode. Write a thorough answer in short sections. Walk through the evidence, the tension, and what to do next. Do not stop at a one-line summary.",
  },
  {
    id: "financialfocus",
    label: "Financial focus",
    hint: "Revenue, cost, pricing, and what is worth building",
    prompt:
      "Financial focus. Frame the answer around revenue, cost, retention, pricing, and whether the work is worth it. Use a number only when it appears in the Slack excerpts. If it does not, say the number is not in what you can see.",
  },
  {
    id: "customer",
    label: "Customer",
    hint: "Start from the person with the problem",
    prompt:
      "Customer focus. Start from the person having the problem. Separate what customers said from what the team assumed.",
  },
  {
    id: "bug",
    label: "Bug",
    hint: "File what you are looking at",
    prompt:
      "Bug report. The client files this on the board from the message and the current page. Confirm the title and that it is on the board. Do not invent repro steps that were not in the message or the page.",
  },
  {
    id: "decision",
    label: "Decision",
    hint: "A recommendation and the alternative",
    prompt:
      "Decision mode. Close with a recommendation, the main alternative, and what evidence would change your mind.",
  },
];

const CHIP_IDS = new Set(CHAT_CHIPS.map((chip) => chip.id));

export function findChip(token: string): ChatChip | undefined {
  const id = token.trim().toLowerCase().replace(/^#/, "");
  return CHAT_CHIPS.find((chip) => chip.id === id);
}

export function chipQuery(text: string): string | null {
  const match = text.match(/(^|\s)#([a-z][\w-]*)$/i);
  return match ? match[2].toLowerCase() : null;
}

export function matchingChips(query: string): ChatChip[] {
  return CHAT_CHIPS.filter(
    (chip) => chip.id.includes(query) || chip.label.toLowerCase().includes(query)
  );
}

/** Pulls finished #tags out of the draft. A tag still being typed is left alone. */
export function pullChips(text: string, active: string[]): { text: string; chips: string[] } {
  const chips = [...active];
  let next = text.replace(/(^|\s)#([a-z][\w-]*)(?=\s)/gi, (match, lead: string, raw: string) => {
    const chip = findChip(raw);
    if (!chip) return match;
    if (!chips.includes(chip.id)) chips.push(chip.id);
    return lead;
  });
  next = next.replace(/[ \t]{2,}/g, " ");
  return { text: next, chips };
}

/** Also takes a known tag at the end of the draft, with no trailing space. */
export function pullChipsForSend(text: string, active: string[]): { text: string; chips: string[] } {
  const spaced = pullChips(text, active);
  const trailing = spaced.text.match(/(^|\s)#([a-z][\w-]*)$/i);
  if (!trailing) return { text: spaced.text.trim(), chips: spaced.chips };
  const chip = findChip(trailing[2]);
  if (!chip) return { text: spaced.text.trim(), chips: spaced.chips };
  const chips = spaced.chips.includes(chip.id) ? spaced.chips : [...spaced.chips, chip.id];
  const without = spaced.text.slice(0, spaced.text.length - trailing[0].length);
  return { text: without.replace(/\s+$/g, "").trim(), chips };
}

export function promptForChips(ids: string[]): string[] {
  return ids
    .filter((id) => CHIP_IDS.has(id))
    .map((id) => CHAT_CHIPS.find((chip) => chip.id === id)?.prompt)
    .filter((prompt): prompt is string => Boolean(prompt));
}

export function hasDeepDive(ids: string[]): boolean {
  return ids.includes("deepdive");
}
