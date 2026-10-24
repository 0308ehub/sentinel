"use client";

import { useSyncExternalStore } from "react";
import type { ProviderId } from "@/lib/ai/policy";
import { readMemory, readPages, remember } from "@/lib/work-context";

export type ModelChoice = "auto" | ProviderId;

export interface ChatFile {
  name: string;
  text: string;
}

export interface WarehouseQuery {
  sql: string;
  rowCount: number;
  error?: string;
}

export interface ChatSource {
  title: string;
  url: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  at: string;
  chips?: string[];
  files?: ChatFile[];
  channels?: string[];
  issues?: string[];
  queries?: WarehouseQuery[];
  sources?: ChatSource[];
  searched?: boolean;
  route?: { provider: ProviderId; model: string; reason: string };
}

export interface ChatThread {
  id: string;
  title: string;
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface ChatFolder {
  id: string;
  name: string;
  createdAt: string;
}

export interface ScheduledPrompt {
  id: string;
  prompt: string;
  at: string;
  folderId: string | null;
  done: boolean;
}

export interface ChatState {
  threads: ChatThread[];
  folders: ChatFolder[];
  schedules: ScheduledPrompt[];
  activeId: string | null;
  folderId: string | null;
  model: ModelChoice;
}

interface ComposerDraft {
  text: string;
  chips: string[];
  files: ChatFile[];
}

const KEY = "kismet-chats";
const EMPTY: ChatState = {
  threads: [],
  folders: [],
  schedules: [],
  activeId: null,
  folderId: null,
  model: "auto",
};

const EMPTY_DRAFT: ComposerDraft = { text: "", chips: [], files: [] };
const pendingIds = new Set<string>();
const listeners = new Set<() => void>();
let draft: ComposerDraft = EMPTY_DRAFT;
let snapshot = EMPTY;

function emit() {
  snapshot = load();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function load(): ChatState {
  return readStored();
}

function readStored(): ChatState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<ChatState>;
    const threads = Array.isArray(parsed.threads) ? parsed.threads.filter(isThread).slice(0, 40) : [];
    const folders = Array.isArray(parsed.folders) ? parsed.folders.filter(isFolder).slice(0, 40) : [];
    const schedules = Array.isArray(parsed.schedules) ? parsed.schedules.filter(isSchedule).slice(0, 40) : [];
    const model = parsed.model === "claude" || parsed.model === "openai" || parsed.model === "auto" ? parsed.model : "auto";
    const activeId = threads.some((thread) => thread.id === parsed.activeId) ? parsed.activeId ?? null : null;
    const folderId = folders.some((folder) => folder.id === parsed.folderId) ? parsed.folderId ?? null : null;
    return { threads, folders, schedules, activeId, folderId, model };
  } catch {
    return EMPTY;
  }
}

function write(next: ChatState) {
  const stored: ChatState = {
    ...next,
    threads: next.threads.slice(0, 40).map((thread) => ({
      ...thread,
      messages: thread.messages.slice(-40).map((message) => ({
        ...message,
        files: message.files?.map((file) => ({ name: file.name, text: file.text.slice(0, 12000) })),
      })),
    })),
    folders: next.folders.slice(0, 40),
    schedules: next.schedules.slice(0, 40),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(stored));
  } catch {
    const slim = {
      ...stored,
      threads: stored.threads.map((thread, index) => ({
        ...thread,
        messages: thread.messages.map((message, messageIndex) =>
          index === 0 && messageIndex === thread.messages.length - 1
            ? message
            : { ...message, files: message.files?.map((file) => ({ name: file.name, text: "" })) },
        ),
      })),
    };
    localStorage.setItem(KEY, JSON.stringify(slim));
  }
  emit();
}

function isThread(value: unknown): value is ChatThread {
  if (!value || typeof value !== "object") return false;
  const thread = value as ChatThread;
  return typeof thread.id === "string" && typeof thread.title === "string" && Array.isArray(thread.messages);
}

