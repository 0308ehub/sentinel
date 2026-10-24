import { graphStore } from "@/lib/graph/graph-store";
import { CURRENT_USER } from "@/lib/settings";
import type { Priority } from "@/types/graph";

export interface FeatureDraft {
  title: string;
  description: string;
  problem: string;
  priority: Priority;
  prd: string;
  goal: string;
  metric: string;
  why?: string;
}

export function saveFeatureDraft(draft: FeatureDraft, productId: string): string {
  const result = graphStore.getState().proposeFeature({
    title: draft.title,
    description: draft.description,
    customerProblemText: draft.problem,
    prdText: draft.prd,
    goalText: draft.goal,
    metricText: draft.metric,
    ownerId: CURRENT_USER.id,
    priority: draft.priority,
    primaryRepo: "",
    primaryRepoUrl: "",
    additionalRepos: [],
    scaffold: {
      customerProblem: Boolean(draft.problem.trim()),
      prd: true,
      goal: true,
      metric: true,
    },
    productId,
    source: draft.why,
  });
  return result.featureId;
}
