"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsShell } from "@/components/settings/settings-shell";
import {
  NOTIFICATION_PREFS,
  type NotificationPrefKey,
} from "@/lib/settings";

export function NotificationsSettingsView() {
  const [prefs, setPrefs] = useState<Record<NotificationPrefKey, boolean>>(
    Object.fromEntries(NOTIFICATION_PREFS.map((p) => [p.key, p.defaultEnabled])) as Record<
      NotificationPrefKey,
      boolean
    >
  );

  function toggle(key: NotificationPrefKey, enabled: boolean) {
    setPrefs((prev) => ({ ...prev, [key]: enabled }));
  }

  return (
    <SettingsShell
      title="Notifications"
      description="Choose which updates you want from Kismet"
    >
      <Card>
        <CardHeader>
          <CardTitle>Alert preferences</CardTitle>
          <CardDescription>Applies to in-app notifications; email is optional below</CardDescription>
        </CardHeader>
        <CardContent className="space-y-0 divide-y divide-border p-0">
          {NOTIFICATION_PREFS.map((pref) => (
            <div key={pref.key} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{pref.label}</p>
                <p className="text-xs text-muted-foreground">{pref.description}</p>
              </div>
              <Switch
                checked={prefs[pref.key]}
                onCheckedChange={(checked) => toggle(pref.key, checked)}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </SettingsShell>
  );
}
