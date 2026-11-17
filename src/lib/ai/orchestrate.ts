import "server-only";

import { beginAiCall, BudgetError } from "@/lib/ai/budget";
import { runClaude } from "@/lib/ai/claude-agent";
import { runOpenAI } from "@/lib/ai/openai-agent";
import { chooseModel, type ProviderId } from "@/lib/ai/policy";
import { providerConfig } from "@/lib/ai/providers";
import type { ModelAnswer, ModelRequest, ModelTurn } from "@/lib/ai/types";

export type { ModelAnswer, ModelRequest, ModelTurn } from "@/lib/ai/types";

export function errorStatus(error: unknown, fallback = 502): number {
  return error instanceof ModelError ? error.status : fallback;
}

export class ModelError extends Error {
  constructor(
    message: string,
    readonly status = 502
  ) {
    super(message);
  }
}

export async function runOrchestrated(request: ModelRequest): Promise<ModelAnswer> {
  const chars = requestChars(request);
  const hold = await openHold(chars);
  const config = providerConfig();
  let decision;
  try {
    decision = chooseModel({
      task: request.task,
      needsTools: request.databricks,
      deep: request.deep,
      claudeReady: config.claudeReady,
      openaiReady: config.openaiReady,
      policy: config.policy,
      claudeModel: config.claudeModel,
      openaiModel: config.openaiModel,
      prefer: request.prefer,
    });
  } catch (error) {
    await hold.cancel().catch(() => undefined);
    throw new ModelError(error instanceof Error ? error.message : "No model is configured.", 503);
  }

  try {
    const answer = await runProvider(decision.provider, decision.model, request, config);
    await hold.finish(answer.text.length).catch(() => undefined);
    return { ...answer, provider: decision.provider, model: decision.model, reason: decision.reason, fellBack: false };
  } catch (error) {
    if (!decision.fallback) throw asModelError(error);
    const second = await openHold(chars);
    try {
      const answer = await runProvider(decision.fallback.provider, decision.fallback.model, request, config);
      await second.finish(answer.text.length).catch(() => undefined);
      const failed = decision.provider === "claude" ? "Claude" : "OpenAI";
      return {
        ...answer,
        provider: decision.fallback.provider,
        model: decision.fallback.model,
        reason: `${failed} failed, so this used ${decision.fallback.provider === "claude" ? "Claude" : "OpenAI"}.`,
        fellBack: true,
      };
    } catch (fallbackError) {
      const first = error instanceof Error ? error.message : "The first model failed.";
      const secondMessage = fallbackError instanceof Error ? fallbackError.message : "The fallback failed.";
      throw new ModelError(`${first} ${secondMessage}`);
    }
  }
}

async function openHold(chars: number) {
  try {
    return await beginAiCall(chars);
  } catch (error) {
    if (error instanceof BudgetError) throw new ModelError(error.message, error.status);
    throw error;
  }
}

async function runProvider(
  provider: ProviderId,
  model: string,
  request: ModelRequest,
  config: ReturnType<typeof providerConfig>
) {
  if (provider === "claude") return runClaude(config.claudeKey, model, request);
  return runOpenAI(config.openaiKey, model, request);
}

function requestChars(request: ModelRequest): number {
  const input = typeof request.input === "string" ? request.input : request.input.map((turn: ModelTurn) => turn.content).join("\n");
  return request.instructions.length + input.length;
}

function asModelError(error: unknown): ModelError {
  if (error instanceof ModelError) return error;
  return new ModelError(error instanceof Error ? error.message : "The model request failed.");
}
