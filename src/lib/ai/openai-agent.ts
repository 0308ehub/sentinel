import "server-only";

import type { ModelRequest } from "@/lib/ai/types";
import { runWarehouseTool, type WarehouseQuery } from "@/lib/ai/warehouse-tool";

interface ResponseItem {
  type?: string;
  name?: string;
  arguments?: string;
  call_id?: string;
  content?: { type?: string; text?: string; annotations?: { type?: string; url?: string; title?: string }[] }[];
}

interface ResponsesBody {
  id?: string;
  error?: { message?: string };
  output_text?: string;
  output?: ResponseItem[];
}

export async function runOpenAI(key: string, model: string, request: ModelRequest) {
  if (!key) throw new Error("Add OPENAI_API_KEY to .env and restart the dev server.");
  if (typeof request.input === "string") return runJson(key, model, request, request.input);
  return runChat(key, model, request, request.input);
}

async function runChat(key: string, model: string, request: ModelRequest, messages: { role: "user" | "assistant"; content: string }[]) {
  const queries: WarehouseQuery[] = [];
  const tools = [
    ...(request.web ? [{ type: "web_search", search_context_size: request.deep ? "high" : "medium" }] : []),
    ...(request.databricks
      ? [
          {
            type: "function",
            name: "query_databricks",
            description: "Run one read-only Spark SQL query on the connected Databricks warehouse and return up to 100 rows.",
            parameters: {
              type: "object",
              properties: { sql: { type: "string", description: "One SELECT, WITH, SHOW, DESCRIBE, or EXPLAIN statement." } },
              required: ["sql"],
              additionalProperties: false,
            },
            strict: true,
          },
        ]
      : []),
  ];
  let payload = await ask(key, {
    model,
    reasoning: { effort: request.deep ? "high" : "low" },
    ...(tools.length > 0 ? { tools } : {}),
    instructions: request.instructions,
    input: messages,
  });
  const outputs = [...(payload.output ?? [])];
  for (let step = 0; step < 4; step++) {
    const calls = (payload.output ?? []).filter((item) => item.type === "function_call" && item.name === "query_databricks" && item.call_id);
    if (calls.length === 0 || !payload.id) break;
    const toolResults = [];
    for (const call of calls) {
      const ran = await runWarehouseTool(call.arguments, 40);
      queries.push(ran.query);
      toolResults.push({ type: "function_call_output", call_id: call.call_id, output: ran.output });
    }
    payload = await ask(key, {
      model,
      previous_response_id: payload.id,
      reasoning: { effort: request.deep ? "high" : "low" },
      ...(tools.length > 0 ? { tools } : {}),
      input: toolResults,
    });
    outputs.push(...(payload.output ?? []));
  }
  const text = textFrom(payload);
  if (!text) throw new Error("OpenAI returned an empty reply.");
  const sources = outputs
    .flatMap((item) => item.content ?? [])
    .flatMap((part) => part.annotations ?? [])
    .filter((note) => note.type === "url_citation" && note.url)
    .map((note) => ({ title: note.title || note.url!, url: note.url! }))
    .filter((source, index, all) => all.findIndex((item) => item.url === source.url) === index)
    .slice(0, 6);
  return { text, queries, sources, searched: outputs.some((item) => item.type === "web_search_call") };
}

async function runJson(key: string, model: string, request: ModelRequest, input: string) {
  const queries: WarehouseQuery[] = [];
  const tools = request.databricks
    ? [
        {
          type: "function",
          name: "query_databricks",
          description: "Run one read-only SQL query on Databricks.",
          parameters: {
            type: "object",
            properties: { sql: { type: "string" } },
            required: ["sql"],
            additionalProperties: false,
          },
          strict: true,
        },
      ]
    : undefined;
  const textFormat = request.schema
    ? { text: { format: { type: "json_schema", name: "feature_json", strict: true, schema: request.schema } } }
    : {};
  let payload = await ask(key, {
    model,
    reasoning: { effort: "low" },
    ...(tools ? { tools } : {}),
    ...textFormat,
    instructions: request.instructions,
    input,
  });
  for (let step = 0; step < 4; step++) {
    const calls = (payload.output ?? []).filter((item) => item.type === "function_call" && item.call_id);
    if (calls.length === 0 || !payload.id) break;
    const finish = step === 3;
    const toolResults = [];
    for (const call of calls) {
      const ran = call.name === "query_databricks" ? await runWarehouseTool(call.arguments, 20) : null;
      if (ran) queries.push(ran.query);
      const output = ran?.output ?? JSON.stringify({ error: "That tool is not available." });
      toolResults.push({
        type: "function_call_output",
        call_id: call.call_id,
        output: finish ? `${output}\nReturn the JSON object now. Do not call another tool.` : output,
      });
    }
    payload = await ask(key, {
      model,
      previous_response_id: payload.id,
      reasoning: { effort: "low" },
      ...(finish ? {} : tools ? { tools } : {}),
      ...textFormat,
      input: toolResults,
    });
  }
  let text = textFrom(payload);
  const waiting = (payload.output ?? []).some((item) => item.type === "function_call" && item.call_id);
  if (!text && payload.id && !waiting) {
    payload = await ask(key, {
      model,
      previous_response_id: payload.id,
      reasoning: { effort: "low" },
      ...textFormat,
      input: "Return the JSON object now.",
    });
    text = textFrom(payload);
  }
  if (!text) throw new Error("OpenAI returned an empty reply.");
  return { text, queries, sources: [], searched: false };
}

async function ask(key: string, body: unknown): Promise<ResponsesBody> {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await res.json()) as ResponsesBody;
  if (!res.ok) throw new Error(payload.error?.message ?? "OpenAI request failed.");
  return payload;
}

function textFrom(body: ResponsesBody): string {
  const direct = body.output_text?.trim();
  if (direct) return direct;
  const flat = (body.output ?? [])
    .flatMap((item) => item.content ?? [])
    .map((part) => part.text ?? "")
    .filter(Boolean)
    .join("\n")
    .trim();
  return flat || collectText(body.output).trim();
}

function collectText(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  if (Array.isArray(value)) return value.map(collectText).filter(Boolean).join("\n");
  const record = value as Record<string, unknown>;
  if (record.type === "function_call") return "";
  const own = typeof record.text === "string" ? record.text : "";
  const nested = Object.entries(record)
    .filter(([key]) => key !== "text" && key !== "arguments")
    .map(([, child]) => collectText(child))
    .filter(Boolean)
    .join("\n");
  return [own, nested].filter(Boolean).join("\n");
}
