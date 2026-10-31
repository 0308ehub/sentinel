type LineKind = "same" | "removed" | "added";

interface DiffRow {
  kind: LineKind;
  text: string;
}

const PREFIX: Record<LineKind, string> = { same: " ", removed: "−", added: "+" };
const COLOR: Record<LineKind, string> = {
  same: "text-muted-foreground",
  removed: "bg-destructive/10 text-destructive",
  added: "bg-success/10 text-success",
};

/** Line diff by longest common subsequence, so unchanged lines show as context. */
function diffLines(before: string[], after: string[]): DiffRow[] {
  const lengths = before.map(() => after.map(() => 0));
  for (let i = before.length - 1; i >= 0; i--) {
    for (let j = after.length - 1; j >= 0; j--) {
      lengths[i]![j] =
        before[i] === after[j]
          ? 1 + (lengths[i + 1]?.[j + 1] ?? 0)
          : Math.max(lengths[i + 1]?.[j] ?? 0, lengths[i]?.[j + 1] ?? 0);
    }
  }
  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < before.length || j < after.length) {
    if (i < before.length && j < after.length && before[i] === after[j]) {
      rows.push({ kind: "same", text: before[i]! });
      i++;
      j++;
    } else if (j < after.length && (i >= before.length || (lengths[i]?.[j + 1] ?? 0) >= (lengths[i + 1]?.[j] ?? 0))) {
      rows.push({ kind: "added", text: after[j]! });
      j++;
    } else {
      rows.push({ kind: "removed", text: before[i]! });
      i++;
    }
  }
  return rows;
}

export function CodeDiff({ before, after }: { before: string; after: string }) {
  const rows = diffLines(before.split("\n"), after.split("\n"));
  return (
    <div className="mt-2 max-w-full overflow-x-auto rounded-md border bg-card font-mono text-[12px] leading-5">
      <div className="w-max min-w-full whitespace-pre">
        {rows.map((row, index) => (
          <div key={`${row.kind}-${index}`} className={`min-w-max px-3 py-0.5 ${COLOR[row.kind]}`}>
            <span className="mr-3 inline-block w-3 select-none text-center">{PREFIX[row.kind]}</span>
            {row.text || " "}
          </div>
        ))}
      </div>
    </div>
  );
}
