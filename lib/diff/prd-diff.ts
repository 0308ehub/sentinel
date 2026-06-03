import { diffLines } from "diff";

export interface DiffHunk {
  id: string;
  /** Line index in the ORIGINAL content where the hunk begins (0-indexed) */
  oldStart: number;
  /** Lines removed from original (empty = pure addition) */
  oldLines: string[];
  /** Lines added in proposal (empty = pure deletion) */
  newLines: string[];
  status: "pending" | "accepted" | "rejected";
}

export interface DiffState {
  proposedContent: string;
  hunks: DiffHunk[];
}

function extractLines(value: string, count: number): string[] {
  const lines = value.split("\n");
  // diffLines terminates each block with \n, so the last split element is "".
  // Remove it to get the actual line array.
  if (lines[lines.length - 1] === "") lines.pop();
  // Clamp to count in case of edge cases
  return lines.slice(0, count);
}

export function computeHunks(oldContent: string, newContent: string): DiffHunk[] {
  const changes = diffLines(oldContent, newContent);
  const hunks: DiffHunk[] = [];
  let oldLineIndex = 0;
  let i = 0;

  while (i < changes.length) {
    const change = changes[i];

    if (!change.added && !change.removed) {
      oldLineIndex += change.count ?? 0;
      i++;
      continue;
    }

    const hunkOldStart = oldLineIndex;
    const removedLines: string[] = [];
    const addedLines: string[] = [];

    // Collect all consecutive removed blocks
    while (i < changes.length && changes[i].removed) {
      removedLines.push(...extractLines(changes[i].value, changes[i].count ?? 0));
      oldLineIndex += changes[i].count ?? 0;
      i++;
    }

    // Collect all consecutive added blocks (may follow removed, or stand alone)
    while (i < changes.length && changes[i].added) {
      addedLines.push(...extractLines(changes[i].value, changes[i].count ?? 0));
      i++;
    }

    if (removedLines.length > 0 || addedLines.length > 0) {
      hunks.push({
        id: `hunk-${hunks.length}`,
        oldStart: hunkOldStart,
        oldLines: removedLines,
        newLines: addedLines,
        status: "pending",
      });
    }
  }

  return hunks;
}

/**
 * Reconstructs working content by applying each hunk based on its current status.
 * Accepted hunks replace oldLines with newLines; rejected/pending keep oldLines.
 * Processes hunks in reverse order to avoid index shifting.
 */
export function applyHunks(originalContent: string, hunks: DiffHunk[]): string {
  const lines = originalContent.split("\n");
  const sortedHunks = [...hunks].sort((a, b) => b.oldStart - a.oldStart);

  for (const hunk of sortedHunks) {
    if (hunk.status === "accepted") {
      lines.splice(hunk.oldStart, hunk.oldLines.length, ...hunk.newLines);
    }
    // rejected or pending: keep original lines, no splice needed
  }

  return lines.join("\n");
}
