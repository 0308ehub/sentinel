"use client";

import { useEffect, useSyncExternalStore } from "react";
import { ORG, ORG_PROJECTS } from "@/lib/settings";

const KEY = "kismet-org-settings";

export type ShareAudience = "anyone" | "domain" | "invited";
export type MemberRole = "Admin" | "Manager" | "Member";
export type RetentionMonths = 0 | 12 | 24 | 36;

export interface WorkspaceProject {
  id: string;
  name: string;
  description: string;
  status: "active" | "archived";
}

export interface WorkspaceInvite {
  email: string;
  role: MemberRole;
  at: string;
}

export interface PrivacyRecipient {
  email: string;
  created: boolean;
  completed: boolean;
}

export interface RetentionOverride {
  projectId: string;
  months: 12 | 24 | 36;
}

export interface AiContext {
  graph: boolean;
  connectors: boolean;
  chat: boolean;
}

export interface WorkspaceSettings {
  orgName: string;
  orgUrl: string;
  hiddenNav: string[];
  requireSso: boolean;
  jit: boolean;
  allowedDomain: string;
  accessRequests: boolean;
  allowPublicLinks: boolean;
  requireExpiry: boolean;
  shareMaxDays: number;
  shareAudience: ShareAudience;
  privacy: PrivacyRecipient[];
  retentionMonths: RetentionMonths;
  retentionRequestedAt: string | null;
  retentionOverrides: RetentionOverride[];
  projects: WorkspaceProject[];
  invites: WorkspaceInvite[];
  groups: string[];
  aiGraph: boolean;
  aiConnectors: boolean;
  aiChat: boolean;
}

export const HIDEABLE_NAV = [
  { id: "agents", label: "Agents", group: "Workspace" },
  { id: "autopilot", label: "Autopilot", group: "Workspace" },
  { id: "dashboard", label: "Dashboard", group: "Workspace" },
  { id: "explorer", label: "Explorer", group: "Workspace" },
  { id: "features", label: "Features", group: "Workspace" },
  { id: "design", label: "Design", group: "Workspace" },
  { id: "board", label: "Board", group: "Workspace" },
  { id: "timeline", label: "Timeline", group: "Workspace" },
  { id: "graph", label: "Graph", group: "Workspace" },
  { id: "analytics", label: "Analytics", group: "Measure" },
  { id: "experiments", label: "Experiments", group: "Measure" },
  { id: "decisions", label: "Decisions", group: "Measure" },
] as const;

const HIDEABLE_IDS = new Set<string>(HIDEABLE_NAV.map((item) => item.id));
const ROLES = new Set<MemberRole>(["Admin", "Manager", "Member"]);
const AUDIENCES = new Set<ShareAudience>(["anyone", "domain", "invited"]);
const RETENTION = new Set<RetentionMonths>([0, 12, 24, 36]);
const OVERRIDE_MONTHS = new Set<RetentionOverride["months"]>([12, 24, 36]);

function fresh(): WorkspaceSettings {
  return {
    orgName: ORG.name,
    orgUrl: ORG.url,
    hiddenNav: [],
    requireSso: false,
    jit: false,
    allowedDomain: "",
    accessRequests: true,
    allowPublicLinks: true,
    requireExpiry: false,
    shareMaxDays: 30,
    shareAudience: "anyone",
    privacy: [],
    retentionMonths: 0,
    retentionRequestedAt: null,
    retentionOverrides: [],
    projects: ORG_PROJECTS.map((project) => ({
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
    })),
    invites: [],
    groups: [],
    aiGraph: true,
    aiConnectors: true,
    aiChat: true,
  };
}

const SERVER_SETTINGS = fresh();

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function emailOf(value: unknown): string {
  const email = text(value, 160).toLowerCase();
  return email.includes("@") && email.split("@")[1]?.includes(".") ? email : "";
}

function projectsOf(value: unknown, fallback: WorkspaceProject[]): WorkspaceProject[] {
  if (!Array.isArray(value)) return fallback;
  const projects: WorkspaceProject[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Partial<WorkspaceProject>;
    const name = text(row.name, 80);
    const id = text(row.id, 80);
    if (!name || !id) continue;
    projects.push({
      id,
      name,
      description: text(row.description, 180),
      status: row.status === "archived" ? "archived" : "active",
    });
  }
  if (!projects.length) return fallback;
  if (!projects.some((project) => project.status === "active")) {
    projects[0] = { ...projects[0], status: "active" };
  }
  return projects.slice(0, 40);
}

