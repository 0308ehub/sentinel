export interface TextChunk {
  index: number;
  content: string;
  tokenCount: number;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function chunkText(
  text: string,
  maxTokens = 800,
  overlapTokens = 120
): TextChunk[] {
  const paragraphs = text
    .split(/\n\s*\n/g)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: TextChunk[] = [];
  let current: string[] = [];
  let currentTokens = 0;

  for (const paragraph of paragraphs) {
    const paragraphTokens = estimateTokens(paragraph);

    if (currentTokens + paragraphTokens > maxTokens && current.length > 0) {
      const content = current.join("\n\n");
      chunks.push({ index: chunks.length, content, tokenCount: estimateTokens(content) });

      const overlapText = buildOverlap(current, overlapTokens);
      current = overlapText ? [overlapText, paragraph] : [paragraph];
      currentTokens = estimateTokens(current.join("\n\n"));
    } else {
      current.push(paragraph);
      currentTokens += paragraphTokens;
    }
  }

  if (current.length > 0) {
    const content = current.join("\n\n");
    chunks.push({ index: chunks.length, content, tokenCount: estimateTokens(content) });
  }

  return chunks;
}

function buildOverlap(paragraphs: string[], overlapTokens: number): string {
  const reversed = [...paragraphs].reverse();
  const selected: string[] = [];
  let tokens = 0;

  for (const paragraph of reversed) {
    const pTokens = estimateTokens(paragraph);
    if (tokens + pTokens > overlapTokens) break;
    selected.unshift(paragraph);
    tokens += pTokens;
  }

  return selected.join("\n\n");
}
