"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SettingsShell } from "@/components/settings/settings-shell";
import { useWorkspaceUsage } from "@/components/settings/use-workspace-usage";
import { usageCsv, usageJson, type UsageReport, type UsageRow } from "@/lib/settings/usage";

export function UsageReportsView() {
  const usage = useWorkspaceUsage();

  return (
    <SettingsShell
      wide
      title="Usage reports"
      description="How this workspace uses Kismet. Counts come from the graph, chats, and agents stored in this browser."
    >
      {!usage ? (
        <p className="text-sm text-muted-foreground">Reading workspace activity…</p>
      ) : (
        <UsageBody usage={usage} />
      )}
    </SettingsShell>
  );
}

function UsageBody({ usage }: { usage: UsageReport }) {
  const max = Math.max(1, ...usage.weeks.map((week) => week.count));

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Active days" value={usage.activeDays90} hint="Last 90 days" />
        <Stat label="Questions" value={usage.questions} hint="Chat and agents" />
        <Stat label="Records" value={usage.records} hint="On the graph" />
        <Stat label="Agent messages" value={usage.agentMessages} hint="All time" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
          <CardDescription>Records added, chat messages, and agent messages, by week</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-28 items-end gap-1.5" aria-hidden={usage.weeks.every((week) => week.count === 0)}>
            {usage.weeks.map((week) => (
              <div key={week.start} className="flex h-full flex-1 items-end" title={`${week.label}: ${week.count}`}>
                <div
                  className="w-full rounded-sm bg-primary"
                  style={{ height: week.count ? `${Math.max(8, (week.count / max) * 100)}%` : "0%" }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
            <span>{usage.weeks[0]?.label}</span>
            <span>{usage.weeks[usage.weeks.length - 1]?.label}</span>
          </div>
          {usage.weeks.every((week) => week.count === 0) && (
            <p className="mt-3 text-xs text-muted-foreground">No activity in the last 12 weeks.</p>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="people">
        <TabsList>
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="records">Records</TabsTrigger>
        </TabsList>
        <TabsContent value="people" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Content in use</CardTitle>
              <CardDescription>What the workspace has the most of</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {usage.content.length === 0 ? (
                <p className="text-sm text-muted-foreground">No records yet.</p>
              ) : (
                usage.content.map((item) => (
                  <div key={item.name}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span>{item.name}</span>
                      <span className="tabular-nums text-muted-foreground">{item.count}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.max(4, (item.count / Math.max(usage.content[0]?.count ?? 1, 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="records" className="mt-4 space-y-3">
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => downloadReport("csv", usage.rows)}>
              Download CSV
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => downloadReport("json", usage.rows)}>
              Download JSON
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Record</th>
                    <th className="px-4 py-2 font-medium">Count</th>
                    <th className="px-4 py-2 font-medium">First seen</th>
                    <th className="px-4 py-2 font-medium">Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.rows.filter((row) => row.count > 0).map((row) => (
                    <tr key={row.name} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">{row.name}</td>
                      <td className="px-4 py-3 tabular-nums">{row.count}</td>
                      <td className="px-4 py-3 text-muted-foreground">{seen(row.firstSeen)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{seen(row.lastSeen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function seen(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function downloadReport(kind: "csv" | "json", rows: UsageRow[]) {
  const day = new Date().toISOString().slice(0, 10);
  const body = kind === "csv" ? usageCsv(rows) : usageJson(rows);
  const blob = new Blob([body], { type: kind === "csv" ? "text/csv" : "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `kismet-usage-${day}.${kind}`;
  link.click();
  URL.revokeObjectURL(url);
}
