"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsShell } from "@/components/settings/settings-shell";

export function SecuritySettingsView() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [twoFactor, setTwoFactor] = useState(false);
  const [sessionAlerts, setSessionAlerts] = useState(true);

  function handlePassword(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <SettingsShell title="Security" description="Password, two-factor auth, and active sessions">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Change password</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePassword} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="current">Current password</Label>
                <Input
                  id="current"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="h-9"
                  autoComplete="current-password"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new">New password</Label>
                <Input
                  id="new"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-9"
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirm new password</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-9"
                  autoComplete="new-password"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex items-center gap-2 pt-1">
                <Button type="submit" size="sm">
                  Update password
                </Button>
                {saved && <span className="text-xs text-muted-foreground">Password updated</span>}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Two-factor authentication</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Authenticator app</p>
              </div>
              <Switch checked={twoFactor} onCheckedChange={setTwoFactor} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">New login alerts</p>
              </div>
              <Switch checked={sessionAlerts} onCheckedChange={setSessionAlerts} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active sessions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0 divide-y divide-border p-0">
            {[
              { device: "MacBook Pro · Chrome", location: "San Francisco, CA", current: true },
              { device: "iPhone 16 · Safari", location: "San Francisco, CA", current: false },
            ].map((session) => (
              <div key={session.device} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{session.device}</span>
                    {session.current && <Badge variant="success">This device</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{session.location}</p>
                </div>
                {!session.current && (
                  <Button variant="outline" size="sm" type="button">
                    Revoke
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </SettingsShell>
  );
}
