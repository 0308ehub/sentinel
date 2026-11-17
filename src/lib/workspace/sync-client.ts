"use client";

import { useSyncExternalStore } from "react";
import { graphStore } from "@/lib/graph/graph-store";
import { workspaceAdapters, type SyncAdapter } from "@/lib/workspace/adapters";
import { initialAction, trimForUpload } from "@/lib/workspace/sync-plan";

export type WorkspaceSyncStatus = "idle" | "saving" | "saved" | "error" | "local-only";

type StateKey = "graph" | "chats";
type ServerState = { data: unknown; version: number };
type StateResponse = { userId: string; states: Partial<Record<StateKey, ServerState>> };

const API = "/api/workspace/state";
const OWNER_KEY = "kismet-sync-owner";
const MAX_UPLOAD_BYTES = 3_000_000;
const RETRY_DELAYS = [2_000, 5_000, 15_000, 30_000];
const adapters: SyncAdapter<unknown>[] = workspaceAdapters;
const versions: Record<StateKey, number> = { graph: 0, chats: 0 };
const dirty: Record<StateKey, boolean> = { graph: false, chats: false };
const inFlight: Record<StateKey, boolean> = { graph: false, chats: false };
const retries: Record<StateKey, number> = { graph: 0, chats: 0 };
const timers: Partial<Record<StateKey, ReturnType<typeof setTimeout>>> = {};
const listeners = new Set<() => void>();

let status: WorkspaceSyncStatus = "idle";
let started = false;
let stopped = false;
let suppressChanges = false;
let subscribed = false;
let lastRefresh = 0;
let bootstrapRetries = 0;
let bootstrapTimer: ReturnType<typeof setTimeout> | undefined;

function setStatus(next: WorkspaceSyncStatus): void {
  if (status === next) return;
  status = next;
  listeners.forEach((listener) => listener());
}

function adapterFor(key: StateKey): SyncAdapter<unknown> {
  const adapter = adapters.find((item) => item.key === key);
  if (!adapter) throw new Error(`Missing workspace adapter: ${key}`);
  return adapter;
}

function retryDelay(attempt: number): number {
  return RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)];
}

function uploadData(adapter: SyncAdapter<unknown>, forceSlim: boolean): unknown {
  const data = adapter.read();
  const slim = adapter.slim ? (value: unknown) => adapter.slim?.(value) ?? value : (value: unknown) => value;
  return forceSlim ? slim(data) : trimForUpload(data, MAX_UPLOAD_BYTES, slim);
}

function uploadBody(key: StateKey, forceSlim = false): string {
  return JSON.stringify({ key, data: uploadData(adapterFor(key), forceSlim), baseVersion: versions[key] });
}

function scheduleUpload(key: StateKey, delay = 700): void {
  if (stopped || timers[key]) return;
  timers[key] = setTimeout(() => {
    delete timers[key];
    void sendState(key);
  }, delay);
}

function markDirty(key: StateKey): void {
  if (suppressChanges || stopped) return;
  dirty[key] = true;
  setStatus("saving");
  scheduleUpload(key);
}

function scheduleRetry(key: StateKey): void {
  const attempt = retries[key]++;
  setStatus("error");
  scheduleUpload(key, retryDelay(attempt));
}

function applyServer(key: StateKey, state: ServerState): void {
  suppressChanges = true;
  adapterFor(key).apply(state.data);
  suppressChanges = false;
  versions[key] = state.version;
  dirty[key] = false;
}

async function handleUploadResponse(key: StateKey, response: Response): Promise<"done" | "slim"> {
  if (response.ok) {
    const result = (await response.json()) as { version: number };
    versions[key] = result.version;
    retries[key] = 0;
    return "done";
  }
  if (response.status === 409) {
    applyServer(key, (await response.json()) as ServerState);
    return "done";
  }
  if (response.status === 401) stopped = true;
  if (response.status === 503) {
    stopped = true;
    setStatus("local-only");
  }
  if (response.status === 413) return "slim";
  throw new Error(`Workspace upload failed (${response.status})`);
}

