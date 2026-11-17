export type PieceKind = "text" | "button" | "card" | "input" | "image" | "row";

export interface Piece {
  id: string;
  name: string;
  kind: PieceKind;
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Layout {
  name: string;
  width: number;
  height: number;
  pieces: Piece[];
}

export interface Screen extends Layout {
  id: string;
  source: "app" | "figma";
  sourceLabel: string;
  repo: string;
  path: string;
  figmaUrl: string;
}

export interface FigmaBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FigmaNode {
  id?: string;
  name?: string;
  type?: string;
  characters?: string;
  absoluteBoundingBox?: FigmaBox;
  children?: FigmaNode[];
}

const KINDS = new Set<PieceKind>(["text", "button", "card", "input", "image", "row"]);

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function parseFigmaUrl(value: string): { key: string; nodeId: string } | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.hostname !== "www.figma.com" && url.hostname !== "figma.com") return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] !== "design" && parts[0] !== "file" && parts[0] !== "proto") return null;
  const key = parts[1] ?? "";
  if (!/^[A-Za-z0-9]+$/.test(key)) return null;
  const raw = url.searchParams.get("node-id") ?? "";
  if (raw && !/^[0-9:;A-Za-z-]+$/.test(raw)) return null;
  const nodeId = raw ? decodeURIComponent(raw).replace(/-/g, ":") : "";
  if (nodeId.length > 80) return null;
  return { key, nodeId };
}

export function framesInFile(document: FigmaNode | undefined): { id: string; name: string }[] {
  const frames: { id: string; name: string }[] = [];
  for (const page of document?.children ?? []) {
    for (const child of page.children ?? []) {
      if (child.type === "SECTION") {
        for (const frame of child.children ?? []) pushFrame(frames, frame);
      } else {
        pushFrame(frames, child);
      }
    }
  }
  return frames.slice(0, 30);
}

export function layoutFromFigma(node: FigmaNode): Layout | null {
  const box = node.absoluteBoundingBox;
  if (!box || box.width < 8 || box.height < 8) return null;
  let children = (node.children ?? []).filter(hasBox);
  const only = children[0];
  if (
    children.length === 1 &&
    only?.absoluteBoundingBox &&
    only.children?.some(hasBox) &&
    covers(box, only.absoluteBoundingBox)
  ) {
    children = only.children.filter(hasBox);
  }
  if (children.length === 0) children = [node];
  const pieces = children.slice(0, 36).map((child, index) => {
    const bounds = child.absoluteBoundingBox ?? box;
    const text = textFromFigma(child);
    const name = clip(child.name, 80) || text || "Piece";
    return {
      id: child.id || `${slugId(name)}-${index}`,
      name,
      kind: kindFromFigma(child),
      text: text || name,
      x: bounds.x - box.x,
      y: bounds.y - box.y,
      w: bounds.width,
      h: bounds.height,
    };
  });
  return layoutFromUnknown({ name: clip(node.name, 80) || "Frame", width: box.width, height: box.height, pieces });
}

export function piecesFromSource(filePath: string, source: string): Layout {
  const fileName = screenName(filePath);
  const labels = visibleLabels(source);
  const buttons = new Set(buttonLabels(source));
  const pieces: Piece[] = [];
  const heading = labels[0] ?? "";
  let y = 28;
  if (heading) {
    pieces.push(makePiece("title", "Title", "text", heading, 32, y, 480, 40));
    y += 56;
  }
  const actions = labels.filter((label) => label !== heading && (buttons.has(label) || isAction(label))).slice(0, 4);
  let x = 32;
  for (const label of actions) {
    pieces.push(makePiece(label, label, "button", label, x, y, Math.min(200, 28 + label.length * 8), 36));
    x += Math.min(200, 28 + label.length * 8) + 12;
  }
  if (actions.length > 0) y += 56;
  const rest = labels.filter((label) => label !== heading && !actions.includes(label)).slice(0, 12);
  rest.forEach((label, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    pieces.push(makePiece(label, label, "card", label, 32 + col * 300, y + row * 124, 280, 104));
  });
  const height = Math.max(640, y + Math.ceil(rest.length / 3) * 124 + 32);
  if (pieces.length === 0) {
    pieces.push(makePiece(fileName, fileName, "card", fileName, 32, 32, 360, 96));
  }
  return layoutFromUnknown({ name: fileName, width: 960, height, pieces }) ?? {
    name: fileName,
    width: 960,
    height: 640,
    pieces,
  };
}

