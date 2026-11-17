import "server-only";

import { askForJson, readJson } from "@/lib/ai/respond";
import { editIntent, layoutFromUnknown, type Layout, type Screen } from "@/lib/design/scene";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["message", "makeVariant", "name", "width", "height", "pieces"],
  properties: {
    message: { type: "string" },
    makeVariant: { type: "boolean" },
    name: { type: "string" },
    width: { type: "number" },
    height: { type: "number" },
    pieces: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "name", "kind", "text", "x", "y", "w", "h"],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          kind: { type: "string", enum: ["text", "button", "card", "input", "image", "row"] },
          text: { type: "string" },
          x: { type: "number" },
          y: { type: "number" },
          w: { type: "number" },
          h: { type: "number" },
        },
      },
    },
  },
};

export async function editScreen(screen: Screen, prompt: string, selectedId: string): Promise<{ message: string; makeVariant: boolean; layout: Layout }> {
  const text = await askForJson(
    [
      "You edit a product screen made of pieces on a canvas.",
      "Return JSON with message, makeVariant, name, width, height, and pieces.",
      "Keep the id of any piece you only move, resize, or rewrite.",
      "makeVariant is true only when the user asked for a variant, an alternate, or another version.",
      "message is one or two sentences about what changed. Do not claim a metric moved.",
      "Keep width and height unless the user asked to change the frame.",
      "If a selected piece id is given, and the user says this or the selected piece, change that piece.",
      "Stay near the frame. At most 36 pieces.",
    ].join(" "),
    [
      selectedId ? `Selected piece id: ${selectedId}` : "Selected piece id: none",
      `Ask: ${prompt}`,
      JSON.stringify({ name: screen.name, width: screen.width, height: screen.height, pieces: screen.pieces }),
    ].join("\n\n"),
    false,
    SCHEMA,
    "experiment",
  );
  const raw = readJson<unknown>(text);
  const layout = layoutFromUnknown(raw);
  if (!layout) throw new Error("The edit did not return a screen.");
  return { ...editIntent(raw), layout };
}
