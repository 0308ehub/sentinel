import { z } from "zod";

export interface GenerateTextInput {
  system?: string;
  messages: {
    role: "user" | "assistant";
    content: string;
  }[];
  temperature?: number;
  maxTokens?: number;
}

export interface GenerateObjectInput<T> {
  system?: string;
  prompt: string;
  schema: z.ZodSchema<T>;
  temperature?: number;
  maxTokens?: number;
}

export interface AIProvider {
  generateText(input: GenerateTextInput): Promise<string>;
  generateObject<T>(input: GenerateObjectInput<T>): Promise<T>;
  embedText(text: string): Promise<number[]>;
  embedTexts(texts: string[]): Promise<number[][]>;
}

export const MODELS = {
  reasoning: "claude-sonnet-4-6",
  fast: "claude-haiku-4-5-20251001",
  embeddings: "text-embedding-3-small",
} as const;
