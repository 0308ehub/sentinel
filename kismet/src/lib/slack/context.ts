import "server-only";

import { getChannelMessages, getSlackStatus, listBotChannels } from "@/lib/slack/client";

const CACHE_MS = 60_000;
const MAX_CHANNELS = 6;
const MESSAGES_PER_CHANNEL = 30;
const MAX_CHARS = 24_000;

let cache: { at: number; text: string; channels: string[] } | null = null;

export async function getSlackContext(): Promise<{ text: string; channels: string[] }> {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return { text: cache.text, channels: cache.channels };
  }

  await getSlackStatus();
  const channels = await listBotChannels();
  const picked = channels.slice(0, MAX_CHANNELS);
  const blocks: string[] = [];

  for (const channel of picked) {
    try {
      const messages = await getChannelMessages(channel.id, MESSAGES_PER_CHANNEL);
      const lines = [...messages]
        .reverse()
        .map((message) => {
          const text = message.text.replace(/\s+/g, " ").trim().slice(0, 500);
          if (!text) return null;
          return `${message.userName}: ${text}`;
        })
        .filter((line): line is string => Boolean(line));

      if (lines.length > 0) {
        blocks.push(`#${channel.name}\n${lines.join("\n")}`);
      }
    } catch {
      // One channel the bot cannot read should not drop the rest.
    }
  }

  const text = blocks.join("\n\n").slice(0, MAX_CHARS);
  const names = picked.map((channel) => channel.name);
  cache = { at: Date.now(), text, channels: names };
  return { text, channels: names };
}
