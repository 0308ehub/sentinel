import "server-only";

import type { ModelRequest } from "@/lib/ai/types";
import { runWarehouseTool, type WarehouseQuery } from "@/lib/ai/warehouse-tool";

interface ClaudeBlock {
  type?: string;
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
  content?: ClaudeBlock[] | string;
  citations?: { url?: string; title?: string }[];
  url?: string;
  title?: string;
}

interface ClaudeBody {
  content?: ClaudeBlock[];
  stop_reason?: string;
  error?: { message?: string };
}

type ClaudeMessage = { role: "user" | "assistant"; content: string | ClaudeBlock[] };

const DATABRICKS_TOOL = {
  name: "query_databricks",
  description:
    "Run one read-only Spark SQL query on the connected Databricks warehouse. Use one SELECT, WITH, SHOW, DESCRIBE, or EXPLAIN statement.",
  input_schema: {
    type: "object",
    properties: {
      sql: { type: "string", description: "One read-only SQL statement." },
    },
    required: ["sql"],
  },
};

export async function runClaude(key: string, model: string, request: ModelRequest) {
  if (!key) throw new Error("Add ANTHROPIC_API_KEY to .env and restart the dev server.");
  const queries: WarehouseQuery[] = [];
  const sources: { title: string; url: string }[] = [];
  let searched = false;
  const messages = toMessages(request.input);
  const effort = request.deep || request.task === "chat" || request.task === "recommendations" || request.databricks ? "high" : "low";
  let webTool: "web_search_20260209" | "web_search_20250305" | null = request.web ? "web_search_20260209" : null;
  let text = "";

  for (let step = 0; step < 6; step++) {
    const last = step === 5;
    const tools = last
      ? undefined
      : [
          ...(request.databricks ? [DATABRICKS_TOOL] : []),
          ...(webTool ? [{ type: webTool, name: "web_search", max_uses: 4 }] : []),
        ];
    const format = request.schema && (last || !request.databricks) ? { type: "json_schema", schema: request.schema } : undefined;
    let body = await createMessage(key, {
      model,
      max_tokens: effort === "high" ? 16000 : 4000,
      system: request.instructions,
      messages,
      ...(tools && tools.length > 0 ? { tools } : {}),
      output_config: { effort, ...(format ? { format } : {}) },
    });
    if (body.status === 400 && webTool === "web_search_20260209" && /web_search/i.test(body.error)) {
      webTool = "web_search_20250305";
      continue;
    }
    if (body.status === 400 && format) {
      body = await createMessage(key, {
        model,
        max_tokens: effort === "high" ? 16000 : 4000,
        system: request.instructions,
        messages,
        ...(tools && tools.length > 0 ? { tools } : {}),
        output_config: { effort },
      });
    }
    if (!body.ok) throw new Error(body.error || "Claude request failed.");

    const content = body.content;
    const found = readBlocks(content);
    searched = searched || found.searched;
    for (const source of found.sources) {
      if (!sources.some((item) => item.url === source.url)) sources.push(source);
    }
    const calls = content.filter((block) => block.type === "tool_use" && block.id);
    if (calls.length > 0 && !last) {
      messages.push({ role: "assistant", content });
      const results: ClaudeBlock[] = [];
      for (const call of calls) {
        const ran = call.name === "query_databricks" ? await runWarehouseTool(call.input, 40) : null;
        if (ran) queries.push(ran.query);
        results.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: ran?.output ?? JSON.stringify({ error: "That tool is not available." }),
        } as ClaudeBlock);
      }
      messages.push({ role: "user", content: results });
      continue;
    }
    if (body.stopReason === "pause_turn" && !last) {
      messages.push({ role: "assistant", content });
      continue;
    }
    text = found.text;
    break;
  }

  if (!text) throw new Error("Claude returned an empty reply.");
  return { text, queries, sources: sources.slice(0, 6), searched };
}

async function createMessage(key: string, payload: unknown): Promise<{
  ok: boolean;
  status: number;
  error: string;
  content: ClaudeBlock[];
  stopReason?: string;
}> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2026-10-21",
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const raw = await res.text();
  let parsed: ClaudeBody = {};
  try {
    parsed = JSON.parse(raw) as ClaudeBody;
  } catch {
    parsed = {};
  }
  return {
    ok: res.ok,
    status: res.status,
    error: parsed.error?.message || `Claude returned ${res.status}.`,
    content: parsed.content ?? [],
    stopReason: parsed.stop_reason,
  };
}

function toMessages(input: ModelRequest["input"]): ClaudeMessage[] {
  const turns = typeof input === "string" ? [{ role: "user" as const, content: input }] : input;
  const messages: ClaudeMessage[] = [];
  for (const turn of turns) {
    const text = turn.content.trim();
    if (!text) continue;
    const last = messages[messages.length - 1];
    if (last && last.role === turn.role && typeof last.content === "string") last.content = `${last.content}\n\n${text}`;
    else messages.push({ role: turn.role, content: text });
  }
  while (messages[0]?.role === "assistant") messages.shift();
  if (messages.length === 0) messages.push({ role: "user", content: "Continue." });
  return messages;
}

function readBlocks(blocks: ClaudeBlock[]) {
  const texts: string[] = [];
  const sources: { title: string; url: string }[] = [];
  let searched = false;
  const visit = (block: ClaudeBlock) => {
    if (block.type === "text" && block.text?.trim()) texts.push(block.text.trim());
    if (block.type === "server_tool_use" || (typeof block.type === "string" && block.type.includes("web_search"))) searched = true;
    if (block.name === "web_search") searched = true;
    for (const cite of block.citations ?? []) pushSource(sources, cite.url, cite.title);
    pushSource(sources, block.url, block.title);
    if (Array.isArray(block.content)) block.content.forEach(visit);
  };
  blocks.forEach(visit);
  return { text: texts.join("\n").trim(), sources, searched };
}

function pushSource(sources: { title: string; url: string }[], url: string | undefined, title: string | undefined) {
  if (!url || !/^https?:\/\//.test(url)) return;
  if (sources.some((item) => item.url === url)) return;
  sources.push({ url, title: title?.trim() || url });
}