export function layoutFromUnknown(raw: unknown): Layout | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;
  const rows = Array.isArray(body.pieces) ? body.pieces : [];
  const pieces: Piece[] = [];
  const seen = new Set<string>();
  for (const item of rows.slice(0, 36)) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const text = clip(row.text, 240);
    const name = clip(row.name, 80) || text || "Piece";
    let id = slugId(clip(row.id, 60) || name);
    while (seen.has(id)) id = `${id}-${pieces.length + 1}`;
    seen.add(id);
    const kind = KINDS.has(row.kind as PieceKind) ? (row.kind as PieceKind) : guessKind(name, text);
    pieces.push({
      id,
      name,
      kind,
      text: text || name,
      x: number(row.x, 24),
      y: number(row.y, 24),
      w: clamp(number(row.w, 160), 24, 1200),
      h: clamp(number(row.h, 40), 20, 800),
    });
  }
  if (pieces.length === 0) return null;
  const width = clamp(number(body.width, 960), 320, 2400);
  const height = clamp(number(body.height, 640), 240, 3200);
  return fit({ name: clip(body.name, 80) || "Screen", width, height, pieces });
}

export function editIntent(raw: unknown): { message: string; makeVariant: boolean } {
  const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    message: clip(body.message, 600) || "Updated the screen.",
    makeVariant: body.makeVariant === true,
  };
}

export function screenFromClient(raw: unknown): Screen | null {
  const layout = layoutFromUnknown(raw);
  if (!layout || !raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;
  const source = body.source === "figma" ? "figma" : body.source === "app" ? "app" : null;
  const id = clip(body.id, 80);
  if (!source || !id) return null;
  return {
    ...layout,
    id,
    source,
    sourceLabel: clip(body.sourceLabel, 200),
    repo: clip(body.repo, 140),
    path: clip(body.path, 220),
    figmaUrl: clip(body.figmaUrl, 500),
  };
}

export function screenWith(
  layout: Layout,
  fields: { id: string; source: Screen["source"]; sourceLabel: string; repo?: string; path?: string; figmaUrl?: string },
): Screen {
  return {
    ...layout,
    id: fields.id,
    source: fields.source,
    sourceLabel: fields.sourceLabel.slice(0, 200),
    repo: fields.repo ?? "",
    path: fields.path ?? "",
    figmaUrl: fields.figmaUrl ?? "",
  };
}

export function cloneScreen(screen: Screen, id: string): Screen {
  return { ...screen, id, pieces: screen.pieces.map((piece) => ({ ...piece })) };
}

export function designDiff(before: Screen, after: Screen): string {
  const previous = new Map(before.pieces.map((piece) => [piece.id, piece]));
  const next = new Map(after.pieces.map((piece) => [piece.id, piece]));
  const lines: string[] = [];
  for (const piece of after.pieces) {
    const old = previous.get(piece.id);
    if (!old) {
      lines.push(`Added ${piece.name} ("${piece.text}") at ${Math.round(piece.x)}, ${Math.round(piece.y)}.`);
      continue;
    }
    const moved = Math.abs(old.x - piece.x) > 2 || Math.abs(old.y - piece.y) > 2;
    const resized = Math.abs(old.w - piece.w) > 2 || Math.abs(old.h - piece.h) > 2;
    const rewritten = old.text !== piece.text;
    if (!moved && !resized && !rewritten) continue;
    const bits: string[] = [];
    if (moved) bits.push(`moved to ${Math.round(piece.x)}, ${Math.round(piece.y)}`);
    if (resized) bits.push(`resized to ${Math.round(piece.w)}×${Math.round(piece.h)}`);
    if (rewritten) bits.push(`text is now "${piece.text}"`);
    lines.push(`${piece.name} ${bits.join(", ")}.`);
  }
  for (const piece of before.pieces) {
    if (!next.has(piece.id)) lines.push(`Removed ${piece.name}.`);
  }
  return lines.slice(0, 40).join("\n");
}

export function screenBrief(screen: Screen, diff: string): string {
  const lines = [
    `Screen: ${screen.name}`,
    `Source: ${screen.sourceLabel}`,
    ...screen.pieces.slice(0, 24).map((piece) => `${piece.name} (${piece.kind}): ${piece.text}`),
  ];
  if (diff) lines.push("", "Changes from the imported screen:", diff);
  return lines.join("\n").slice(0, 4000);
}

function pushFrame(frames: { id: string; name: string }[], node: FigmaNode) {
  if (!node.id || !node.name) return;
  if (node.type !== "FRAME" && node.type !== "COMPONENT" && node.type !== "COMPONENT_SET") return;
  frames.push({ id: node.id, name: node.name.slice(0, 80) });
}

function hasBox(node: FigmaNode): boolean {
  const box = node.absoluteBoundingBox;
  return Boolean(box && box.width >= 8 && box.height >= 8);
}

function covers(parent: FigmaBox, child: FigmaBox): boolean {
  return child.width > parent.width * 0.85 && child.height > parent.height * 0.85;
}

function textFromFigma(node: FigmaNode): string {
  if (node.type === "TEXT" && node.characters?.trim()) return node.characters.trim().slice(0, 240);
  for (const child of node.children ?? []) {
    const text = textFromFigma(child);
    if (text) return text;
  }
  return "";
}

function kindFromFigma(node: FigmaNode): PieceKind {
  const name = (node.name ?? "").toLowerCase();
  if (node.type === "TEXT") return "text";
  if (/button|btn|cta/.test(name) || isAction(node.name ?? "")) return "button";
  if (/input|field|search|textarea/.test(name)) return "input";
  if (node.type === "VECTOR" || node.type === "ELLIPSE" || node.type === "LINE" || node.type === "BOOLEAN_OPERATION") {
    return "image";
  }
  if (node.type === "FRAME" || node.type === "INSTANCE" || node.type === "COMPONENT" || node.type === "GROUP") return "card";
  return "row";
}

function visibleLabels(source: string): string[] {
  const found: string[] = [];
  const patterns = [
    />([^<>{}\n][^<>{}]{0,80})</g,
    /(?:placeholder|aria-label|title|alt)="([^"]{2,80})"/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const text = match[1].replace(/\s+/g, " ").trim();
      if (text.length < 2 || text.length > 80 || /[{}=]/.test(text)) continue;
      found.push(text);
    }
  }
  return [...new Set(found)].slice(0, 16);
}

