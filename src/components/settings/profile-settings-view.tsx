"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SettingsShell } from "@/components/settings/settings-shell";
import { readOnboarding } from "@/lib/onboarding";
import { CURRENT_USER } from "@/lib/settings";
import { useAccount } from "@/lib/auth/use-account";
import { applyTheme, readTheme, type ThemeName } from "@/lib/theme";
import { useWorkspaceSettings } from "@/lib/settings/workspace";

export function ProfileSettingsView() {
  const account = useAccount();
  const workspace = useWorkspaceSettings();
  const [name, setName] = useState(CURRENT_USER.name);
  const [title, setTitle] = useState(CURRENT_USER.title);
  const [email, setEmail] = useState(CURRENT_USER.email);
  const [bio, setBio] = useState("");
  const [saved, setSaved] = useState(false);
  const [theme, setTheme] = useState<ThemeName>("light");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- The saved browser theme is unavailable during server rendering.
    setTheme(readTheme());
  }, []);

  useEffect(() => {
    if (account) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- The asynchronously resolved account initializes the editable profile form.
      setName(account.name || CURRENT_USER.name);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- The asynchronously resolved account initializes the editable profile form.
      setEmail(account.email || CURRENT_USER.email);
      return;
    }
    const draft = readOnboarding();
    if (!draft.name) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- The browser-only onboarding draft initializes the editable profile form.
    setName(draft.name);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- The browser-only onboarding draft initializes the editable profile form.
    setEmail(draft.email);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- The browser-only onboarding draft initializes the editable profile form.
    if (draft.role) setTitle(draft.role);
  }, [account]);

  function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function chooseTheme(next: ThemeName) {
    setTheme(next);
    applyTheme(next);
  }

  return (
    <SettingsShell title="Profile" description="Your name, role, and how Kismet looks">
      <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Your profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14">
                <AvatarFallback className="bg-accent text-sm text-accent-foreground">
                  {CURRENT_USER.initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <Button type="button" variant="outline" size="sm">
                  Upload photo
                </Button>
                <p className="mt-1 text-xs text-muted-foreground">PNG or JPG up to 2MB</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="title">Job title</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="org">Organization</Label>
                <Input id="org" value={workspace.orgName} readOnly className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="role">Role</Label>
                <Input id="role" value="Admin" readOnly className="h-9" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                className="resize-none text-sm"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button type="submit" size="sm">
                Save profile
              </Button>
              {saved && <span className="text-xs text-muted-foreground">Saved</span>}
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant={theme === "light" ? "default" : "outline"} onClick={() => chooseTheme("light")}>
            <Sun className="h-3.5 w-3.5" />
            Light
          </Button>
          <Button type="button" size="sm" variant={theme === "dark" ? "default" : "outline"} onClick={() => chooseTheme("dark")}>
            <Moon className="h-3.5 w-3.5" />
            Dark
          </Button>
          <Button type="button" size="sm" variant={theme === "system" ? "default" : "outline"} onClick={() => chooseTheme("system")}>
            <Monitor className="h-3.5 w-3.5" />
            System
          </Button>
        </CardContent>
      </Card>
      </div>
    </SettingsShell>
  );
}
