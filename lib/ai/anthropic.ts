import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { jsonrepair } from "jsonrepair";
import type { AIProvider, GenerateTextInput, GenerateObjectInput } from "./types";
import { MODELS } from "./types";

let _client: Anthropic | null = null;
function getClient() {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

export function getAnthropicClient() {
  return getClient();
}

export const anthropicProvider: Pick<AIProvider, "generateText" | "generateObject"> = {
  async generateText({ system, messages, temperature = 0.3, maxTokens = 4096 }) {
    const response = await getClient().messages.create({
      model: MODELS.reasoning,
      max_tokens: maxTokens,
      temperature,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const block = response.content[0];
    if (block.type !== "text") throw new Error("Unexpected response type");
    return block.text;
  },

  async generateObject<T>({ system, prompt, schema, temperature = 0.2, maxTokens = 4096 }: GenerateObjectInput<T>): Promise<T> {
    const schemaDescription = JSON.stringify(zodToJsonSchema(schema), null, 2);

    const response = await getClient().messages.create({
      model: MODELS.reasoning,
      max_tokens: maxTokens,
      temperature,
      system: [
        system,
        `You must respond with valid JSON that matches this schema:\n${schemaDescription}`,
        "Return only the JSON object, no markdown fences or explanation.",
      ]
        .filter(Boolean)
        .join("\n\n"),
      messages: [{ role: "user", content: prompt }],
    });

    const block = response.content[0];
    if (block.type !== "text") throw new Error("Unexpected response type");

    let text = block.text.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "");

    // Extract the first complete JSON object in case the model added trailing commentary
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart !== -1 && jsonEnd > jsonStart) text = text.slice(jsonStart, jsonEnd + 1);

    // jsonrepair handles unescaped quotes, control characters, trailing commas, etc.
    const parsed = JSON.parse(jsonrepair(text));
    return schema.parse(parsed) as T;
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function zodToJsonSchema(schema: any): object {
  // Minimal JSON schema extraction for prompt injection
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodTypeAny>;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodTypeToJsonSchema(value);
      if (!(value instanceof z.ZodOptional)) required.push(key);
    }

    return { type: "object", properties, required };
  }
  return {};
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function zodTypeToJsonSchema(schema: any): object {
  if (schema instanceof z.ZodString) return { type: "string" };
  if (schema instanceof z.ZodNumber) return { type: "number" };
  if (schema instanceof z.ZodBoolean) return { type: "boolean" };
  if (schema instanceof z.ZodOptional) return zodTypeToJsonSchema(schema.unwrap());
  if (schema instanceof z.ZodArray)
    return { type: "array", items: zodTypeToJsonSchema(schema.element) };
  if (schema instanceof z.ZodEnum) return { type: "string", enum: schema.options };
  if (schema instanceof z.ZodObject) return zodToJsonSchema(schema);
  return {};
}