async function sendState(key: StateKey): Promise<void> {
  if (stopped || inFlight[key] || !dirty[key]) return;
  inFlight[key] = true;
  dirty[key] = false;
  try {
    let response = await fetch(API, { method: "PUT", headers: { "Content-Type": "application/json" }, body: uploadBody(key) });
    let result = await handleUploadResponse(key, response);
    if (result === "slim") {
      response = await fetch(API, { method: "PUT", headers: { "Content-Type": "application/json" }, body: uploadBody(key, true) });
      result = await handleUploadResponse(key, response);
      if (result === "slim") throw new Error("Workspace state is too large");
    }
  } catch {
    if (!stopped) {
      dirty[key] = true;
      scheduleRetry(key);
    }
  } finally {
    inFlight[key] = false;
    if (!stopped && dirty[key]) scheduleUpload(key, 0);
    if (!stopped && !adapters.some((adapter) => dirty[adapter.key] || inFlight[adapter.key])) {
      setStatus("saved");
    }
  }
}

function runInitialPlan(payload: StateResponse): void {
  const localOwner = localStorage.getItem(OWNER_KEY);
  for (const adapter of adapters) {
    const server = payload.states[adapter.key];
    versions[adapter.key] = server?.version ?? 0;
    const action = initialAction({
      serverHasData: Boolean(server),
      localEmpty: adapter.isEmpty(adapter.read()),
      localOwner,
      userId: payload.userId,
    });
    suppressChanges = true;
    if (action === "adopt-server" && server) adapter.apply(server.data);
    if (action === "reset-local") adapter.reset();
    suppressChanges = false;
    if (action === "push-local") dirty[adapter.key] = true;
  }
  localStorage.setItem(OWNER_KEY, payload.userId);
}

function installListeners(): void {
  if (subscribed) return;
  subscribed = true;
  adapters.forEach((adapter) => adapter.subscribe(() => markDirty(adapter.key)));
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", flushOnPageHide);
}

async function bootstrap(): Promise<void> {
  if (stopped) return;
  try {
    const response = await fetch(API);
    if (response.status === 401) {
      stopped = true;
      return;
    }
    if (response.status === 503) {
      stopped = true;
      setStatus("local-only");
      return;
    }
    if (!response.ok) throw new Error("Workspace load failed");
    runInitialPlan((await response.json()) as StateResponse);
    bootstrapRetries = 0;
    installListeners();
    adapters.forEach((adapter) => dirty[adapter.key] && scheduleUpload(adapter.key, 0));
    setStatus(adapters.some((adapter) => dirty[adapter.key]) ? "saving" : "saved");
  } catch {
    setStatus("error");
    const delay = retryDelay(bootstrapRetries++);
    bootstrapTimer = setTimeout(() => {
      bootstrapTimer = undefined;
      void bootstrap();
    }, delay);
  }
}

function waitForGraphHydration(): Promise<void> {
  if (graphStore.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsubscribe = graphStore.persist.onFinishHydration(() => {
      unsubscribe();
      resolve();
    });
  });
}

export function startWorkspaceSync(): void {
  if (started) return;
  started = true;
  void waitForGraphHydration().then(bootstrap);
}

async function refreshFromServer(): Promise<void> {
  try {
    const response = await fetch(API);
    if (response.status === 401) {
      stopped = true;
      return;
    }
    if (response.status === 503) {
      stopped = true;
      setStatus("local-only");
      return;
    }
    if (!response.ok) return;
    const payload = (await response.json()) as StateResponse;
    for (const adapter of adapters) {
      const server = payload.states[adapter.key];
      if (!dirty[adapter.key] && !inFlight[adapter.key] && server && server.version > versions[adapter.key]) {
        applyServer(adapter.key, server);
      }
    }
  } catch {
    // A later visibility event will try again.
  }
}

function onVisibilityChange(): void {
  if (document.visibilityState !== "visible" || Date.now() - lastRefresh < 30_000) return;
  lastRefresh = Date.now();
  void refreshFromServer();
}

function flushOnPageHide(): void {
  for (const adapter of adapters) {
    if (!dirty[adapter.key]) continue;
    void fetch(API, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: uploadBody(adapter.key),
      keepalive: true,
    });
  }
}

export function retryWorkspaceSync(): void {
  stopped = false;
  retries.graph = 0;
  retries.chats = 0;
  if (bootstrapTimer) clearTimeout(bootstrapTimer);
  bootstrapTimer = undefined;
  for (const adapter of adapters) {
    const timer = timers[adapter.key];
    if (timer) clearTimeout(timer);
    delete timers[adapter.key];
  }
  if (!subscribed) void bootstrap();
  else adapters.forEach((adapter) => dirty[adapter.key] && scheduleUpload(adapter.key, 0));
}

export function useWorkspaceSyncStatus(): WorkspaceSyncStatus {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => status,
    () => "idle",
  );
}
