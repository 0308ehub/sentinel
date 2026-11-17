import type { NotifyMode } from "@/lib/inbox/score";

export interface InboxAgent {
  id: string;
  slug: string;
  name: string;
  icon: string;
  color: string;
  instructions: string;
  spec: string;
  boost: number;
  pinned: boolean;
  muted: boolean;
  ignoredStreak: number;
}

export interface InboxThread {
  id: string;
  kind: "direct" | "pod";
  title: string;
  pinned: boolean;
  updatedAt: string;
  preview: string;
  previewAt: string | null;
  unread: number;
  typing: boolean;
  pinOrder: number;
  agents: InboxAgent[];
}

export interface InboxMessage {
  id: string;
  sender: "user" | "agent";
  agentId: string | null;
  type: "TEXT" | "SIGNAL_CARD" | "REPORT" | "SYSTEM_STATUS";
  body: string;
  signalId: string | null;
  replyTo: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export interface InboxPrefs {
  mode: NotifyMode;
  workStart: number;
  workEnd: number;
  tzOffset: number;
  idleHours: number;
  sessionCap: number;
  dailyInterruptBudget: number;
  slackInterrupts: boolean;
  slackChannel: string;
  weights: { type: string; weight: number; autonomy: string }[];
  agents: { id: string; name: string; muted: boolean }[];
}

export interface AgentPatch {
  name?: string;
  icon?: string;
  color?: string;
  pinned?: boolean;
  muted?: boolean;
  instructions?: string;
  spec?: string;
  boost?: number;
}
