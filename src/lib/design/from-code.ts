import "server-only";

import { askForJson, readJson } from "@/lib/ai/respond";
import { layoutFromUnknown, piecesFromSource, type Layout } from "@/lib/design/scene";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["name", "width", "height", "pieces"],
  properties: {
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

export async function layoutFromCode(path: string, content: string): Promise<Layout> {
  const fallback = piecesFromSource(path, content);
  try {
    const text = await askForJson(
      [
        "Turn one React file into a flat screen a designer can drag.",
        "Return JSON with name, width, height, and pieces.",
        "Each piece is a visible block: text, button, card, input, image, or row.",
        "Use the words that appear in the file. Do not invent a different product.",
        "Coordinates are pixels from the top left of a frame about 960 by 640.",
        "At most 24 pieces. Skip wrappers that only group other pieces.",
        "id is a short stable slug. name is the layer name. text is what a person sees.",
      ].join(" "),
      `FILE ${path}\n${content.slice(0, 20_000)}`,
      false,
      SCHEMA,
      "experiment",
    );
    return layoutFromUnknown(readJson<unknown>(text)) ?? fallback;
  } catch {
    return fallback;
  }
}
