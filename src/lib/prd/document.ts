import type { NodeType } from "@/types/graph";

export type PrdAudience = "anyone" | "domain" | "invited";
export type PrdSection = "document";
export type PrdStage = "draft" | "problem" | "solution" | "launch" | "launched";

export interface PrdMilestone {
  id: string;
  label: string;
  date: string;
}

export interface PrdRequirement {
  id: string;
  text: string;
  priority: number;
}

export interface PrdCheck {
  id: string;
  label: string;
  done: boolean;
}

export interface PrdReaction {
  emoji: string;
  count: number;
}

export interface PrdTable {
  headers: string[];
  rows: { id: string; cells: string[] }[];
}

export interface PrdComment {
  id: string;
  author: string;
  color: string;
  section: PrdSection;
  body: string;
  at: string;
}

export interface LivingDoc {
  version: string;
  stage: PrdStage;
  introduction: string;
  goals: string;
  nonGoals: string;
  overview: string;
  design: string;
  figmaUrl: string;
  requirements: PrdRequirement[];
  security: string;
  privacy: string;
  testing: string;
  milestones: PrdMilestone[];
  checklist: PrdCheck[];
  reactions: PrdReaction[];
  snippet: string;
  table: PrdTable;
  record: string;
  autoUpdate: boolean;
  appliedSources: string[];
  comments: PrdComment[];
  audience: PrdAudience;
  domain: string;
  invited: string[];
}

export interface PrdEvidence {
  type: string;
  title: string;
  detail: string;
}

export interface PrdShare extends LivingDoc {
  v: 1;
  title: string;
  evidence: PrdEvidence[];
  links: { type: string; title: string }[];
}

const EVIDENCE_TYPES = new Set<NodeType>([
  "CUSTOMER_PROBLEM",
  "METRIC",
  "GOAL",
  "DECISION",
  "CUSTOMER_INTERVIEW",
  "EXPERIMENT",
  "SLACK_THREAD",
  "MEETING",
]);

export function isEvidenceType(type: string): type is NodeType {
  return EVIDENCE_TYPES.has(type as NodeType);
}

const STAGES = new Set<PrdStage>(["draft", "problem", "solution", "launch", "launched"]);
const REACTIONS = ["Agree", "Seen", "Question"];

export function emptyDoc(seed?: { introduction?: string; overview?: string; bet?: string; changes?: string }): LivingDoc {
  return {
    version: "0.1",
    stage: "draft",
    introduction: seed?.introduction?.trim() || seed?.bet?.trim() || "",
    goals: "",
    nonGoals: "",
    overview: seed?.overview?.trim() || seed?.changes?.trim() || "",
    design: "",
    figmaUrl: "",
    requirements: [],
    security: "",
    privacy: "",
    testing: "",
    milestones: [],
    checklist: [],
    reactions: REACTIONS.map((emoji) => ({ emoji, count: 0 })),
    snippet: "",
    table: { headers: ["Metric", "Baseline", "Target"], rows: [] },
    record: "",
    autoUpdate: false,
    appliedSources: [],
    comments: [],
    audience: "anyone",
    domain: "",
    invited: [],
  };
}

export function readLiving(metadata: Record<string, unknown>, seed?: { introduction?: string; overview?: string; bet?: string; changes?: string }): LivingDoc {
  const raw = metadata.living;
  if (!raw || typeof raw !== "object") return emptyDoc(seed);
  const doc = raw as Record<string, unknown>;
  const base = emptyDoc(seed);
  return {
    ...base,
    version: text(doc.version, 12) || base.version,
    stage: STAGES.has(doc.stage as PrdStage) ? (doc.stage as PrdStage) : "draft",
    introduction: text(doc.introduction, 8000) || text(doc.bet, 8000) || base.introduction,
    goals: text(doc.goals, 8000) || text(doc.changeMind, 8000),
    nonGoals: text(doc.nonGoals, 8000) || text(doc.notDoing, 8000),
    overview: text(doc.overview, 8000) || text(doc.changes, 8000) || base.overview,
    design: text(doc.design, 8000),
    figmaUrl: text(doc.figmaUrl, 500),
    requirements: Array.isArray(doc.requirements) ? doc.requirements.filter(isRequirement).slice(0, 40).map(normalizeRequirement) : [],
    security: text(doc.security, 8000),
    privacy: text(doc.privacy, 8000),
    testing: text(doc.testing, 8000),
    milestones: Array.isArray(doc.milestones)
      ? doc.milestones.filter(isMilestone).slice(0, 24).map((item) => ({ id: item.id, label: text(item.label, 120), date: text(item.date, 20) }))
      : [],
    checklist: Array.isArray(doc.checklist) ? doc.checklist.filter(isCheck).slice(0, 40) : [],
    reactions: normalizeReactions(doc.reactions),
    snippet: text(doc.snippet, 4000),
    table: normalizeTable(doc.table),
    record: text(doc.record, 8000),
    autoUpdate: doc.autoUpdate === true,
    appliedSources: Array.isArray(doc.appliedSources) ? doc.appliedSources.filter((item): item is string => typeof item === "string").slice(0, 200) : [],
    comments: Array.isArray(doc.comments)
      ? doc.comments.filter(isComment).slice(0, 30).map((item) => ({
          id: item.id,
          author: text(item.author, 40) || "Kismet",
          color: text(item.color, 20) || "#0571d3",
          section: "document" as const,
          body: text(item.body, 2000),
          at: text(item.at, 40),
        }))
      : [],
    audience: doc.audience === "domain" || doc.audience === "invited" ? doc.audience : "anyone",
    domain: domainOf(text(doc.domain, 80)),
    invited: Array.isArray(doc.invited) ? doc.invited.map((item) => text(item, 120).toLowerCase()).filter(isEmail).slice(0, 20) : [],
  };
}