export function normalizeWorkspace(value: unknown): WorkspaceSettings {
  const base = fresh();
  if (!value || typeof value !== "object") return base;
  const raw = value as Partial<WorkspaceSettings>;
  const days = typeof raw.shareMaxDays === "number" && raw.shareMaxDays >= 1 && raw.shareMaxDays <= 365
    ? Math.round(raw.shareMaxDays)
    : base.shareMaxDays;
  const retention = RETENTION.has(raw.retentionMonths as RetentionMonths)
    ? (raw.retentionMonths as RetentionMonths)
    : 0;
  const requested = text(raw.retentionRequestedAt, 40);
  const requestedAt = requested && !Number.isNaN(new Date(requested).getTime()) ? new Date(requested).toISOString() : null;

  const invites: WorkspaceInvite[] = [];
  if (Array.isArray(raw.invites)) {
    for (const item of raw.invites) {
      if (!item || typeof item !== "object") continue;
      const row = item as Partial<WorkspaceInvite>;
      const email = emailOf(row.email);
      if (!email || !ROLES.has(row.role as MemberRole)) continue;
      invites.push({ email, role: row.role as MemberRole, at: text(row.at, 40) || new Date(0).toISOString() });
    }
  }

  const privacy: PrivacyRecipient[] = [];
  if (Array.isArray(raw.privacy)) {
    for (const item of raw.privacy) {
      if (!item || typeof item !== "object") continue;
      const row = item as Partial<PrivacyRecipient>;
      const email = emailOf(row.email);
      if (!email) continue;
      privacy.push({ email, created: row.created !== false, completed: row.completed !== false });
    }
  }

  const overrides: RetentionOverride[] = [];
  if (Array.isArray(raw.retentionOverrides)) {
    for (const item of raw.retentionOverrides) {
      if (!item || typeof item !== "object") continue;
      const row = item as Partial<RetentionOverride>;
      const projectId = text(row.projectId, 80);
      if (!projectId || !OVERRIDE_MONTHS.has(row.months as RetentionOverride["months"])) continue;
      overrides.push({ projectId, months: row.months as RetentionOverride["months"] });
    }
  }

  const groups = Array.isArray(raw.groups)
    ? [...new Set(raw.groups.map((group) => text(group, 60)).filter(Boolean))].slice(0, 24)
    : [];

  return {
    orgName: text(raw.orgName, 80) || base.orgName,
    orgUrl: text(raw.orgUrl, 80).replace(/[^a-z0-9-]/gi, "").toLowerCase() || base.orgUrl,
    hiddenNav: Array.isArray(raw.hiddenNav) ? raw.hiddenNav.filter((id) => HIDEABLE_IDS.has(id)) : [],
    requireSso: raw.requireSso === true,
    jit: raw.jit === true,
    allowedDomain: text(raw.allowedDomain, 80).replace(/^@/, "").toLowerCase(),
    accessRequests: raw.accessRequests !== false,
    allowPublicLinks: raw.allowPublicLinks !== false,
    requireExpiry: raw.requireExpiry === true,
    shareMaxDays: days,
    shareAudience: AUDIENCES.has(raw.shareAudience as ShareAudience) ? (raw.shareAudience as ShareAudience) : "anyone",
    privacy: privacy.slice(0, 40),
    retentionMonths: retention,
    retentionRequestedAt: retention === 0 ? null : requestedAt,
    retentionOverrides: overrides.slice(0, 40),
    projects: projectsOf(raw.projects, base.projects),
    invites: invites.slice(0, 40),
    groups,
    aiGraph: raw.aiGraph !== false,
    aiConnectors: raw.aiConnectors !== false,
    aiChat: raw.aiChat !== false,
  };
}

let snapshot: WorkspaceSettings = SERVER_SETTINGS;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(next: WorkspaceSettings) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

export function readWorkspace(): WorkspaceSettings {
  if (typeof window === "undefined") return SERVER_SETTINGS;
  try {
    const raw = localStorage.getItem(KEY);
    return normalizeWorkspace(raw ? JSON.parse(raw) : null);
  } catch {
    return fresh();
  }
}

export function aiContext(): AiContext {
  const settings = readWorkspace();
  return { graph: settings.aiGraph, connectors: settings.aiConnectors, chat: settings.aiChat };
}

export function workspaceIsDefault(value: unknown): boolean {
  return JSON.stringify(normalizeWorkspace(value)) === JSON.stringify(fresh());
}

export function replaceWorkspace(data: unknown): void {
  const next = normalizeWorkspace(data);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // The settings still apply for this session if storage is full.
  }
  emit(next);
}

export function resetWorkspace(): void {
  replaceWorkspace(fresh());
}

export function subscribeWorkspace(listener: () => void): () => void {
  return subscribe(listener);
}

export function updateWorkspace(patch: Partial<WorkspaceSettings>) {
  replaceWorkspace({ ...readWorkspace(), ...patch });
}

export function useWorkspaceSettings(): WorkspaceSettings {
  const value = useSyncExternalStore(subscribe, () => snapshot, () => SERVER_SETTINGS);
  useEffect(() => {
    emit(readWorkspace());
  }, []);
  return value;
}

export function retentionCancelHours(requestedAt: string | null, now = Date.now()): number | null {
  if (!requestedAt) return null;
  const start = new Date(requestedAt).getTime();
  if (Number.isNaN(start)) return null;
  const left = 24 * 60 * 60 * 1000 - (now - start);
  return left > 0 ? Math.ceil(left / (60 * 60 * 1000)) : 0;
}
