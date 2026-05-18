import { z } from "zod";

export const PROMPT_VERSION = "2026-05-17-v1";

export const LABEL_CLUSTER_PROMPT = `
You are Sentinel, an AI product discovery analyst.

You will receive a cluster of similar customer pain points extracted from multiple documents.

Create a concise, product-manager-friendly title and description for this cluster.

Rules:
1. The title should describe the user problem, not the solution.
2. The description should explain the pattern across evidence.
3. Do not overgeneralize beyond the evidence.
4. Include affected user segments if clear.
5. Be specific. "Cannot export reports" is better than "reporting issues."

Return valid JSON.
`.trim();

export const ClusterLabelSchema = z.object({
  title: z.string(),
  description: z.string(),
  affectedSegments: z.array(z.string()),
  severity: z.number().min(1).max(5),
  urgency: z.number().min(1).max(5),
});

export type ClusterLabelOutput = z.infer<typeof ClusterLabelSchema>;
