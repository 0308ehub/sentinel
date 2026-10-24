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

interface StoredContext {
  pages: PageSight[];
  memory: WorkMemory[];
}

function empty(): StoredContext {
  return { pages: [], memory: [] };
}

function readStore(): StoredContext {
  if (typeof window === "undefined") return empty();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as StoredContext;
    return {
      pages: Array.isArray(parsed.pages) ? parsed.pages : [],
      memory: Array.isArray(parsed.memory) ? parsed.memory : [],
    };
  } catch {
    return empty();
  }
}

function writeStore(context: StoredContext) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(context));
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
  if (key && last?.key === key && Date.now() - Date.parse(last.at) < DEDUPE_MS) {
    last.at = now;
    last.summary = text;
  } else {
    context.memory.push({ at: now, summary: text, key });
  }
  context.memory = context.memory.slice(-MAX_MEMORY);
  writeStore(context);
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
  if (previous?.path === next.path) context.pages[context.pages.length - 1] = next;
  else context.pages.push(next);
  context.pages = context.pages.slice(-MAX_PAGES);
  writeStore(context);
  remember(`Opened ${next.title} (${next.path})`, `page:${next.path}`);
}