function buttonLabels(source: string): string[] {
  const found: string[] = [];
  for (const match of source.matchAll(/<(?:Button|button)\b[^>]*>([^<]{1,40})<\//g)) {
    const text = match[1].replace(/\s+/g, " ").trim();
    if (text && !text.includes("{")) found.push(text);
  }
  return found;
}

function screenName(filePath: string): string {
  const parts = filePath.split("/").filter(Boolean);
  const file = parts.pop()?.replace(/\.(tsx|jsx)$/, "") || "Screen";
  const parent = parts[parts.length - 1];
  if ((file === "page" || file === "index") && parent && parent !== "app" && parent !== "src" && parent !== "pages") {
    return parent;
  }
  return file;
}

function isAction(label: string): boolean {
  return label.length <= 22 && /^(create|add|new|save|search|upgrade|invite|share|edit|delete|cancel|next|back|today|week)\b/i.test(label);
}

function makePiece(id: string, name: string, kind: PieceKind, text: string, x: number, y: number, w: number, h: number): Piece {
  return { id: slugId(id), name, kind, text, x, y, w, h };
}

function guessKind(name: string, text: string): PieceKind {
  const value = `${name} ${text}`.toLowerCase();
  if (/button|btn|cta/.test(value) || isAction(text)) return "button";
  if (/input|search|field/.test(value)) return "input";
  if (text.length > 42) return "card";
  return "text";
}

function fit(layout: Layout): Layout {
  const scale = Math.min(1, 1200 / layout.width, 1600 / layout.height);
  const width = Math.round(layout.width * scale);
  const height = Math.round(layout.height * scale);
  return {
    name: layout.name,
    width,
    height,
    pieces: layout.pieces.map((piece) => ({
      ...piece,
      x: clamp(Math.round(piece.x * scale), -40, Math.max(0, width - 20)),
      y: clamp(Math.round(piece.y * scale), -40, Math.max(0, height - 20)),
      w: clamp(Math.round(piece.w * scale), 24, 1200),
      h: clamp(Math.round(piece.h * scale), 20, 800),
    })),
  };
}

function slugId(value: string): string {
  const clean = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return clean || "piece";
}

function clip(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function number(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
