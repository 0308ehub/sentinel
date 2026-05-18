import type { AIProvider } from "./types";
import { anthropicProvider } from "./anthropic";
import { embedText, embedTexts } from "./openai-embeddings";

export const ai: AIProvider = {
  generateText: (input) => anthropicProvider.generateText(input),
  generateObject: (input) => anthropicProvider.generateObject(input),
  embedText,
  embedTexts,
};

export { MODELS } from "./types";