function isFolder(value: unknown): value is ChatFolder {
  if (!value || typeof value !== "object") return false;
  const folder = value as ChatFolder;
  return typeof folder.id === "string" && typeof folder.name === "string";
}

function isSchedule(value: unknown): value is ScheduledPrompt {
  if (!value || typeof value !== "object") return false;
  const item = value as ScheduledPrompt;
  return typeof item.id === "string" && typeof item.prompt === "string" && typeof item.at === "string";
}

export function useChatState(): ChatState {
  return useSyncExternalStore(subscribe, () => snapshot, () => EMPTY);
}

export function useComposerDraft(): ComposerDraft {
  return useSyncExternalStore(
    subscribe,
    () => draft,
    () => EMPTY_DRAFT,
  );
}

export function activeThread(state: ChatState): ChatThread | undefined {
  return state.threads.find((thread) => thread.id === state.activeId);
}

export function threadPending(id: string | null): boolean {
  return Boolean(id && pendingIds.has(id));
}

export function setModel(model: ModelChoice) {
  const state = readStored();
  write({ ...state, model });
}

export function setFolderFilter(folderId: string | null) {
  const state = readStored();
  write({ ...state, folderId });
}

export function startNewChat() {
  const state = readStored();
  write({ ...state, activeId: null });
  setDraft({ text: "", chips: draft.chips, files: [] });
}

export function openThread(id: string) {
  const state = readStored();
  if (!state.threads.some((thread) => thread.id === id)) return;
  write({ ...state, activeId: id });
}

export function createFolder(name: string) {
  const trimmed = name.trim().slice(0, 60);
  if (!trimmed) return;
  const state = readStored();
  const folder: ChatFolder = { id: crypto.randomUUID(), name: trimmed, createdAt: new Date().toISOString() };
  write({ ...state, folders: [folder, ...state.folders], folderId: folder.id });
}

export function assignActiveFolder(folderId: string | null) {
  const state = readStored();
  if (!state.activeId) return;
  write({
    ...state,
    threads: state.threads.map((thread) => (thread.id === state.activeId ? { ...thread, folderId } : thread)),
  });
}

export function removeFolder(folderId: string) {
  const state = readStored();
  write({
    ...state,
    folders: state.folders.filter((folder) => folder.id !== folderId),
    folderId: state.folderId === folderId ? null : state.folderId,
    threads: state.threads.map((thread) => (thread.folderId === folderId ? { ...thread, folderId: null } : thread)),
  });
}

