export type DiffRow = {
  kind: "context" | "add" | "del" | "hunk";
  oldLine?: number;
  newLine?: number;
  text: string;
};

type Edit = { kind: "context" | "add" | "del"; text: string };

export function unifiedDiff(path: string, before: string, after: string, context = 3): string {
  if (before === after) return "";
  const oldLines = lines(before);
  const newLines = lines(after);
  const edits = oldLines.length > 4000 || newLines.length > 4000
    ? [
        ...oldLines.map((text): Edit => ({ kind: "del", text })),
        ...newLines.map((text): Edit => ({ kind: "add", text })),
      ]
    : lcsEdits(oldLines, newLines);
  const hunks = makeHunks(edits, Math.max(0, context));
  const output = [`--- a/${path}`, `+++ b/${path}`];
  for (const hunk of hunks) {
    output.push(`@@ -${range(hunk.oldStart, hunk.oldCount)} +${range(hunk.newStart, hunk.newCount)} @@`);
    for (const edit of hunk.edits) output.push(`${edit.kind === "add" ? "+" : edit.kind === "del" ? "-" : " "}${edit.text}`);
  }
  return output.join("\n");
}

export function parsePatch(patch: string): DiffRow[] {
  const rows: DiffRow[] = [];
  let oldLine = 0;
  let newLine = 0;
  for (const line of patch.split("\n")) {
    const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (match) {
      oldLine = Number(match[1]);
      newLine = Number(match[3]);
      rows.push({ kind: "hunk", text: line });
    } else if (line.startsWith("+") && !line.startsWith("+++")) {
      rows.push({ kind: "add", newLine: newLine++, text: line.slice(1) });
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      rows.push({ kind: "del", oldLine: oldLine++, text: line.slice(1) });
    } else if (line.startsWith(" ")) {
      rows.push({ kind: "context", oldLine: oldLine++, newLine: newLine++, text: line.slice(1) });
    }
  }
  return rows;
}

function lines(value: string): string[] {
  if (!value) return [];
  const result = value.split("\n");
  if (result.at(-1) === "") result.pop();
  return result;
}

function lcsEdits(before: string[], after: string[]): Edit[] {
  const width = after.length + 1;
  const table = new Uint16Array((before.length + 1) * width);
  for (let i = before.length - 1; i >= 0; i -= 1) {
    for (let j = after.length - 1; j >= 0; j -= 1) {
      table[i * width + j] = before[i] === after[j]
        ? table[(i + 1) * width + j + 1] + 1
        : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
    }
  }
  const edits: Edit[] = [];
  let i = 0;
  let j = 0;
  while (i < before.length || j < after.length) {
    if (i < before.length && j < after.length && before[i] === after[j]) {
      edits.push({ kind: "context", text: before[i++] });
      j += 1;
    } else if (j < after.length && (i === before.length || table[i * width + j + 1] > table[(i + 1) * width + j])) {
      edits.push({ kind: "add", text: after[j++] });
    } else {
      edits.push({ kind: "del", text: before[i++] });
    }
  }
  return edits;
}

function makeHunks(edits: Edit[], context: number) {
  const changed = edits.flatMap((edit, index) => edit.kind === "context" ? [] : [index]);
  const groups: { start: number; end: number }[] = [];
  for (const index of changed) {
    const start = Math.max(0, index - context);
    const end = Math.min(edits.length, index + context + 1);
    const last = groups.at(-1);
    if (last && start <= last.end) last.end = Math.max(last.end, end);
    else groups.push({ start, end });
  }
  return groups.map(({ start, end }) => {
    let oldStart = 1;
    let newStart = 1;
    for (const edit of edits.slice(0, start)) {
      if (edit.kind !== "add") oldStart += 1;
      if (edit.kind !== "del") newStart += 1;
    }
    const selected = edits.slice(start, end);
    return {
      oldStart,
      newStart,
      oldCount: selected.filter((edit) => edit.kind !== "add").length,
      newCount: selected.filter((edit) => edit.kind !== "del").length,
      edits: selected,
    };
  });
}

function range(start: number, count: number): string {
  return count === 1 ? String(start) : `${count === 0 ? start - 1 : start},${count}`;
}
