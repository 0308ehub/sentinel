import assert from "node:assert/strict";
import test from "node:test";

import { captionLines } from "../src/lib/autopilot/caption.ts";

const before = "On the Dashboard, Sessions sit in a vertical list in a left-hand column, and each session shows its title with a status line underneath (Working, PR is ready, or Review PR). The inbox sits to the right of that column.";
const after = "Sessions now run as a horizontal, scrollable row of rounded pill tabs across the top of the Dashboard, each showing the experiment name, a small colored status dot and its label, with an underline under the selected tab. The inbox table below now spans the full width of the page.";

test("captionLines turns the current version into short marked bullets", () => {
  const lines = captionLines(before);
  assert.deepEqual(lines.map((line) => line.text), [
    "Sessions sit in a vertical list in a left-hand column",
    "Each session shows its title with a status line underneath",
    "The inbox sits to the right of that column",
  ]);
  assert.deepEqual(lines[0].marks, ["vertical list", "left-hand column"]);
  assert.deepEqual(lines[1].marks, ["status line"]);
  assert.deepEqual(lines[2].marks, ["to the right"]);
});

test("captionLines turns the new version into short marked bullets", () => {
  const lines = captionLines(after);
  assert.deepEqual(lines.map((line) => line.text), [
    "Sessions now run as a horizontal, scrollable row of rounded pill tabs across the top of the Dashboard",
    "Each showing the experiment name, a small colored status dot and its label",
    "An underline under the selected tab",
    "The inbox table below now spans the full width of the page",
  ]);
  assert.equal(lines[0].marks[0], "horizontal, scrollable row of rounded pill tabs");
  assert.deepEqual(lines[1].marks, ["status dot"]);
  assert.deepEqual(lines[2].marks, ["underline"]);
  assert.deepEqual(lines[3].marks, ["full width"]);
});
