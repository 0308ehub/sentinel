import type { ParsedDocument } from "@/types";

export function parseMarkdown(input: Buffer | string): ParsedDocument {
  const text = Buffer.isBuffer(input) ? input.toString("utf-8") : input;
  // Extract first heading as title
  const titleMatch = text.match(/^#\s+(.+)$/m);
  return {
    title: titleMatch?.[1]?.trim(),
    text: text.trim(),
    metadata: { format: "markdown" },
  };
}

export function supportsMarkdown(fileType: string): boolean {
  return fileType === "md" || fileType === "markdown" || fileType === "text/markdown";
}
