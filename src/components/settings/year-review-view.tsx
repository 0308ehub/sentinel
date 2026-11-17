"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsShell } from "@/components/settings/settings-shell";
import { useWorkspaceUsage } from "@/components/settings/use-workspace-usage";

export function YearReviewView() {
  const usage = useWorkspaceUsage();
  const year = usage?.year.year ?? new Date().getFullYear();

  return (
    <SettingsShell title="Year in review" description={`Your workspace in ${year}`}>
      {!usage ? (
        <p className="text-sm text-muted-foreground">Reading workspace activity…</p>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <Stat label="Active days" value={usage.year.activeDays} />
            <Stat label="Questions" value={usage.year.questions} />
            <Stat label="Records added" value={usage.year.records} />
            <Stat label="Experiments" value={usage.year.experiments} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>PRDs</CardTitle>
              <CardDescription>
                {usage.year.prds === 0
                  ? `No PRD records were added in ${year}.`
                  : `${usage.year.prds} PRD${usage.year.prds === 1 ? "" : "s"} added in ${year}.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                The workspace holds {usage.records} records, {usage.chatMessages} chat messages, and {usage.agentMessages} agent messages.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </SettingsShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
