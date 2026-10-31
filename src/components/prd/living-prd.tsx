"use client";

import { useEffect, useMemo, useState } from "react";
import { graphStore, useGraphHydrated, useGraphStore } from "@/lib/graph/graph-store";
import { useAgents } from "@/lib/agents/fleet";
import {
  domainOf,
  encodeShare,
  isEvidenceType,
  readLiving,
  type LivingDoc,
  type PrdAudience,
  type PrdShare,
} from "@/lib/prd/document";
import { PrdStory, type StoryAgent, type StoryEvidence, type StoryLink } from "@/components/prd/prd-story";
import type { GraphNode } from "@/types/graph";

const PENDING_KEY = "kismet-pending-prd";
const RECORD_TYPES = new Set(["SLACK_THREAD", "MEETING", "SUPPORT_TICKET", "CUSTOMER_INTERVIEW"]);

export function LivingPrd({ featureId }: { featureId: string }) {
  const hydrated = useGraphHydrated();
  const nodes = useGraphStore((state) => state.nodes);
  const edges = useGraphStore((state) => state.edges);
  const agents = useAgents();
  const feature = nodes.find((node) => node.id === featureId && node.type === "FEATURE");
  const prd = connectedPrd(featureId, nodes, edges);
  const [title, setTitle] = useState("");
  const [doc, setDoc] = useState<LivingDoc | null>(null);
  const [asking, setAsking] = useState(false);
  const [writing, setWriting] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    if (!hydrated || !featureId) return;
    graphStore.getState().ensureFeaturePrd(featureId);
  }, [hydrated, featureId]);

  useEffect(() => {
    if (!feature || !prd) return;
    setTitle(feature.title);
    setDoc(readLiving(prd.metadata, { bet: feature.description ?? "", changes: prd.description ?? "" }));
    // Reload only when opening a different feature. Saves update the same nodes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feature?.id, prd?.id]);

  const evidence = useMemo(() => (feature ? evidenceFor(feature.id, nodes, edges) : []), [feature, nodes, edges]);
  const links = useMemo(() => (feature && prd ? linksFor(feature.id, prd.id, nodes, edges) : []), [feature, prd, nodes, edges]);
  const recordSources = useMemo(() => evidence.filter((item) => RECORD_TYPES.has(item.type)), [evidence]);

  useEffect(() => {
    if (!doc?.autoUpdate || !prd) return;
    const fresh = recordSources.filter((item) => !doc.appliedSources.includes(item.id));
    if (!fresh.length) return;
    const stamp = new Date().toISOString().slice(0, 10);
    const lines = fresh
      .map((item) => `${stamp} — ${item.type.replace(/_/g, " ").toLowerCase()}: ${item.title}${item.detail ? `. ${item.detail}` : ""}`)
      .join("\n");
    const next = {
      ...doc,
      record: [doc.record, lines].filter(Boolean).join("\n"),
      appliedSources: [...doc.appliedSources, ...fresh.map((item) => item.id)],
    };
    setDoc(next);
    graphStore.getState().saveLivingPrd(prd.id, next);
  }, [doc, prd, recordSources]);

  const here = agents.filter(
    (agent) =>
      (agent.status === "working" || agent.status === "thinking") &&
      agent.focusNodeId &&
      (agent.focusNodeId === featureId || agent.focusNodeId === prd?.id || links.some((link) => link.id === agent.focusNodeId))
  );

  if (!hydrated || !doc || !feature || !prd) return <div className="h-full bg-background" />;

  function commit(next: LivingDoc) {
    setDoc(next);
    graphStore.getState().saveLivingPrd(prd!.id, next);
  }

  function commitTitle() {
    const next = title.trim();
    if (next && next !== feature?.title) graphStore.getState().updateWorkDoc(featureId, { title: next });
  }

  function applyRecord() {
    if (!doc) return;
    const fresh = recordSources.filter((item) => !doc.appliedSources.includes(item.id));
    if (!fresh.length) return;
    const stamp = new Date().toISOString().slice(0, 10);
    const lines = fresh
      .map((item) => `${stamp} — ${item.type.replace(/_/g, " ").toLowerCase()}: ${item.title}${item.detail ? `. ${item.detail}` : ""}`)
      .join("\n");
    commit({
      ...doc,
      record: [doc.record, lines].filter(Boolean).join("\n"),
      appliedSources: [...doc.appliedSources, ...fresh.map((item) => item.id)],
    });
  }

  async function writeFromSources() {
    if (!doc || writing) return;
    setWriting(true);
    const packet = evidence.map((item) => `${item.type}: ${item.title}\n${item.detail}`).filter(Boolean).join("\n\n");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: [
                "Rewrite this product requirements document as JSON only.",
                "Use only the sources. If a source does not support a section, use an empty string. Do not invent metrics, names, dates, or quotes.",
                "Keys: introduction, goals, nonGoals, overview, design, security, privacy, testing, requirements.",
                "requirements is an array of {text, priority}. text is one sentence beginning 'The product shall'. priority is an integer from 1 to 10.",
                `Title: ${title}`,
                `Sources:\n${packet || "No sources linked."}`,
              ].join("\n"),
            },
          ],
        }),
      });
      const body = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok) throw new Error(body.error || "The document could not be written.");
      const parsed = readPrdJson(body.reply || "");
      commit({
        ...doc,
        introduction: parsed.introduction || doc.introduction,
        goals: parsed.goals || doc.goals,
        nonGoals: parsed.nonGoals || doc.nonGoals,
        overview: parsed.overview || doc.overview,
        design: parsed.design || doc.design,
        security: parsed.security || doc.security,
        privacy: parsed.privacy || doc.privacy,
        testing: parsed.testing || doc.testing,
        requirements: parsed.requirements.length ? parsed.requirements : doc.requirements,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "The document could not be written.";
      commit({
        ...doc,
        comments: [...doc.comments, { id: crypto.randomUUID(), author: "Kismet", color: "#0571d3", section: "document", body: message, at: new Date().toISOString() }],
      });
    } finally {
      setWriting(false);
    }
  }

  async function ask() {
    if (!doc || asking) return;
    setAsking(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: `Comment on this product requirements document in two or three sentences. Use only what is written. Say what is missing. Title: ${title}. Introduction: ${doc.introduction || "empty"}. Goals: ${doc.goals || "empty"}. Sources: ${evidence.map((item) => item.title).join("; ") || "none"}.`,
            },
          ],
        }),
      });
      const body = (await res.json()) as { reply?: string; error?: string };
      const text = (res.ok ? body.reply : body.error) || "Kismet could not comment.";
      commit({
        ...doc,
        comments: [
          ...doc.comments,
          { id: crypto.randomUUID(), author: "Kismet", color: "#0571d3", section: "document", body: text.trim(), at: new Date().toISOString() },
        ],
      });
    } catch {
      commit({
        ...doc,
        comments: [
          ...doc.comments,
          { id: crypto.randomUUID(), author: "Kismet", color: "#0571d3", section: "document", body: "Kismet could not comment.", at: new Date().toISOString() },
        ],
      });
    } finally {
      setAsking(false);
    }
  }

  return (
    <PrdStory
      editing
      title={title}
      doc={doc}
      evidence={evidence}
      links={links}
      agents={here.map(storyAgent)}
      asking={asking}
      writing={writing}
      pending={recordSources.filter((item) => !doc.appliedSources.includes(item.id))}
      onTitle={setTitle}
      onCommitTitle={commitTitle}
      onChange={setDoc}
      onCommit={commit}
      onAsk={() => void ask()}
      onWrite={() => void writeFromSources()}
      onApply={applyRecord}
      toolbar={
        <ShareBox
          open={shareOpen}
          onOpen={setShareOpen}
          title={title || feature.title}
          doc={doc}
          evidence={evidence}
          links={links}
          onCommit={commit}
        />
      }
    />
  );
}

