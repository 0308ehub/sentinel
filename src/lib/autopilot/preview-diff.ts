const MAX_ADDED_TEXTS = 6;

export function normalizePreviewCondition(when: string): string {
  const trimmed = when.trim();
  const lowerFirst = trimmed ? `${trimmed[0].toLocaleLowerCase()}${trimmed.slice(1)}` : "";
  return lowerFirst.replace(/^only\s+/i, "").replace(/[.!?]+$/, "");
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function looksLikeUiCopy(value: string): boolean {
  const text = normalizeText(value);
  return text.length >= 12
    && text.length <= 300
    && /[A-Za-z]/.test(text)
    && /\s/.test(text)
    && !/^(?:https?:\/\/|\/|\.\.?\/|@)[^\s]+$/.test(text)
    && !/^ap-[a-z0-9-]+-v\d+$/i.test(text);
}

function jsxTextOnLine(line: string): string | null {
  if (/^\s*(?:import|export)\b/.test(line) || /[{}=]/.test(line.replace(/<[^>]*>/g, ""))) return null;
  const withoutTags = line.replace(/<[^>]*>/g, " ");
  const text = normalizeText(withoutTags);
  return looksLikeUiCopy(text) ? text : null;
}

/** Text sitting between tags on a mixed line, e.g. `{show ? <button>Propose feature</button> : null}`. */
function inlineTagTexts(line: string): string[] {
  const results: string[] = [];
  for (const match of line.matchAll(/>([^<>{}]+)</g)) {
    const text = normalizeText(match[1]);
    // Buttons and links are often one or two words, so this allows short labels.
    if (text.length >= 3 && text.length <= 300 && /[A-Za-z]{2}/.test(text)) results.push(text);
  }
  return results;
}

function stringLiteralsOnLine(line: string): string[] {
  if (/^\s*(?:import|export)\b/.test(line) || /\b(?:className|class)\s*=/.test(line)) return [];
  const results: string[] = [];
  const literal = /(["'`])((?:\\.|(?!\1).)*)\1/g;
  for (const match of line.matchAll(literal)) {
    const value = match[2].replace(/\\(["'`])/g, "$1");
    if (looksLikeUiCopy(value) && !/^https?:\/\//i.test(value)) results.push(normalizeText(value));
  }
  return results;
}

export function addedTextFromPatch(patches: string[]): string[] {
  const found: string[] = [];
  let paragraph: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length) found.push(normalizeText(paragraph.join(" ")));
    paragraph = [];
  };

  for (const patch of patches) {
    for (const rawLine of patch.split("\n")) {
      if (!rawLine.startsWith("+") || rawLine.startsWith("+++")) {
        flushParagraph();
        continue;
      }
      const line = rawLine.slice(1);
      const jsxText = jsxTextOnLine(line);
      if (jsxText) {
        paragraph.push(jsxText);
        continue;
      }
      flushParagraph();
      found.push(...inlineTagTexts(line));
      found.push(...stringLiteralsOnLine(line));
    }
    flushParagraph();
  }

  return [...new Set(found.filter((text) => text.length >= 3))].slice(0, MAX_ADDED_TEXTS);
}

export function textDifference(controlTexts: string[], treatmentTexts: string[]): {
  onlyInTreatment: string[];
  onlyInControl: string[];
} {
  const control = controlTexts.map(normalizeText).filter(Boolean);
  const treatment = treatmentTexts.map(normalizeText).filter(Boolean);
  const unmatchedTreatment = [...treatment];
  const onlyInControl: string[] = [];

  for (const text of control) {
    const match = unmatchedTreatment.indexOf(text);
    if (match === -1) onlyInControl.push(text);
    else unmatchedTreatment.splice(match, 1);
  }

  return { onlyInTreatment: unmatchedTreatment, onlyInControl };
}

/** Width to apply so an unchanged select does not resize between the two snapshots. */
export function unchangedSelectWidth(controlWidth: number, treatmentWidth: number, sameLabel: boolean): number | null {
  if (!sameLabel || !(controlWidth > 0) || !(treatmentWidth > 0)) return null;
  if (Math.abs(controlWidth - treatmentWidth) < 2) return null;
  return controlWidth;
}
