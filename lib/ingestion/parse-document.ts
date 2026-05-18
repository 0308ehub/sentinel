import type { ParsedDocument } from "@/types";
import { parseTxt, supportsTxt } from "./parsers/txt-parser";
import { parseMarkdown, supportsMarkdown } from "./parsers/markdown-parser";
import { parsePdf, supportsPdf } from "./parsers/pdf-parser";
import { parseCsv, supportsCsv } from "./parsers/csv-parser";

export async function parseDocumentContent(
  input: Buffer | string,
  fileType: string
): Promise<ParsedDocument> {
  const type = fileType.toLowerCase();

  if (supportsTxt(type)) return parseTxt(input);
  if (supportsMarkdown(type)) return parseMarkdown(input);
  if (supportsPdf(type)) return parsePdf(input as Buffer);
  if (supportsCsv(type)) return parseCsv(input);

  // Fallback: treat as plain text
  const text = Buffer.isBuffer(input) ? input.toString("utf-8") : input;
  return { text: text.trim() };
}
