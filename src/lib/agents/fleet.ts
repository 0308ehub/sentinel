"use client";

import { useEffect, useSyncExternalStore } from "react";
import { modelTitle, type ProviderId } from "@/lib/ai/policy";
import { getGraphEdges, getGraphNode, getGraphNodes } from "@/lib/graph/graph-store";

export type AgentModel = "auto" | ProviderId;
export type AgentStatus = "working" | "thinking" | "done" | "paused";

export interface AgentMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  at: string;
}

export interface FleetAgent {
  id: string;
  name: string;
  task: string;
  model: AgentModel;
  status: AgentStatus;
  activity: string;
  color: string;
  focusNodeId: string | null;
  path: string[];
  messages: AgentMessage[];
  createdBy: "user" | "kismet";
  routeLabel: string;
  /** When set, the graph ticker leaves the activity line alone (a model error, for example). */
  activityHold?: boolean;
  updatedAt: string;
}

interface FleetState {
  agents: FleetAgent[];
}

const KEY = "kismet-agents";
const EMPTY: FleetState = { agents: [] };
const COLORS = ["#0f9d8a", "#e07a2f", "#7c5cdb", "#3b82f6", "#db4d6d", "#b45309"];
const VERBS = ["Reading", "Checking what connects to", "Comparing", "Drafting a note on"];

const listeners = new Set<() => void>();
let snapshot: FleetState = EMPTY;
let hydrated = false;
let motion: number | undefined;
const inflight = new Map<string, AbortController>();

function emit(next: FleetState) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readStored(): FleetState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<FleetState>;
    const agents = Array.isArray(parsed.agents) ? parsed.agents.filter(isAgent).slice(0, 24) : [];
    return { agents };
  } catch {
    return EMPTY;
  }
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  emit(readStored());
}

function write(next: FleetState) {
  const stored = { agents: next.agents.slice(0, 24).map((agent) => ({ ...agent, messages: agent.messages.slice(-40) })) };
  try {
    localStorage.setItem(KEY, JSON.stringify(stored));
  } catch {
    // The fleet still works for this session if storage is full.
  }
  emit(stored);
}

function update(change: (state: FleetState) => FleetState) {
  hydrate();
  write(change(snapshot));
}

function isAgent(value: unknown): value is FleetAgent {
  if (!value || typeof value !== "object") return false;
  const agent = value as FleetAgent;
  return typeof agent.id === "string" && typeof agent.name === "string" && Array.isArray(agent.messages);
}

export function useAgents(): FleetAgent[] {
  const agents = useSyncExternalStore(subscribe, () => snapshot.agents, () => EMPTY.agents);
  useEffect(() => {
    hydrate();
  }, []);
  return agents;
}

export function createAgent(input: { name: string; task: string; model: AgentModel; focusNodeId?: string | null; createdBy?: "user" | "kismet" }) {
  hydrate();
  const name = input.name.trim().slice(0, 48);
  const task = input.task.trim().slice(0, 280);
  if (!name || !task) return null;
  const nodes = getGraphNodes();
  const focus = input.focusNodeId && nodes.some((node) => node.id === input.focusNodeId) ? input.focusNodeId : nodes[0]?.id ?? null;
  const agent: FleetAgent = {
    id: crypto.randomUUID(),
    name,
    task,
    model: input.model,
    status: "working",
    activity: focus ? `Starting on ${getGraphNode(focus)?.title ?? "the graph"}` : "Starting",
    color: COLORS[snapshot.agents.length % COLORS.length],
    focusNodeId: focus,
    path: focus ? [focus] : [],
    messages: [],
    createdBy: input.createdBy ?? "user",
    routeLabel: "",
    updatedAt: new Date().toISOString(),
  };
  update((state) => ({ agents: [agent, ...state.agents] }));
  void talkToAgent(agent.id, task);
  return agent.id;
}

export function setAgentModel(id: string, model: AgentModel) {
  update((state) => ({
    agents: state.agents.map((agent) => (agent.id === id ? { ...agent, model, updatedAt: new Date().toISOString() } : agent)),
  }));
}

export function setAgentStatus(id: string, status: AgentStatus) {
  const activity = status === "done" ? "Finished" : status === "paused" ? "Paused" : undefined;
  update((state) => ({
    agents: state.agents.map((agent) =>
      agent.id === id ? { ...agent, status, activity: activity ?? agent.activity, updatedAt: new Date().toISOString() } : agent
    ),
  }));
  if (status === "done" || status === "paused") inflight.get(id)?.abort();
}

export function removeAgent(id: string) {
  inflight.get(id)?.abort();
  update((state) => ({ agents: state.agents.filter((agent) => agent.id !== id) }));
}

