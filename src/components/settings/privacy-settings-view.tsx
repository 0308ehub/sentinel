"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsShell } from "@/components/settings/settings-shell";
import { updateWorkspace, useWorkspaceSettings } from "@/lib/settings/workspace";
import { Switch } from "@/components/ui/switch";

export function PrivacySettingsView() {
  const settings = useWorkspaceSettings();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  function addRecipient(event: FormEvent) {
    event.preventDefault();
    const next = email.trim().toLowerCase();
    setError("");
    if (!next.includes("@") || !next.split("@")[1]?.includes(".")) {
      setError("Enter an email.");
      return;
    }
    if (settings.privacy.some((person) => person.email === next)) {
      setError("That person is already on the list.");
      return;
    }
    updateWorkspace({
      privacy: [...settings.privacy, { email: next, created: true, completed: true }],
    });
    setEmail("");
  }

  return (
    <SettingsShell title="Privacy" description="Who is emailed when someone asks for their data to be deleted">
      <Card>
        <CardHeader>
          <CardTitle>Deletion mail</CardTitle>
          <CardDescription>
            Keep at least one recipient. Mail goes out once privacy jobs are connected. A request can notify people when it is received and when the deletion finishes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {settings.privacy.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add at least one person so a deletion request has somewhere to go.</p>
          ) : (
            <div className="divide-y divide-border rounded-md border border-border">
              {settings.privacy.map((person) => (
                <div key={person.email} className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-medium">{person.email}</p>
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Switch
                        checked={person.created}
                        aria-label={`Request received for ${person.email}`}
                        onCheckedChange={(created) =>
                          updateWorkspace({
                            privacy: settings.privacy.map((item) => (item.email === person.email ? { ...item, created } : item)),
                          })
                        }
                      />
                      Request received
                    </label>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Switch
                        checked={person.completed}
                        aria-label={`Deletion finished for ${person.email}`}
                        onCheckedChange={(completed) =>
                          updateWorkspace({
                            privacy: settings.privacy.map((item) => (item.email === person.email ? { ...item, completed } : item)),
                          })
                        }
                      />
                      Deletion finished
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        updateWorkspace({ privacy: settings.privacy.filter((item) => item.email !== person.email) })
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={addRecipient} className="flex gap-2">
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="ada@company.com"
              className="h-9"
              aria-label="Recipient email"
            />
            <Button type="submit" size="sm">
              Add
            </Button>
          </form>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </SettingsShell>
  );
}
