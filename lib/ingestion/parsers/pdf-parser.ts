import type { ParsedDocument } from "@/types";

export async function parsePdf(input: Buffer): Promise<ParsedDocument> {
  // Dynamic import to avoid issues in edge runtime
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfModule = (await import("pdf-parse")) as any;
  const pdfParse = pdfModule.default ?? pdfModule;
  const data = await pdfParse(input);

  return {
    text: data.text.trim(),
    metadata: {
      pageCount: data.numpages,
      info: data.info,
    },
  };
}

export function supportsPdf(fileType: string): boolean {
  return fileType === "pdf" || fileType === "application/pdf";
}
