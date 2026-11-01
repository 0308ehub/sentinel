import "server-only";

import { getChannelMessages, getSlackStatus, listBotChannels, slackConnectionKey } from "@/lib/slack/client";

const CACHE_MS = 60_000;
const MAX_CHANNELS = 6;
const MESSAGES_PER_CHANNEL = 30;
const MAX_CHARS = 24_000;

const cache = new Map<string, { at: number; text: string; channels: string[] }>();

export async function getSlackContext(): Promise<{ text: string; channels: string[] }> {
  const key = await slackConnectionKey();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return { text: cached.text, channels: cached.channels };
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
  cache.set(key, { at: Date.now(), text, channels: names });
  return { text, channels: names };
}
