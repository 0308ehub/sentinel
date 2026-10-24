"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  MessageSquare,
  Network,
  RefreshCw,
  Check,
} from "lucide-react";
import { SettingsShell } from "@/components/settings/settings-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CURRENT_USER } from "@/lib/settings";
import { slackThreadNodeId, useGraphStore } from "@/lib/graph/graph-store";
import { useUIStore } from "@/stores/ui-store";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { SlackApiErrorBody, SlackChannel, SlackMessage, SlackStatus } from "@/lib/slack/types";

const CHANNEL_STORAGE_KEY = "kismet-slack-channel";
const REFRESH_INTERVAL_MS = 60_000;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const body = await res.json();
  if (!res.ok) {
    const err = body as SlackApiErrorBody;
    throw new Error(err.hint ?? err.error ?? `Request failed (${res.status})`);
  }
  return body as T;
}

export function SlackChannelView() {
  const [status, setStatus] = useState<SlackStatus | null>(null);
  const [channels, setChannels] = useState<SlackChannel[] | null>(null);
  const [channelId, setChannelId] = useState<string>("");
  const [messages, setMessages] = useState<SlackMessage[] | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await getJson<SlackStatus>("/api/slack/status").catch(
        (e: Error): SlackStatus => ({ connected: false, error: e.message })
      );
      if (cancelled) return;
      setStatus(s);
      if (!s.connected) return;

      try {
        const { channels } = await getJson<{ channels: SlackChannel[] }>("/api/slack/channels");
        if (cancelled) return;
        setChannels(channels);
        const saved = localStorage.getItem(CHANNEL_STORAGE_KEY);
        const initial = channels.find((c) => c.id === saved) ?? channels[0];
        if (initial) setChannelId(initial.id);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function refresh() {
    setLoadingMessages(true);
    setRefreshKey((k) => k + 1);
  }

  useEffect(() => {
    if (!channelId) return;
    localStorage.setItem(CHANNEL_STORAGE_KEY, channelId);
    let current = true;

    const sync = async () => {
      try {
        const { messages } = await getJson<{ messages: SlackMessage[] }>(
          `/api/slack/messages?channel=${encodeURIComponent(channelId)}&limit=50`
        );
        if (!current) return;
        setMessages(messages);
        setLastSyncedAt(new Date());
        setError(null);
      } catch (e) {
        if (current) setError((e as Error).message);
      } finally {
        if (current) setLoadingMessages(false);
      }
    };

    sync();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") sync();
    }, REFRESH_INTERVAL_MS);
    return () => {
      current = false;
      clearInterval(interval);
    };
  }, [channelId, refreshKey]);

  const channel = channels?.find((c) => c.id === channelId);

  return (
    <SettingsShell title="Slack" description="Read channels, and let people mention Kismet to add features or assign work">
      <Link
        href="/settings/connectors"
        className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        Connected apps
      </Link>

      {!status ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking Slack connection…
        </div>
      ) : !status.connected ? (
        <SetupCard error={status.error} />
      ) : (
        <div className="space-y-4">
          <Card>
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <Badge variant="success">Connected</Badge>
              <span className="text-sm">
                <span className="font-medium">{status.team}</span>
                <span className="text-muted-foreground"> as @{status.botName}</span>
              </span>
              <p className="w-full text-sm text-muted-foreground">
                In a channel the bot has joined, mention @{status.botName}. It can add a feature or assign a Jira
                issue, for example “@{status.botName} add a feature for saved filters and assign it to Maya” or “@{status.botName} assign Maya to SCRUM-5”.
              </p>
              <div className="ml-auto flex items-center gap-2">
                <select
                  className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                  value={channelId}
                  onChange={(e) => {
                    setMessages(null);
                    setChannelId(e.target.value);
                  }}
                  disabled={!channels?.length}
                >
                  {!channels?.length && <option value="">No channels</option>}
                  {channels?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.isPrivate ? "🔒 " : "#"}
                      {c.name}
                    </option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refresh}
                  disabled={!channelId || loadingMessages}
                >
                  <RefreshCw className={cn("h-3 w-3", loadingMessages && "animate-spin")} />
                  Refresh
                </Button>
              </div>
            </CardContent>
          </Card>

          {channels && channels.length === 0 && (
            <Card>
              <CardContent className="p-4 text-sm text-muted-foreground">
                The bot isn&apos;t in any channels yet. In Slack, open the channel you want and type{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                  /invite @{status.botName}
                </code>
                , then reload this page.
              </CardContent>
            </Card>
          )}

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          {channel && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  {channel.isPrivate ? "" : "#"}
                  {channel.name}
                </CardTitle>
                <CardDescription className="text-xs">
                  {channel.topic ? `${channel.topic} · ` : ""}
                  {lastSyncedAt
                    ? `Synced ${formatRelativeTime(lastSyncedAt)} · refreshes every minute`
                    : "Loading…"}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {!messages ? (
                  <div className="flex items-center gap-2 px-4 py-8 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading messages…
                  </div>
                ) : messages.length === 0 ? (
                  <p className="px-4 py-8 text-sm text-muted-foreground">No messages in this channel yet.</p>
                ) : (
                  <div className="divide-y divide-border">
                    {messages.map((m) => (
                      <MessageRow key={m.ts} message={m} channel={channel} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </SettingsShell>
  );
}

function SetupCard({ error }: { error?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Slack isn&apos;t connected</CardTitle>
        {error && <CardDescription className="text-destructive">{error}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ol className="list-decimal space-y-1.5 pl-4 text-sm text-muted-foreground">
          <li>
            Create an app at{" "}
            <a
              href="https://api.slack.com/apps"
              target="_blank"
              rel="noreferrer"
              className="text-foreground underline underline-offset-2"
            >
              api.slack.com/apps
            </a>
            .
          </li>
          <li>
            Under OAuth &amp; Permissions, add bot scopes <code className="font-mono text-xs">channels:read</code>,{" "}
            <code className="font-mono text-xs">channels:history</code>,{" "}
            <code className="font-mono text-xs">users:read</code>,{" "}
            <code className="font-mono text-xs">chat:write</code> (plus{" "}
            <code className="font-mono text-xs">groups:read</code> and{" "}
            <code className="font-mono text-xs">groups:history</code> for private channels).
          </li>
          <li>Install the app to your workspace and copy the Bot User OAuth Token (xoxb-…).</li>
          <li>
            Add <code className="font-mono text-xs">SLACK_BOT_TOKEN=xoxb-…</code> to <code className="font-mono text-xs">.env</code>{" "}
            and restart the dev server.
          </li>
          <li>
            In Slack, type <code className="font-mono text-xs">/invite @YourAppName</code> in the channel you want Kismet to read.
          </li>
        </ol>
      </CardContent>
    </Card>
  );
}

function MessageRow({ message, channel }: { message: SlackMessage; channel: SlackChannel }) {
  const [threadOpen, setThreadOpen] = useState(false);
  const [replies, setReplies] = useState<SlackMessage[] | null>(null);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [featureId, setFeatureId] = useState("");

  const nodeId = slackThreadNodeId(channel.id, message.ts);
  const inGraph = useGraphStore((s) => s.nodes.some((n) => n.id === nodeId));
  const allNodes = useGraphStore((s) => s.nodes);
  const features = useMemo(() => allNodes.filter((n) => n.type === "FEATURE"), [allNodes]);
  const importSlackThread = useGraphStore((s) => s.importSlackThread);
  const activeProductId = useUIStore((s) => s.activeProductId);

  async function toggleThread() {
    const next = !threadOpen;
    setThreadOpen(next);
    if (!next || replies) return;
    try {
      const { messages } = await getJson<{ messages: SlackMessage[] }>(
        `/api/slack/thread?channel=${encodeURIComponent(channel.id)}&ts=${encodeURIComponent(message.ts)}`
      );
      setReplies(messages.filter((r) => r.ts !== message.ts));
    } catch (e) {
      setThreadError((e as Error).message);
    }
  }

  function addToGraph() {
    const threadText = replies?.length
      ? [message.text, ...replies.map((r) => `${r.userName}: ${r.text}`)].join("\n\n")
      : message.text;
    importSlackThread({
      channelId: channel.id,
      channelName: channel.name,
      ts: message.ts,
      text: threadText,
      authorName: message.userName,
      postedAt: message.postedAt,
      replyCount: message.replyCount,
      permalink: message.permalink,
      linkedFeatureId: featureId || undefined,
      actorId: CURRENT_USER.id,
      productId: activeProductId,
    });
    setLinking(false);
  }

  return (
    <div className="px-4 py-3">
      <div className="flex gap-3">
        <Avatar name={message.userName} src={message.userAvatar} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-sm font-medium">{message.userName}</span>
            <span className="text-[11px] text-muted-foreground">{formatRelativeTime(message.postedAt)}</span>
            {inGraph && (
              <Badge variant="default" className="text-[10px]">
                <Check className="mr-0.5 h-3 w-3" />
                In graph
              </Badge>
            )}
          </div>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-foreground">{message.text}</p>

          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px]">
            {message.replyCount > 0 && (
              <button
                type="button"
                onClick={toggleThread}
                className="inline-flex items-center gap-1 font-medium text-foreground/80 hover:text-foreground"
              >
                <MessageSquare className="h-3 w-3" />
                {threadOpen ? "Hide" : `${message.replyCount} ${message.replyCount === 1 ? "reply" : "replies"}`}
              </button>
            )}
            <button
              type="button"
              onClick={() => setLinking((v) => !v)}
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
            >
              <Network className="h-3 w-3" />
              {inGraph ? "Update in graph" : "Add to graph"}
            </button>
            {message.permalink && (
              <a
                href={message.permalink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-3 w-3" />
                Open in Slack
              </a>
            )}
          </div>

          {linking && (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 p-2">
              <span className="text-[11px] text-muted-foreground">Link to feature</span>
              <select
                className="h-7 rounded-md border border-border bg-background px-2 text-xs"
                value={featureId}
                onChange={(e) => setFeatureId(e.target.value)}
              >
                <option value="">None</option>
                {features.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.title}
                  </option>
                ))}
              </select>
              <Button size="sm" onClick={addToGraph}>
                Save
              </Button>
              {message.replyCount > 0 && !replies && (
                <span className="text-[10px] text-muted-foreground">
                  Open the replies first to include them.
                </span>
              )}
            </div>
          )}

          {threadOpen && (
            <div className="mt-2 space-y-2 border-l-2 border-border pl-3">
              {threadError ? (
                <p className="text-xs text-destructive">{threadError}</p>
              ) : !replies ? (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading replies…
                </p>
              ) : (
                replies.map((r) => (
                  <div key={r.ts} className="flex gap-2">
                    <Avatar name={r.userName} src={r.userAvatar} small />
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-medium">{r.userName}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatRelativeTime(r.postedAt)}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap break-words text-xs">{r.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Avatar({ name, src, small }: { name: string; src?: string; small?: boolean }) {
  const size = small ? "h-5 w-5 text-[9px]" : "h-8 w-8 text-xs";
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className={cn("shrink-0 rounded-md", size)} />;
  }
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md bg-accent font-medium text-accent-foreground",
        size
      )}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
