"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SlackChannel } from "@/lib/slack/types";

interface NotifyPrefs {
  enabled: boolean;
  channelId: string;
  channelName: string;
  digest: boolean;
}

const DEFAULT_PREFS: NotifyPrefs = { enabled: false, channelId: "", channelName: "", digest: true };

async function request<T>(init?: RequestInit): Promise<T> {
  const response = await fetch("/api/autopilot/notify", { ...init, cache: "no-store" });
  const body = await response.json() as T & { error?: string; hint?: string };
  if (!response.ok) throw new Error(body.hint ?? body.error ?? "Could not save notification settings.");
  return body;
}

export function SlackNotifyCard({ channels }: { channels: SlackChannel[] }) {
  const [prefs, setPrefs] = useState<NotifyPrefs | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    request<NotifyPrefs>()
      .then((value) => active && setPrefs(value))
      .catch((error: Error) => active && setMessage({ kind: "error", text: error.message }));
    return () => {
      active = false;
    };
  }, []);

  async function save(next: NotifyPrefs) {
    setSaving(true);
    setMessage(null);
    try {
      const saved = await request<NotifyPrefs>({
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      setPrefs(saved);
      setMessage({ kind: "success", text: "Notification settings saved." });
    } catch (error) {
      setMessage({ kind: "error", text: (error as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function testMessage() {
    setTesting(true);
    setMessage(null);
    try {
      await request<{ ok: true }>({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test" }),
      });
      setMessage({ kind: "success", text: "Test message sent." });
    } catch (error) {
      setMessage({ kind: "error", text: (error as Error).message });
    } finally {
      setTesting(false);
    }
  }

  const value = prefs ?? DEFAULT_PREFS;
  const selected = channels.find((channel) => channel.id === value.channelId);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Experiment notifications</CardTitle>
        <CardDescription className="text-xs">
          Get one message when an experiment needs you or has an important result.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!prefs ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading notification settings…
          </div>
        ) : (
          <>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={value.enabled}
                disabled={saving}
                onChange={(event) => void save({ ...value, enabled: event.target.checked })}
              />
              Send experiment notifications
            </label>
            <label className="block text-xs text-muted-foreground">
              Channel
              <select
                className="mt-1 block h-9 w-full max-w-sm rounded-md border border-border bg-background px-2 text-sm text-foreground"
                value={value.channelId}
                disabled={saving}
                onChange={(event) => {
                  const channel = channels.find((item) => item.id === event.target.value);
                  void save({ ...value, channelId: channel?.id ?? "", channelName: channel?.name ?? "" });
                }}
              >
                <option value="">Choose a channel</option>
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.isPrivate ? "🔒 " : "#"}{channel.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={value.digest}
                disabled={saving}
                onChange={(event) => void save({ ...value, digest: event.target.checked })}
              />
              Weekly digest
            </label>
            <Button
              variant="outline"
              size="sm"
              disabled={!value.enabled || !selected || saving || testing}
              onClick={() => void testMessage()}
            >
              {testing && <Loader2 className="h-3 w-3 animate-spin" />}
              Send test message
            </Button>
          </>
        )}
        {message && (
          <p className={message.kind === "error" ? "text-xs text-destructive" : "text-xs text-emerald-700"}>
            {message.text}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
