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
  const [clearing, setClearing] = useState(false);
  const [clearConfirmation, setClearConfirmation] = useState("");
  const [clearBusy, setClearBusy] = useState(false);
  const [clearError, setClearError] = useState("");
  const [clearSuccess, setClearSuccess] = useState("");

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

  async function clearPersonalData() {
    setClearBusy(true);
    setClearError("");
    setClearSuccess("");
    try {
      const response = await fetch("/api/workspace/personal", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: clearConfirmation }),
      });
      const body = await response.json() as {
        error?: string;
        counts?: Record<string, number>;
      };
      if (!response.ok) {
        setClearError(body.error ?? "Could not clear personal data.");
        return;
      }
      const total = Object.values(body.counts ?? {}).reduce((sum, count) => sum + count, 0);
      setClearSuccess(`${total} ${total === 1 ? "row" : "rows"} removed from your personal space.`);
      setClearing(false);
      setClearConfirmation("");
    } catch {
      setClearError("Could not clear personal data.");
    } finally {
      setClearBusy(false);
    }
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
      {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && (
        <Card>
          <CardHeader>
            <CardTitle>Personal Kismet data</CardTitle>
            <CardDescription>
              Deletes the experiments, connections (Slack, GitHub…), settings and workspace data in your personal space. Shared organization workspaces are not touched. Your chats stay.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {clearing ? (
              <div className="space-y-3 rounded-md border border-destructive/30 p-3">
                <p className="text-sm">Type <span className="font-medium">clear</span> to confirm.</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={clearConfirmation}
                    onChange={(event) => setClearConfirmation(event.target.value)}
                    placeholder="clear"
                    aria-label="Type clear to confirm"
                    className="h-8 sm:max-w-xs"
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={clearBusy || clearConfirmation !== "clear"}
                      onClick={() => void clearPersonalData()}
                    >
                      {clearBusy ? "Clearing…" : "Clear personal data"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={clearBusy}
                      onClick={() => {
                        setClearing(false);
                        setClearConfirmation("");
                        setClearError("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  setClearing(true);
                  setClearError("");
                  setClearSuccess("");
                }}
              >
                Clear personal data
              </Button>
            )}
            {clearError && <p className="text-sm text-destructive">{clearError}</p>}
            {clearSuccess && <p className="text-sm text-muted-foreground">{clearSuccess}</p>}
          </CardContent>
        </Card>
      )}
    </SettingsShell>
  );
}