function ShareBox({
  open,
  onOpen,
  title,
  doc,
  evidence,
  links,
  onCommit,
}: {
  open: boolean;
  onOpen: (open: boolean) => void;
  title: string;
  doc: LivingDoc;
  evidence: StoryEvidence[];
  links: StoryLink[];
  onCommit: (doc: LivingDoc) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");
  const [domain, setDomain] = useState(doc.domain);
  const [invited, setInvited] = useState(doc.invited.join(", "));

  async function copy() {
    const next: LivingDoc = {
      ...doc,
      domain: domainOf(domain),
      invited: invited
        .split(/[\s,]+/)
        .map((item) => item.trim().toLowerCase())
        .filter((item) => item.includes("@")),
    };
    if (next.audience === "domain" && !next.domain) {
      setNote("Add the company domain first.");
      return;
    }
    if (next.audience === "invited" && next.invited.length === 0) {
      setNote("Add at least one email.");
      return;
    }
    setNote("");
    onCommit(next);
    const share: PrdShare = {
      v: 1,
      title: title.trim() || "Untitled PRD",
      ...next,
      evidence: evidence.map((item) => ({ type: item.type, title: item.title, detail: item.detail })),
      links: links.map((item) => ({ type: item.type, title: item.title })),
    };
    const url = `${window.location.origin}/p/${encodeShare(share)}`;
    setLink(url);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => onOpen(!open)} className="h-8 rounded-md bg-foreground px-3 text-xs text-background">
        Share
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-border bg-background p-3 shadow-lg">
          <p className="text-sm font-medium">Share this PRD</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Anyone who can open the link can view it. Editing asks them to create a Kismet account.
          </p>
          <div className="mt-3 space-y-2 text-sm">
            <Audience value="anyone" current={doc.audience} onChange={(audience) => onCommit({ ...doc, audience })} label="Anyone with the link" />
            <Audience value="domain" current={doc.audience} onChange={(audience) => onCommit({ ...doc, audience })} label="Anyone at a company domain" />
            {doc.audience === "domain" && (
              <input
                value={domain}
                onChange={(event) => setDomain(event.target.value)}
                placeholder="company.com"
                aria-label="Email domain"
                className="h-8 w-full rounded-md border border-input px-2 text-sm outline-none"
              />
            )}
            <Audience value="invited" current={doc.audience} onChange={(audience) => onCommit({ ...doc, audience })} label="Only these emails" />
            {doc.audience === "invited" && (
              <textarea
                value={invited}
                onChange={(event) => setInvited(event.target.value)}
                placeholder="ada@company.com, lin@company.com"
                aria-label="Invited emails"
                rows={2}
                className="w-full rounded-md border border-input px-2 py-1 text-sm outline-none"
              />
            )}
          </div>
          <button type="button" onClick={() => void copy()} className="mt-3 h-8 w-full rounded-md border border-border text-xs">
            {copied ? "Link copied" : "Copy link"}
          </button>
          {note && <p className="mt-2 text-xs text-muted-foreground">{note}</p>}
          {link && (
            <input readOnly value={link} aria-label="Share link" className="mt-2 w-full truncate rounded-md border border-input px-2 py-1 text-[11px] outline-none" />
          )}
        </div>
      )}
    </div>
  );
}