export function figmaEmbed(url: string): string | null {
  const clean = url.trim();
  if (!clean) return null;
  try {
    const parsed = new URL(clean);
    if (parsed.protocol !== "https:" || !parsed.hostname.endsWith("figma.com")) return null;
    return `https://www.figma.com/embed?embed_host=kismet&url=${encodeURIComponent(parsed.toString())}`;
  } catch {
    return null;
  }
}

export function livingFromShare(share: PrdShare): LivingDoc {
  return readLiving({ living: share });
}

export function encodeShare(share: PrdShare): string {
  const json = JSON.stringify(share);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function decodeShare(token: string): PrdShare | null {
  try {
    const padded = token.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((token.length + 3) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<PrdShare>;
    if (parsed?.v !== 1 || typeof parsed.title !== "string") return null;
    const doc = readLiving({ living: parsed });
    return {
      v: 1,
      title: text(parsed.title, 140) || "Untitled PRD",
      ...doc,
      evidence: Array.isArray(parsed.evidence) ? parsed.evidence.filter(isEvidence).slice(0, 12) : [],
      links: Array.isArray(parsed.links)
        ? parsed.links
            .filter((item): item is { type: string; title: string } => Boolean(item) && typeof item === "object" && typeof (item as { title?: string }).title === "string")
            .slice(0, 12)
            .map((item) => ({ type: text(item.type, 40), title: text(item.title, 140) }))
        : [],
    };
  } catch {
    return null;
  }
}

export function emailAllowed(share: Pick<PrdShare, "audience" | "domain" | "invited">, email: string): boolean {
  const clean = email.trim().toLowerCase();
  if (!isEmail(clean)) return false;
  if (share.audience === "anyone") return true;
  if (share.audience === "domain") return Boolean(share.domain) && clean.endsWith(`@${share.domain}`);
  return share.invited.includes(clean);
}

export function domainOf(value: string): string {
  return value.trim().toLowerCase().replace(/^@/, "").replace(/^https?:\/\//, "").split("/")[0] ?? "";
}

function isMilestone(value: unknown): value is PrdMilestone {
  if (!value || typeof value !== "object") return false;
  const item = value as PrdMilestone;
  return typeof item.id === "string" && typeof item.label === "string";
}

function isComment(value: unknown): value is PrdComment {
  if (!value || typeof value !== "object") return false;
  const item = value as PrdComment;
  return typeof item.id === "string" && typeof item.body === "string" && typeof item.author === "string";
}

function isEvidence(value: unknown): value is PrdEvidence {
  if (!value || typeof value !== "object") return false;
  const item = value as PrdEvidence;
  return typeof item.title === "string";
}

function isRequirement(value: unknown): value is PrdRequirement {
  if (!value || typeof value !== "object") return false;
  return typeof (value as PrdRequirement).id === "string" && typeof (value as PrdRequirement).text === "string";
}

function normalizeRequirement(item: PrdRequirement): PrdRequirement {
  const priority = Number(item.priority);
  return { id: item.id, text: text(item.text, 500), priority: Number.isFinite(priority) ? Math.min(10, Math.max(1, Math.round(priority))) : 5 };
}

function isCheck(value: unknown): value is PrdCheck {
  if (!value || typeof value !== "object") return false;
  const item = value as PrdCheck;
  return typeof item.id === "string" && typeof item.label === "string" && typeof item.done === "boolean";
}

function normalizeReactions(value: unknown): PrdReaction[] {
  const counts = new Map(REACTIONS.map((emoji) => [emoji, 0]));
  if (Array.isArray(value)) {
    for (const item of value) {
      if (!item || typeof item !== "object") continue;
      const emoji = (item as PrdReaction).emoji;
      const count = Number((item as PrdReaction).count);
      if (counts.has(emoji) && Number.isFinite(count)) counts.set(emoji, Math.max(0, Math.min(999, Math.round(count))));
    }
  }
  return REACTIONS.map((emoji) => ({ emoji, count: counts.get(emoji) ?? 0 }));
}

function normalizeTable(value: unknown): PrdTable {
  const fallback: PrdTable = { headers: ["Metric", "Baseline", "Target"], rows: [] };
  if (!value || typeof value !== "object") return fallback;
  const table = value as PrdTable;
  const headers = Array.isArray(table.headers) ? table.headers.map((item) => text(item, 40)).filter(Boolean).slice(0, 6) : [];
  const width = headers.length || fallback.headers.length;
  const rows = Array.isArray(table.rows)
    ? table.rows
        .filter((row) => row && typeof row === "object" && typeof row.id === "string")
        .slice(0, 20)
        .map((row) => ({
          id: row.id,
          cells: Array.from({ length: width }, (_, index) => text(row.cells?.[index], 80)),
        }))
    : [];
  return { headers: headers.length ? headers : fallback.headers, rows };
}

function isEmail(value: string): boolean {
  return value.includes("@") && value.length < 120;
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
