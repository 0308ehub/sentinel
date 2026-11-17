"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsShell } from "@/components/settings/settings-shell";
import { useWorkspaceUsage } from "@/components/settings/use-workspace-usage";
import { ORG } from "@/lib/settings";

function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const width = Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {used} / {limit}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export function BillingSettingsView() {
  const usage = useWorkspaceUsage();
  const renews = new Date(ORG.planRenewsAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <SettingsShell title="Plan & billing" description="Plan, seats, and activity for this workspace">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Plan</CardTitle>
            <CardDescription>Renews {renews}. Invoices and the payment method show up here once billing is connected.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{ORG.plan} plan</span>
              <Badge variant="success">Active</Badge>
            </div>
            <Meter label="Seats" used={ORG.seatsUsed} limit={ORG.seats} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity</CardTitle>
            <CardDescription>This month and last month, from the graph, chats, and agents in this browser</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {usage ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2 font-medium"> </th>
                    <th className="px-4 py-2 font-medium">This month</th>
                    <th className="px-4 py-2 font-medium">Last month</th>
                  </tr>
                </thead>
                <tbody>
                  <ActivityRow label="Chat messages" current={usage.thisMonth.chats} previous={usage.lastMonth.chats} />
                  <ActivityRow label="Agent messages" current={usage.thisMonth.agents} previous={usage.lastMonth.agents} />
                  <ActivityRow label="Records added" current={usage.thisMonth.records} previous={usage.lastMonth.records} />
                </tbody>
              </table>
            ) : (
              <p className="px-4 py-6 text-sm text-muted-foreground">Reading workspace activity…</p>
            )}
          </CardContent>
        </Card>
      </div>
    </SettingsShell>
  );
}

function ActivityRow({ label, current, previous }: { label: string; current: number; previous: number }) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-4 py-3">{label}</td>
      <td className="px-4 py-3 tabular-nums">{current}</td>
      <td className="px-4 py-3 tabular-nums text-muted-foreground">{previous}</td>
    </tr>
  );
}
