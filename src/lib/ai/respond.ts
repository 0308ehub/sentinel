import { getDatabricksPrompt } from "@/lib/databricks/context";
import { getJiraContext } from "@/lib/jira/context";
import { getSlackContext } from "@/lib/slack/context";
import { runOrchestrated } from "@/lib/ai/orchestrate";
import type { OrchestratedTask } from "@/lib/ai/policy";
import { workspaceBrief } from "@/lib/workspace/cloud";
import { postgresBrief } from "@/lib/postgres/client";
import { currentUserId } from "@/lib/connections/current";

export async function sourceBrief(): Promise<string> {
  const parts: string[] = [];
  try {
    const slack = await getSlackContext();
    if (slack.text) parts.push(`Slack:\n${slack.text.slice(0, 6000)}`);
  } catch {
    parts.push("Slack could not be read.");
  }
  try {
    const jira = await getJiraContext();
    if (jira.text) parts.push(`Jira:\n${jira.text.slice(0, 4000)}`);
  } catch {
    parts.push("Jira could not be read.");
  }
  try {
    const warehouse = await getDatabricksPrompt();
    if (warehouse) parts.push(warehouse);
  } catch {
    parts.push("Databricks could not be read.");
  }
  const workspace = await workspaceBrief(await currentUserId());
  if (workspace) parts.push(workspace);
  const database = await postgresBrief();
  if (database) parts.push(database);
  return parts.join("\n\n");
}

export async function askForJson(
  instructions: string,
  input: string,
  warehouse = false,
  schema?: Record<string, unknown>,
  task: OrchestratedTask = "feature-draft"
): Promise<string> {
  const answer = await runOrchestrated({
    task,
    instructions,
    input,
    databricks: warehouse,
    web: false,
    deep: false,
    schema,
  });
  return answer.text;
}

export function readJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced?.[1] ?? text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("The model did not return JSON.");
  return JSON.parse(raw.slice(start, end + 1)) as T;
}
