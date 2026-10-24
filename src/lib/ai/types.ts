import type { OrchestratedTask, ProviderId } from "@/lib/ai/policy";
import type { WarehouseQuery } from "@/lib/ai/warehouse-tool";

export interface ModelTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ModelRequest {
  task: OrchestratedTask;
  instructions: string;
  input: ModelTurn[] | string;
  databricks: boolean;
  web: boolean;
  deep: boolean;
  prefer?: ProviderId;
  schema?: Record<string, unknown>;
}

export interface ModelAnswer {
  text: string;
  queries: WarehouseQuery[];
  sources: { title: string; url: string }[];
  searched: boolean;
  provider: ProviderId;
  model: string;
  reason: string;
  fellBack: boolean;
}
