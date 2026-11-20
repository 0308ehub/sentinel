"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsShell } from "@/components/settings/settings-shell";
import { Switch } from "@/components/ui/switch";
import { HIDEABLE_NAV, updateWorkspace, useWorkspaceSettings } from "@/lib/settings/workspace";

export function NavigationSettingsView() {
  const settings = useWorkspaceSettings();
  const hidden = new Set(settings.hiddenNav);
  const groups = [...new Set(HIDEABLE_NAV.map((item) => item.group))];

  function toggle(id: string, visible: boolean) {
    const next = new Set(settings.hiddenNav);
    if (visible) next.delete(id);
    else next.add(id);
    updateWorkspace({ hiddenNav: [...next] });
  }

  return (
    <SettingsShell title="Navigation" description="Show or hide product areas in the sidebar">
      <Card>
        <CardHeader>
          <CardTitle>Sidebar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {groups.map((group) => (
            <div key={group}>
              <p className="px-1 pb-1 text-[11px] font-medium text-muted-foreground">{group}</p>
              <div className="divide-y divide-border">
                {HIDEABLE_NAV.filter((item) => item.group === group).map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-4 py-3">
                    <p className="text-sm font-medium">{item.label}</p>
                    <Switch
                      checked={!hidden.has(item.id)}
                      onCheckedChange={(visible) => toggle(item.id, visible)}
                      aria-label={item.label}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </SettingsShell>
  );
}
