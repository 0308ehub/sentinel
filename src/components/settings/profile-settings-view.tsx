"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SettingsShell } from "@/components/settings/settings-shell";
import { readOnboarding } from "@/lib/onboarding";
import { CURRENT_USER } from "@/lib/settings";

export function ProfileSettingsView() {
  const [name, setName] = useState(CURRENT_USER.name);
  const [title, setTitle] = useState(CURRENT_USER.title);
  const [email, setEmail] = useState(CURRENT_USER.email);
  const [bio, setBio] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const draft = readOnboarding();
    if (!draft.name) return;
    setName(draft.name);
    setEmail(draft.email);
    if (draft.role) setTitle(draft.role);
  }, []);

  function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <SettingsShell title="Profile" description="Your personal details shown across Kismet">
      <Card>
        <CardHeader>
          <CardTitle>Your profile</CardTitle>
          <CardDescription>This is how teammates see you in the graph and activity feed</CardDescription>
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
    </SettingsShell>
  );
}