export function assignKismetAgents() {
  hydrate();
  const nodes = getGraphNodes().filter((node) => node.type !== "PERSON");
  const pool = nodes.length ? nodes : getGraphNodes();
  const briefs = [
    (title: string) => `Watch ${title} and say what changed.`,
    (title: string) => `Propose one experiment for ${title}.`,
    (title: string) => `Find the evidence attached to ${title}.`,
    (title: string) => `Say what should ship next for ${title}.`,
  ];
  const names = ["Scout", "Experiment", "Evidence", "Ship"];
  const models: AgentModel[] = ["auto", "claude", "openai", "auto"];
  briefs.forEach((brief, index) => {
    const node = pool[index % Math.max(pool.length, 1)];
    createAgent({
      name: names[index] ?? `Agent ${index + 1}`,
      task: node ? brief(node.title) : "Look through the workspace and say what is missing.",
      model: models[index] ?? "auto",
      focusNodeId: node?.id ?? null,
      createdBy: "kismet",
    });
  });
}

export function talkToAgent(id: string, text: string) {
  const content = text.trim();
  if (!content) return;
  inflight.get(id)?.abort();
  const controller = new AbortController();
  inflight.set(id, controller);
  const user: AgentMessage = { id: crypto.randomUUID(), role: "user", content, at: new Date().toISOString() };
  update((state) => ({
    agents: state.agents.map((agent) =>
      agent.id === id
        ? { ...agent, status: "thinking", activity: "Thinking", activityHold: false, messages: [...agent.messages, user], updatedAt: user.at }
        : agent
    ),
  }));
  void deliver(id, controller);
}

async function deliver(id: string, controller: AbortController) {
  const agent = snapshot.agents.find((item) => item.id === id);
  if (!agent) return;
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: agent.model === "auto" ? undefined : agent.model,
        messages: agent.messages.slice(-12).map((message) => ({ role: message.role, content: message.content })),
      }),
    });
    const body = (await res.json()) as { reply?: string; error?: string; route?: { provider: ProviderId; model: string } };
    if (!res.ok) throw new Error(body.error || "The model request failed.");
    const reply = (body.reply || "Done.").trim();
    const routeLabel = body.route ? modelTitle(body.route.provider, body.route.model) : "";
    const message: AgentMessage = { id: crypto.randomUUID(), role: "assistant", content: reply, at: new Date().toISOString() };
    update((state) => ({
      agents: state.agents.map((item) =>
        item.id === id && item.status === "thinking"
          ? {
              ...item,
              status: "working",
              activity: clip(reply),
              activityHold: false,
              routeLabel,
              messages: [...item.messages, message],
              updatedAt: message.at,
            }
          : item
      ),
    }));
  } catch (error) {
    if (controller.signal.aborted) return;
    const text = error instanceof Error ? error.message : "The model request failed.";
    const message: AgentMessage = { id: crypto.randomUUID(), role: "assistant", content: text, at: new Date().toISOString() };
    update((state) => ({
      agents: state.agents.map((item) =>
        item.id === id && item.status === "thinking"
          ? { ...item, status: "working", activity: text, activityHold: true, messages: [...item.messages, message], updatedAt: message.at }
          : item
      ),
    }));
  } finally {
    if (inflight.get(id) === controller) inflight.delete(id);
  }
}

export function startAgentMotion() {
  hydrate();
  if (motion) return () => undefined;
  motion = window.setInterval(() => {
    update((state) => ({
      agents: state.agents.map((agent) => {
        if (agent.status !== "working" && agent.status !== "thinking") return agent;
        const focusNodeId = step(agent.focusNodeId);
        const title = focusNodeId ? getGraphNode(focusNodeId)?.title : undefined;
        const verb = VERBS[Math.floor(Date.now() / 2200) % VERBS.length];
        return {
          ...agent,
          focusNodeId,
          path: focusNodeId ? [...agent.path, focusNodeId].slice(-12) : agent.path,
          activity: agent.status === "thinking" || agent.activityHold || !title ? agent.activity : `${verb} ${title}`,
          updatedAt: new Date().toISOString(),
        };
      }),
    }));
  }, 2200);
  return () => {
    if (motion) window.clearInterval(motion);
    motion = undefined;
  };
}

function step(current: string | null): string | null {
  const nodes = getGraphNodes();
  if (!current) return nodes[0]?.id ?? null;
  const next = getGraphEdges()
    .flatMap((edge) => (edge.sourceId === current ? [edge.targetId] : edge.targetId === current ? [edge.sourceId] : []))
    .filter((id, index, all) => all.indexOf(id) === index);
  if (!next.length) return current;
  return next[Math.floor(Math.random() * next.length)] ?? current;
}

function clip(text: string): string {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length > 90 ? `${line.slice(0, 87)}…` : line;
}
