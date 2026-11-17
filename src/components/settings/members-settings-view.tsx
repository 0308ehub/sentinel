"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsShell } from "@/components/settings/settings-shell";
import { fieldClass } from "@/components/settings/settings-form";
import { useAccount } from "@/lib/auth/use-account";
import { CURRENT_USER } from "@/lib/settings";
import { updateWorkspace, useWorkspaceSettings, type MemberRole } from "@/lib/settings/workspace";

const ROLES: MemberRole[] = ["Admin", "Manager", "Member"];

export function MembersSettingsView() {
  const settings = useWorkspaceSettings();
  const account = useAccount();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("Member");
  const [group, setGroup] = useState("");
  const [error, setError] = useState("");
  const name = account?.name || CURRENT_USER.name;
  const you = (account?.email || CURRENT_USER.email).toLowerCase();

  function invite(event: FormEvent) {
    event.preventDefault();
    const next = email.trim().toLowerCase();
    setError("");
    if (!next.includes("@") || !next.split("@")[1]?.includes(".")) {
      setError("Enter a work email.");
      return;
    }
    if (you && next === you) {
      setError("That person is already in the workspace.");
      return;
    }
    if (settings.invites.some((item) => item.email === next)) {
      setError("That invite is already pending.");
      return;
    }
    updateWorkspace({
      invites: [{ email: next, role, at: new Date().toISOString() }, ...settings.invites],
    });
    setEmail("");
  }

  function addGroup(event: FormEvent) {
    event.preventDefault();
    const next = group.trim();
    if (!next) return;
    if (settings.groups.some((item) => item.toLowerCase() === next.toLowerCase())) {
      setGroup("");
      return;
    }
    updateWorkspace({ groups: [...settings.groups, next] });
    setGroup("");
  }

  return (
    <SettingsShell wide title="Members" description="People, invites, and groups">
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <Count label="People" value={1 + settings.invites.length} />
          <Count label="Joined" value={1} />
          <Count label="Pending" value={settings.invites.length} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>People</CardTitle>
            <CardDescription>Admins and managers invite people. Members can join a group once they are in the organization.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Person</th>
                  <th className="px-4 py-2 font-medium">Role</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="px-4 py-3">
                    <p className="font-medium">{name}</p>
                    {you && <p className="text-xs text-muted-foreground">{you}</p>}
                  </td>
                  <td className="px-4 py-3">Admin</td>
                  <td className="px-4 py-3">
                    <Badge variant="success">Joined</Badge>
                  </td>
                  <td />
                </tr>
                {settings.invites.map((inviteRow) => (
                  <tr key={inviteRow.email} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">{inviteRow.email}</td>
                    <td className="px-4 py-3">{inviteRow.role}</td>
                    <td className="px-4 py-3">
                      <Badge variant="muted">Pending</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateWorkspace({
                            invites: settings.invites.filter((item) => item.email !== inviteRow.email),
                          })
                        }
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invite</CardTitle>
            <CardDescription>Pending invites stay in this browser until the organization directory sends them.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={invite} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label htmlFor="invite-email">Email</Label>
                <Input id="invite-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-role">Role</Label>
                <select id="invite-role" value={role} onChange={(event) => setRole(event.target.value as MemberRole)} className={fieldClass}>
                  {ROLES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" size="sm" className="sm:mb-0">
                Invite
              </Button>
            </form>
            {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Groups</CardTitle>
            <CardDescription>A group is a named set of people you can grant project access to together.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {settings.groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">No groups yet.</p>
            ) : (
              <div className="divide-y divide-border rounded-md border border-border">
                {settings.groups.map((item) => (
                  <div key={item} className="flex items-center justify-between px-3 py-2">
                    <span className="text-sm">{item}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => updateWorkspace({ groups: settings.groups.filter((groupName) => groupName !== item) })}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <form onSubmit={addGroup} className="flex gap-2">
              <Input value={group} onChange={(event) => setGroup(event.target.value)} placeholder="Group name" className="h-9" />
              <Button type="submit" size="sm" variant="outline">
                Add group
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </SettingsShell>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
