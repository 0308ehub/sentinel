import type { ParsedDocument } from "@/types";

export function parseTxt(input: Buffer | string): ParsedDocument {
  const text = Buffer.isBuffer(input) ? input.toString("utf-8") : input;
  return { text: text.trim() };
}

export function supportsTxt(fileType: string): boolean {
  return fileType === "txt" || fileType === "text/plain";
}
