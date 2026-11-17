export interface PageSight {
  path: string;
  title: string;
  text: string;
  at: string;
}

export interface WorkMemory {
  at: string;
  summary: string;
  key?: string;
}

const STORAGE_KEY = "kismet-work-context";
const MAX_PAGES = 8;
const MAX_MEMORY = 40;
const MAX_TEXT = 4000;
const DEDUPE_MS = 2 * 60 * 1000;

export interface StoredContext {
  pages: PageSight[];
  memory: WorkMemory[];
}

const listeners = new Set<() => void>();

function empty(): StoredContext {
  return { pages: [], memory: [] };
}

function isPage(value: unknown): value is PageSight {
  if (!value || typeof value !== "object") return false;
  const page = value as PageSight;
  return typeof page.path === "string" && typeof page.title === "string" && typeof page.text === "string" && typeof page.at === "string";
}

function isMemory(value: unknown): value is WorkMemory {
  if (!value || typeof value !== "object") return false;
  const item = value as WorkMemory;
  return typeof item.at === "string" && typeof item.summary === "string";
}

export function parseWorkContext(value: unknown): StoredContext {
  if (!value || typeof value !== "object" || Array.isArray(value)) return empty();
  const parsed = value as Partial<StoredContext>;
  return {
    pages: Array.isArray(parsed.pages) ? parsed.pages.filter(isPage).slice(-MAX_PAGES) : [],
    memory: Array.isArray(parsed.memory) ? parsed.memory.filter(isMemory).slice(-MAX_MEMORY) : [],
  };
}

function readStore(): StoredContext {
  if (typeof window === "undefined") return empty();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return parseWorkContext(raw ? JSON.parse(raw) : null);
  } catch {
    return empty();
  }
}

function writeStore(context: StoredContext) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(context));
  listeners.forEach((listener) => listener());
}

export function readWorkContext(): StoredContext {
  return readStore();
}

export function replaceWorkContext(data: unknown): void {
  writeStore(parseWorkContext(data));
}

export function resetWorkContext(): void {
  writeStore(empty());
}

export function subscribeWorkContext(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function compactText(text: string, max = MAX_TEXT) {
  const clean = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (clean.length <= max) return clean;
  return clean.slice(-max);
}

export function readPages(): PageSight[] {
  return readStore().pages.slice(-MAX_PAGES);
}

export function readMemory(): WorkMemory[] {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return readStore().memory.filter((item) => {
    const at = Date.parse(item.at);
    return Number.isFinite(at) && at >= cutoff;
  });
}

export function remember(summary: string, key?: string) {
  const text = summary.replace(/\s+/g, " ").trim().slice(0, 360);
  if (!text) return;
  const context = readStore();
  const now = new Date().toISOString();
  const last = context.memory[context.memory.length - 1];
  const memory =
    key && last?.key === key && Date.now() - Date.parse(last.at) < DEDUPE_MS
      ? [...context.memory.slice(0, -1), { ...last, at: now, summary: text }]
      : [...context.memory, { at: now, summary: text, key }];
  writeStore({ ...context, memory: memory.slice(-MAX_MEMORY) });
}

export function seePage(page: PageSight) {
  const context = readStore();
  const next = {
    path: page.path.slice(0, 200),
    title: page.title.slice(0, 160),
    text: compactText(page.text),
    at: page.at,
  };
  const previous = context.pages[context.pages.length - 1];
  const pages = previous?.path === next.path ? [...context.pages.slice(0, -1), next] : [...context.pages, next];
  writeStore({ ...context, pages: pages.slice(-MAX_PAGES) });
  remember(`Opened ${next.title} (${next.path})`, `page:${next.path}`);
}
