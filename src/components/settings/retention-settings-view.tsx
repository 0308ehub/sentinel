"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsShell } from "@/components/settings/settings-shell";
import { Choice, fieldClass, Saved, useSavedFlag } from "@/components/settings/settings-form";
import {
  retentionCancelHours,
  updateWorkspace,
  useWorkspaceSettings,
  type RetentionMonths,
} from "@/lib/settings/workspace";

const PERIODS: { months: RetentionMonths; title: string; description: string }[] = [
  { months: 0, title: "Keep activity", description: "Workspace activity stays until you choose a period." },
  { months: 12, title: "12 months", description: "Activity older than a year is scheduled for deletion." },
  { months: 24, title: "24 months", description: "Activity older than two years is scheduled for deletion." },
  { months: 36, title: "36 months", description: "Activity older than three years is scheduled for deletion." },
];

export function RetentionSettingsView() {
  const settings = useWorkspaceSettings();
  const [months, setMonths] = useState<RetentionMonths>(settings.retentionMonths);
  const [sourceMonths, setSourceMonths] = useState(settings.retentionMonths);
  const [projectId, setProjectId] = useState(settings.projects[0]?.id ?? "");
  const [overrideMonths, setOverrideMonths] = useState<12 | 24 | 36>(12);
  const [saved, markSaved] = useSavedFlag();
  const hoursLeft = retentionCancelHours(settings.retentionRequestedAt);

  if (settings.retentionMonths !== sourceMonths) {
    setSourceMonths(settings.retentionMonths);
    setMonths(settings.retentionMonths);
  }

  function confirm() {
    const same = months === settings.retentionMonths && settings.retentionRequestedAt;
    updateWorkspace({
      retentionMonths: months,
      retentionRequestedAt: months === 0 ? null : same ? settings.retentionRequestedAt : new Date().toISOString(),
    });
    markSaved();
  }

  function cancel() {
    updateWorkspace({ retentionMonths: 0, retentionRequestedAt: null });
    markSaved();
  }

  function addOverride() {
    if (!projectId) return;
    updateWorkspace({
      retentionOverrides: [
        ...settings.retentionOverrides.filter((item) => item.projectId !== projectId),
        { projectId, months: overrideMonths },
      ],
    });
  }

  return (
    <SettingsShell title="Data retention" description="How long workspace activity is kept">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Organization period</CardTitle>
            <CardDescription>
              After you confirm a period, you can cancel it for 24 hours. Deletion of older activity runs once the retention job is on. The first pass can take longer than the daily pass.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {PERIODS.map((period) => (
              <Choice
                key={period.months}
                selected={months === period.months}
                title={period.title}
                description={period.description}
                onSelect={() => setMonths(period.months)}
              />
            ))}
            {settings.retentionMonths > 0 && hoursLeft !== null && hoursLeft > 0 && (
              <p className="text-xs text-muted-foreground">You can cancel this period for {hoursLeft} more hours.</p>
            )}
            {settings.retentionMonths > 0 && hoursLeft === 0 && (
              <p className="text-xs text-muted-foreground">This period is saved. Deletion runs once the retention job is on.</p>
            )}
            <div className="flex items-center gap-2 pt-1">
              <Button type="button" size="sm" onClick={confirm}>
                Confirm period
              </Button>
              {settings.retentionMonths > 0 && hoursLeft !== null && hoursLeft > 0 && (
                <Button type="button" size="sm" variant="outline" onClick={cancel}>
                  Cancel
                </Button>
              )}
              <Saved show={saved} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Project overrides</CardTitle>
            <CardDescription>A project can keep activity for a different period than the organization.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {settings.retentionOverrides.length > 0 && (
              <div className="divide-y divide-border rounded-md border border-border">
                {settings.retentionOverrides.map((override) => {
                  const project = settings.projects.find((item) => item.id === override.projectId);
                  return (
                    <div key={override.projectId} className="flex items-center justify-between px-3 py-2">
                      <span className="text-sm">
                        {project?.name ?? override.projectId}
                        <span className="text-muted-foreground"> · {override.months} months</span>
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          updateWorkspace({
                            retentionOverrides: settings.retentionOverrides.filter((item) => item.projectId !== override.projectId),
                          })
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <select className={fieldClass} value={projectId} onChange={(event) => setProjectId(event.target.value)} aria-label="Project">
                {settings.projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              <select
                className={fieldClass}
                value={overrideMonths}
                onChange={(event) => setOverrideMonths(Number(event.target.value) as 12 | 24 | 36)}
                aria-label="Override period"
              >
                <option value={12}>12 months</option>
                <option value={24}>24 months</option>
                <option value={36}>36 months</option>
              </select>
              <Button type="button" size="sm" variant="outline" onClick={addOverride}>
                Add override
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </SettingsShell>
  );
}
