import { test } from "node:test";
import assert from "node:assert/strict";
import {
  designDiff,
  framesInFile,
  layoutFromFigma,
  layoutFromUnknown,
  parseFigmaUrl,
  piecesFromSource,
  screenWith,
} from "../src/lib/design/scene.ts";

test("figma links keep the file key and the frame id", () => {
  assert.deepEqual(parseFigmaUrl("https://www.figma.com/design/Ab12Cd34/Calendar?node-id=12-34"), {
    key: "Ab12Cd34",
    nodeId: "12:34",
  });
  assert.equal(parseFigmaUrl("https://example.com/design/Ab12Cd34/Calendar"), null);
  assert.equal(parseFigmaUrl("http://www.figma.com/design/Ab12Cd34/Calendar"), null);
});

test("a file lists the frames on each page", () => {
  const frames = framesInFile({
    children: [
      {
        type: "CANVAS",
        children: [
          { id: "1:2", name: "Week", type: "FRAME" },
          { id: "1:3", name: "Notes", type: "SECTION", children: [{ id: "1:4", name: "Day", type: "FRAME" }] },
        ],
      },
    ],
  });
  assert.deepEqual(frames, [
    { id: "1:2", name: "Week" },
    { id: "1:4", name: "Day" },
  ]);
});

test("a figma frame becomes movable pieces", () => {
  const layout = layoutFromFigma({
    id: "1:2",
    name: "Week",
    type: "FRAME",
    absoluteBoundingBox: { x: 100, y: 50, width: 400, height: 300 },
    children: [
      {
        id: "2:1",
        name: "Create",
        type: "INSTANCE",
        absoluteBoundingBox: { x: 120, y: 70, width: 96, height: 36 },
        children: [{ type: "TEXT", characters: "Create" }],
      },
    ],
  });
  assert.equal(layout?.name, "Week");
  assert.equal(layout?.pieces[0].text, "Create");
  assert.equal(layout?.pieces[0].kind, "button");
  assert.equal(layout?.pieces[0].x, 20);
  assert.equal(layout?.pieces[0].y, 20);
});

test("source text becomes a screen with a button and a card", () => {
  const layout = piecesFromSource(
    "src/app/calendar/page.tsx",
    `export function Page() {
      return <main><h1>Calendar</h1><Button>Create</Button><p>Team Sync</p></main>
    }`,
  );
  assert.equal(layout.name, "calendar");
  assert.equal(layout.pieces.some((piece) => piece.kind === "button" && piece.text === "Create"), true);
  assert.equal(layout.pieces.some((piece) => piece.text === "Team Sync"), true);
});

test("a move shows up as a design diff", () => {
  const layout = layoutFromUnknown({
    name: "Home",
    width: 800,
    height: 600,
    pieces: [{ id: "create", name: "Create", kind: "button", text: "Create", x: 20, y: 20, w: 80, h: 32 }],
  });
  assert.ok(layout);
  const before = screenWith(layout, { id: "a", source: "app", sourceLabel: "repo · page.tsx", repo: "a/b", path: "src/app/page.tsx" });
  const after = screenWith(
    { ...layout, pieces: [{ ...layout.pieces[0], x: 80 }] },
    { id: "b", source: "app", sourceLabel: before.sourceLabel, repo: "a/b", path: before.path },
  );
  assert.match(designDiff(before, after), /Create moved to 80, 20/);
});
