function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function withoutMarker(value: string, flag: string): string {
  const marker = new RegExp(`\\s*data-kismet-fix=(?:"${escapeRegExp(flag)}"|'${escapeRegExp(flag)}')`, "g");
  return value.replace(marker, "").replace(/\s+/g, " ").trim();
}

/** True when full file content differs only by the requested fix marker and whitespace. */
export function markerOnlyContent(original: string, changed: string, flag: string): boolean {
  const marker = new RegExp(`[ \\t]*data-kismet-fix=(?:"${escapeRegExp(flag)}"|'${escapeRegExp(flag)}')`, "g");
  const stripped = changed.replace(marker, "");
  return stripped === original || stripped.replace(/\s+/g, " ").trim() === original.replace(/\s+/g, " ").trim();
}

/** True when every patch changes only the requested data-kismet-fix marker. */
export function markerOnlyPatch(patches: (string | undefined)[], flag: string): boolean {
  if (patches.length === 0 || patches.some((patch) => !patch)) return false;
  let changed = false;
  return patches.every((patch) => {
    const removed: string[] = [];
    const added: string[] = [];
    for (const line of patch!.split("\n")) {
      if (line.startsWith("---") || line.startsWith("+++")) continue;
      if (line.startsWith("-")) removed.push(withoutMarker(line.slice(1), flag));
      if (line.startsWith("+")) added.push(withoutMarker(line.slice(1), flag));
    }
    if (removed.length === 0 && added.length === 0) return false;
    changed = true;
    return removed.length === added.length && removed.every((line, index) => line === added[index]);
  }) && changed;
}

/** Extracts the agent's explicit no-change reason from its final response. */
export function noChangeReason(text: string): string | null {
  const match = text.match(/(?:^|\n)NO CHANGE NEEDED:\s*([^\n]+)/i);
  return match?.[1]?.trim() || null;
}