function Audience({
  value,
  current,
  label,
  onChange,
}: {
  value: PrdAudience;
  current: PrdAudience;
  label: string;
  onChange: (value: PrdAudience) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <input type="radio" name="prd-audience" checked={current === value} onChange={() => onChange(value)} />
      {label}
    </label>
  );
}

export function rememberSharedPrd(token: string) {
  try {
    localStorage.setItem(PENDING_KEY, token);
  } catch {
    // The share page still shows the brief if storage is blocked.
  }
}

export function takeSharedPrd(): string | null {
  try {
    return localStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
}

export function clearSharedPrd() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    // Nothing to clear.
  }
}

function connectedPrd(featureId: string, nodes: GraphNode[], edges: { sourceId: string; targetId: string }[]) {
  const ids = edges.filter((edge) => edge.sourceId === featureId || edge.targetId === featureId).map((edge) => (edge.sourceId === featureId ? edge.targetId : edge.sourceId));
  return nodes.find((node) => ids.includes(node.id) && node.type === "PRD");
}

function evidenceFor(featureId: string, nodes: GraphNode[], edges: { sourceId: string; targetId: string }[]): StoryEvidence[] {
  return neighbors(featureId, nodes, edges)
    .filter((node) => isEvidenceType(node.type))
    .map((node) => ({
      id: node.id,
      type: node.type,
      title: node.title,
      detail: node.description ?? node.summary ?? "",
      href: hrefFor(node),
    }));
}

function linksFor(featureId: string, prdId: string, nodes: GraphNode[], edges: { sourceId: string; targetId: string }[]): StoryLink[] {
  const seen = new Set<string>();
  return [...neighbors(featureId, nodes, edges), ...neighbors(prdId, nodes, edges)]
    .filter((node) => node.type !== "PRODUCT" && node.id !== prdId && node.id !== featureId && !seen.has(node.id) && seen.add(node.id))
    .map((node) => ({ id: node.id, type: node.type, title: node.title, href: hrefFor(node) }));
}

function neighbors(id: string, nodes: GraphNode[], edges: { sourceId: string; targetId: string }[]) {
  const ids = edges.filter((edge) => edge.sourceId === id || edge.targetId === id).map((edge) => (edge.sourceId === id ? edge.targetId : edge.sourceId));
  return nodes.filter((node) => ids.includes(node.id));
}

function hrefFor(node: GraphNode): string {
  if (node.type === "FEATURE") return `/features/${node.id}`;
  if (node.type === "EXPERIMENT") return `/experiments/${node.id}`;
  if (node.type === "FIGMA_FRAME" && typeof node.metadata.url === "string") return node.metadata.url;
  return `/graph?node=${node.id}`;
}

function readPrdJson(reply: string): {
  introduction: string;
  goals: string;
  nonGoals: string;
  overview: string;
  design: string;
  security: string;
  privacy: string;
  testing: string;
  requirements: { id: string; text: string; priority: number }[];
} {
  const start = reply.indexOf("{");
  const end = reply.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The draft was not a document.");
  const parsed = JSON.parse(reply.slice(start, end + 1)) as Record<string, unknown>;
  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const requirements = Array.isArray(parsed.requirements)
    ? parsed.requirements
        .filter((item): item is { text?: string; priority?: number } => Boolean(item) && typeof item === "object")
        .map((item) => ({
          id: crypto.randomUUID(),
          text: text(item.text),
          priority: Math.min(10, Math.max(1, Math.round(Number(item.priority) || 5))),
        }))
        .filter((item) => item.text)
        .slice(0, 40)
    : [];
  return {
    introduction: text(parsed.introduction),
    goals: text(parsed.goals),
    nonGoals: text(parsed.nonGoals),
    overview: text(parsed.overview),
    design: text(parsed.design),
    security: text(parsed.security),
    privacy: text(parsed.privacy),
    testing: text(parsed.testing),
    requirements,
  };
}

function storyAgent(agent: { id: string; name: string; color: string; activity: string; status: string }): StoryAgent {
  return { id: agent.id, name: agent.name, color: agent.color, activity: agent.activity, status: agent.status };
}
