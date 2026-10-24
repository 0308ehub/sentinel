import "server-only";

import { readPolicy, type ModelPolicy } from "@/lib/ai/policy";

export interface ProviderConfig {
  claudeReady: boolean;
  openaiReady: boolean;
  claudeModel: string;
  openaiModel: string;
  policy: ModelPolicy;
  claudeKey: string;
  openaiKey: string;
}

export function providerConfig(): ProviderConfig {
  const claudeKey = process.env.ANTHROPIC_API_KEY?.trim() ?? "";
  const openaiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
  return {
    claudeKey,
    openaiKey,
    claudeReady: Boolean(claudeKey),
    openaiReady: Boolean(openaiKey),
    claudeModel: process.env.ANTHROPIC_MODEL?.trim() || "claude-opus-5-5",
    openaiModel: process.env.OPENAI_MODEL?.trim() || "gpt-5.5",
    policy: readPolicy(process.env.KISMET_MODEL_POLICY?.trim()),
  };
}