export function pickChip(id: string) {
  const chips = draft.chips.includes(id) ? draft.chips : [...draft.chips, id];
  const text = draft.text.replace(/(^|\s)#[a-z][\w-]*$/i, "$1").replace(/\s+$/g, "");
  setDraft({ text, chips, files: draft.files });
}

export function runScheduled(id: string) {
  const state = readStored();
  const item = state.schedules.find((entry) => entry.id === id);
  if (!item || item.done) return;
  write({
    ...state,
    activeId: null,
    folderId: item.folderId,
    schedules: state.schedules.map((entry) => (entry.id === id ? { ...entry, done: true } : entry)),
  });
  setDraft(EMPTY_DRAFT);
  void sendChat(item.prompt);
}

export function schedulePrompt(prompt: string, at: string) {
  const trimmed = prompt.trim();
  if (!trimmed || !at) return;
  const state = readStored();
  const item: ScheduledPrompt = {
    id: crypto.randomUUID(),
    prompt: trimmed.slice(0, 2000),
    at: new Date(at).toISOString(),
    folderId: state.folderId,
    done: false,
  };
  write({ ...state, schedules: [item, ...state.schedules] });
}

export function setDraft(next: ComposerDraft) {
  draft = next;
  emit();
}

export function addChip(id: string) {
  if (draft.chips.includes(id)) return;
  setDraft({ ...draft, chips: [...draft.chips, id] });
}

export function removeChip(id: string) {
  setDraft({ ...draft, chips: draft.chips.filter((chip) => chip !== id) });
}

export function addFiles(files: ChatFile[]) {
  setDraft({ ...draft, files: [...draft.files, ...files].slice(0, 4) });
}

export function removeFile(name: string) {
  setDraft({ ...draft, files: draft.files.filter((file) => file.name !== name) });
}

export function contextEstimate(messages: ChatMessage[], model: ModelChoice) {
  const chars = messages.reduce((total, message) => {
    const files = message.files?.reduce((sum, file) => sum + file.text.length, 0) ?? 0;
    return total + message.content.length + files;
  }, 0);
  const tokens = Math.ceil(chars / 4);
  const window = model === "claude" ? 200_000 : 128_000;
  return { tokens, window, ratio: Math.min(1, tokens / window) };
}

export function greetingFor(name: string, now = new Date()): string {
  const hour = now.getHours();
  const hello = hour < 5 || hour >= 21 ? "Late night" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return name ? `${hello}, ${name}` : hello;
}

export function chatBucket(iso: string, now = new Date()): "Today" | "This week" | "Earlier" {
  const date = new Date(iso);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (date >= start) return "Today";
  const week = new Date(start);
  week.setDate(week.getDate() - 6);
  if (date >= week) return "This week";
  return "Earlier";
}

let tail: Promise<void> = Promise.resolve();

export function sendChat(text: string) {
  const run = tail.then(() => deliver(text));
  tail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function deliver(text: string) {
  const content = text.trim();
  const files = draft.files;
  const chips = draft.chips;
  if (!content && files.length === 0) return;
  const state = readStored();
  const now = new Date().toISOString();
  let thread = state.threads.find((item) => item.id === state.activeId);
  if (!thread) {
    thread = {
      id: crypto.randomUUID(),
      title: (content || files[0]?.name || "New chat").replace(/\s+/g, " ").slice(0, 64),
      folderId: state.folderId,
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    state.threads.unshift(thread);
    state.activeId = thread.id;
  }
  const userMessage: ChatMessage = {
    id: crypto.randomUUID(),
    role: "user",
    content: content || `Attached ${files.map((file) => file.name).join(", ")}`,
    at: now,
    chips,
    files: files.length ? files : undefined,
  };
  thread.messages = [...thread.messages, userMessage];
  thread.updatedAt = now;
  pendingIds.add(thread.id);
  setDraft({ text: "", chips, files: [] });
  write(state);

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        modes: chips,
        model: state.model,
        pages: readPages(),
        memory: readMemory().map(({ at, summary }) => ({ at, summary })),
        messages: thread.messages.map((message) => ({
          role: message.role,
          content: messageBody(message),
        })),
      }),
    });
    const body = (await res.json()) as {
      reply?: string;
      channels?: string[];
      issues?: string[];
      queries?: WarehouseQuery[];
      sources?: ChatSource[];
      searched?: boolean;
      route?: ChatMessage["route"];
      error?: string;
    };
    const reply = body.error ?? body.reply ?? "No reply.";
    if (body.reply) remember(`Asked “${userMessage.content.slice(0, 160)}”. ${body.reply.slice(0, 180)}`);
    finish(thread.id, {
      id: crypto.randomUUID(),
      role: "assistant",
      content: reply,
      at: new Date().toISOString(),
      channels: body.channels,
      issues: body.issues,
      queries: body.queries,
      sources: body.sources,
      searched: body.searched,
      route: body.route,
    });
  } catch {
    finish(thread.id, {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "The request failed. Check that the dev server is running and try again.",
      at: new Date().toISOString(),
    });
  }
}

function finish(threadId: string, message: ChatMessage) {
  pendingIds.delete(threadId);
  const state = readStored();
  const thread = state.threads.find((item) => item.id === threadId);
  if (!thread) {
    emit();
    return;
  }
  thread.messages = [...thread.messages, message];
  thread.updatedAt = message.at;
  write(state);
}

function messageBody(message: ChatMessage): string {
  if (!message.files?.length) return message.content;
  const attached = message.files.map((file) => `File ${file.name}:\n${file.text}`).join("\n\n");
  return `${message.content}\n\n${attached}`.trim();
}

if (typeof window !== "undefined") snapshot = load();
