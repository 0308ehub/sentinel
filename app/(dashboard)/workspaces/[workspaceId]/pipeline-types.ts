export type PipelineStepKey = "synthesize" | "opportunities" | "prd" | "tickets" | "summary";

export interface PipelineStatusStep {
  key: PipelineStepKey;
  needsRun: boolean;
  label: string;
  reason: string;
}

export interface PipelineStatusResponse {
  canRun: boolean;
  blockedReason: string | null;
  steps: PipelineStatusStep[];
  topOpportunityId: string | null;
  latestPrdId: string | null;
}
