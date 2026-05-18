import Papa from "papaparse";
import type { ParsedDocument } from "@/types";

export function parseCsv(input: Buffer | string): ParsedDocument {
  const text = Buffer.isBuffer(input) ? input.toString("utf-8") : input;
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  const columns = result.meta.fields ?? [];
  const rows = result.data;

  // Convert each row into a readable text block
  const textBlocks = rows.map((row, i) => {
    const lines = columns.map((col) => `${col}: ${row[col] ?? ""}`);
    return `Row ${i + 1}:\n${lines.join("\n")}`;
  });

  return {
    text: textBlocks.join("\n\n"),
    metadata: {
      columns,
      rowCount: rows.length,
    },
  };
}

export function supportsCsv(fileType: string): boolean {
  return (
    fileType === "csv" ||
    fileType === "text/csv" ||
    fileType === "application/csv"
  );
}
