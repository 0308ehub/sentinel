import { screenFromClient, type Screen } from "./scene.ts";

export interface DesignNote {
  id: string;
  role: "user" | "assistant";
  text: string;
}

export interface DesignDraft {
  original: Screen | null;
  versions: Screen[];
  activeId: string;
  notes: DesignNote[];
}

const KEY = "kismet-design";
const EMPTY: DesignDraft = { original: null, versions: [], activeId: "", notes: [] };

let last: string | null = null;
const changes = new Set<() => void>();
const external = new Set<() => void>();

function isNote(value: unknown): value is DesignNote {
  if (!value || typeof value !== "object") return false;
  const note = value as DesignNote;
  return (note.role === "user" || note.role === "assistant") && typeof note.text === "string" && typeof note.id === "string";
}

export function parseDesignDraft(value: unknown): DesignDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return EMPTY;
  const record = value as Partial<DesignDraft>;
  const versions = Array.isArray(record.versions)
    ? record.versions.map(screenFromClient).filter((screen): screen is Screen => Boolean(screen))
    : [];
  const notes = Array.isArray(record.notes) ? record.notes.filter(isNote).slice(-40) : [];
  return {
    original: screenFromClient(record.original),
    versions,
    activeId: typeof record.activeId === "string" ? record.activeId : "",
    notes,
  };
}

export function designDraftIsEmpty(draft: DesignDraft): boolean {
  return draft.original === null && draft.versions.length === 0 && draft.notes.length === 0;
}

function remember(): void {
  if (last !== null || typeof window === "undefined") return;
  last = localStorage.getItem(KEY);
}

function commit(draft: DesignDraft, broadcast: boolean): void {
  if (typeof window === "undefined") return;
  remember();
  const next = JSON.stringify({
    original: draft.original,
    versions: draft.versions,
    activeId: draft.activeId,
    notes: draft.notes.slice(-40),
  });
  if (next === last) return;
  last = next;
  localStorage.setItem(KEY, next);
  changes.forEach((listener) => listener());
  if (broadcast) external.forEach((listener) => listener());
}

export function readDesignDraft(): DesignDraft {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    return parseDesignDraft(raw ? JSON.parse(raw) : null);
  } catch {
    return EMPTY;
  }
}

export function writeDesignDraft(draft: DesignDraft): void {
  commit(draft, false);
}

export function replaceDesignDraft(data: unknown): void {
  commit(parseDesignDraft(data), true);
}

export function resetDesignDraft(): void {
  commit(EMPTY, true);
}

export function subscribeDesignDraft(listener: () => void): () => void {
  changes.add(listener);
  return () => changes.delete(listener);
}

export function subscribeDesignExternal(listener: () => void): () => void {
  external.add(listener);
  return () => external.delete(listener);
}
