export type MoveTable = { table: string; conflictKeys?: readonly string[]; excluded?: "private" | "shared-claim" };

/** Every kismet table with user_id. Keep in sync with the schema in autopilot/db.ts. */
export const MOVE_TABLES: readonly MoveTable[] = [
  { table: "agent_spend" }, { table: "autopilot_learnings", conflictKeys: ["experiment_id"] },
  { table: "autopilot_goals" }, { table: "flags", conflictKeys: ["key"] },
  { table: "events" }, { table: "activity" }, { table: "evidence" }, { table: "signals" },
  { table: "experiments", conflictKeys: ["flag"] }, { table: "feedback" },
  { table: "suggestion_ratings", conflictKeys: ["target_kind", "target_id"] },
  { table: "autopilot_repo", conflictKeys: [] }, { table: "autopilot_builder", conflictKeys: [] },
  { table: "autopilot_notify_prefs", conflictKeys: [] },
  { table: "autopilot_notifications", conflictKeys: ["event_key"] },
  { table: "autopilot_tick_lock", conflictKeys: [] }, { table: "slack_mention_claims", excluded: "shared-claim" },
  { table: "autopilot_sites", conflictKeys: [] }, { table: "connections", conflictKeys: ["provider"] },
  { table: "slack_mentions", conflictKeys: [] }, { table: "inbox_agents", conflictKeys: ["slug"] },
  { table: "inbox_threads", conflictKeys: ["key"] }, { table: "inbox_removed", conflictKeys: ["slug"] },
  { table: "inbox_messages" }, { table: "inbox_findings", conflictKeys: ["semantic_key"] },
  { table: "inbox_finding_events" }, { table: "inbox_status", conflictKeys: ["agent_id"] },
  { table: "inbox_prefs", conflictKeys: [] }, { table: "inbox_weights", conflictKeys: ["signal_type"] },
  { table: "workspace_state", conflictKeys: ["key"] },
  { table: "coder_sessions", excluded: "private" },
  { table: "experiment_snapshots", conflictKeys: ["experiment_id", "sha"] },
  { table: "render_recipes", conflictKeys: ["repo"] },
] as const;

export function movableTables(): readonly MoveTable[] {
  return MOVE_TABLES.filter((entry) => !entry.excluded);
}

/** Personal clearing includes private sessions, but never shared Slack claim coordination. */
export function clearableTables(): readonly MoveTable[] {
  return MOVE_TABLES.filter((entry) => entry.excluded !== "shared-claim");
}

export function conflictPredicate(entry: MoveTable, sourceAlias = "source", targetAlias = "target"): string | null {
  if (!entry.conflictKeys) return null;
  if (entry.conflictKeys.length === 0) return "true";
  return entry.conflictKeys.map((key) => `${targetAlias}.${key} = ${sourceAlias}.${key}`).join(" and ");
}
