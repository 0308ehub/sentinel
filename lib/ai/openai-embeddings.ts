import OpenAI from "openai";
import { MODELS } from "./types";

let _client: OpenAI | null = null;
function getClient() {
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _client;
}

export async function embedText(text: string): Promise<number[]> {
  const response = await getClient().embeddings.create({
    model: MODELS.embeddings,
    input: text.replace(/\n/g, " "),
  });
  return response.data[0].embedding;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const response = await getClient().embeddings.create({
    model: MODELS.embeddings,
    input: texts.map((t) => t.replace(/\n/g, " ")),
  });

  return response.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}
