export interface CaptionLine {
  text: string;
  marks: string[];
}

const LEAD = /^(?:on the [^,]+,\s*)/i;
const LONG_PAREN = /\s*\([^)]{12,}\)/g;
const MARK = [
  /horizontal(?:,\s+[a-z]+){0,3}\s+row(?:\s+of\s+(?:rounded\s+)?(?:pill tabs?|pills?))?/i,
  /vertical list/i,
  /left-hand column/i,
  /full width/i,
  /status dot/i,
  /status line/i,
  /underline/i,
  /pill tabs?/i,
  /to the right/i,
];

/** Short caption lines for the version on screen. Each line marks the phrase that changed. */
export function captionLines(paragraph: string, limit = 4): CaptionLine[] {
  return splitClauses(paragraph)
    .slice(0, limit)
    .map((part) => {
      const text = tidy(part);
      return { text, marks: marksIn(text) };
    })
    .filter((line) => line.text.length > 0);
}

function splitClauses(paragraph: string): string[] {
  const sentences = paragraph.replace(/\s+/g, " ").match(/[^.!?]+/g) ?? [];
  const parts: string[] = [];
  for (const sentence of sentences) {
    const clean = sentence.trim();
    if (!clean) continue;
    if (clean.length <= 110) {
      parts.push(clean);
      continue;
    }
    const bits = clean.split(/,\s+(?=(?:and |each |with |so |while |where |then ))/i);
    for (const bit of bits) if (bit.trim()) parts.push(bit.trim());
  }
  return parts;
}

function tidy(text: string): string {
  const value = text.replace(LEAD, "").replace(LONG_PAREN, "").replace(/^(?:and|with)\s+/i, "").replace(/\s+/g, " ").trim();
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function marksIn(text: string): string[] {
  const found: string[] = [];
  for (const pattern of MARK) {
    const match = text.match(pattern);
    if (match?.[0] && !found.some((item) => item.toLowerCase() === match[0].toLowerCase())) found.push(match[0]);
  }
  return found.slice(0, 2);
}
