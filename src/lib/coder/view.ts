export type CoderItem =
  | { kind: "user"; text: string }
  | { kind: "agent"; text: string }
  | { kind: "step"; tool: string; summary: string; isError: boolean; command?: string }
  | { kind: "error"; text: string };

export interface CoderView {
  status: "idle" | "running" | "rescheduling" | "terminated";
  stopReason: string | null;
  costCents: string;
  items: CoderItem[];
  pendingApproval: { toolUseId: string; tool: string; summary: string } | null;
  branch: string | null;
}

interface InputEvent {
  type: string;
  id?: string;
  content?: unknown;
  name?: string;
  input?: Record<string, unknown>;
  evaluated_permission?: string;
  tool_use_id?: string;
  is_error?: boolean | null;
  error?: unknown;
  stop_reason?: { type?: string } | null;
}

interface InputSession {
  status: CoderView["status"];
  usage?: { list_cost?: { amount?: string; currency?: string } | null };
}

const BRANCH_LINE = /^BRANCH:\s*(kismet\/[A-Za-z0-9._\/-]+)\s*$/gm;

function textContent(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content
    .filter((block): block is { type: "text"; text: string } =>
      Boolean(block && typeof block === "object" && (block as { type?: unknown }).type === "text" &&
        typeof (block as { text?: unknown }).text === "string"),
    )
    .map((block) => block.text)
    .join("\n")
    .trim();
}

function short(value: unknown): string {
  return typeof value === "string" ? value.split("\n", 1)[0].trim().slice(0, 120) : "";
}

export function toolSummary(tool: string, input: Record<string, unknown> = {}): string {
  const path = short(input.file_path ?? input.path);
  if (tool === "bash") return `Ran \`${short(input.command) || "a command"}\``;
  if (tool === "read") return `Read ${path || "a file"}`;
  if (tool === "write") return `Wrote ${path || "a file"}`;
  if (tool === "edit") return `Edited ${path || "a file"}`;
  if (tool === "glob") return `Searched for ${short(input.pattern) || "files"}`;
  if (tool === "grep") return `Searched for ${short(input.pattern ?? input.query) || "text"}`;
  return `${tool.replace(/_/g, " ")} ${path}`.trim();
}

function errorText(error: unknown): string {
  if (!error || typeof error !== "object") return "The coding agent encountered an error.";
  const record = error as Record<string, unknown>;
  const message = typeof record.message === "string" ? record.message.trim() : "";
  return message || "The coding agent encountered an error.";
}

export function toCoderView(events: readonly InputEvent[], session: InputSession): CoderView {
  const results = new Map<string, boolean>();
  const answered = new Set<string>();
  for (const event of events) {
    if (event.type === "agent.tool_result" && event.tool_use_id) results.set(event.tool_use_id, Boolean(event.is_error));
    if (event.type === "user.tool_confirmation" && event.tool_use_id) answered.add(event.tool_use_id);
  }

  const items: CoderItem[] = [];
  let pendingApproval: CoderView["pendingApproval"] = null;
  let branch: string | null = null;
  let stopReason: string | null = null;
  for (const event of events) {
    if (event.type === "user.message") {
      const text = textContent(event.content);
      if (text) items.push({ kind: "user", text });
    } else if (event.type === "agent.message") {
      let text = textContent(event.content);
      for (const match of text.matchAll(BRANCH_LINE)) branch = match[1];
      text = text.replace(BRANCH_LINE, "").trim();
      if (text) items.push({ kind: "agent", text });
    } else if (event.type === "agent.tool_use" && event.id && event.name) {
      const summary = toolSummary(event.name, event.input);
      // The full shell command (capped) lets Kismet tell reading from writing and checks; the summary is cut short.
      const command = event.name === "bash" && typeof event.input?.command === "string" ? event.input.command.slice(0, 4000) : undefined;
      items.push({ kind: "step", tool: event.name, summary, isError: results.get(event.id) ?? false, ...(command ? { command } : {}) });
      if (event.evaluated_permission === "ask" && !answered.has(event.id)) {
        pendingApproval = { toolUseId: event.id, tool: event.name, summary };
      }
    } else if (event.type === "session.error") {
      items.push({ kind: "error", text: errorText(event.error) });
    } else if (event.type === "session.status_idle") {
      stopReason = event.stop_reason?.type ?? null;
    }
  }

  return {
    status: session.status,
    stopReason,
    costCents: session.usage?.list_cost?.amount ?? "0",
    items,
    pendingApproval,
    branch,
  };
}
