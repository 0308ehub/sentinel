const URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/gi;

export function findReadableUrl(parts: string[]): string | null {
  for (const part of parts) {
    const matches = part.match(URL_PATTERN) ?? [];
    for (const match of matches) {
      const candidate = match.replace(/[.,;:!?]+$/g, "");
      if (publicUrl(candidate)) return candidate;
    }
  }
  return null;
}

export async function readPublicPage(raw: string): Promise<{ url: string; title: string; text: string } | null> {
  const url = publicUrl(raw);
  if (!url) return null;
  if (url.pathname.toLowerCase().endsWith(".pdf")) return null;

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "text/html,text/plain;q=0.9" },
    });
    if (response.status >= 300 && response.status < 400) return null;
    if (!response.ok) return null;
    const type = response.headers.get("content-type") ?? "";
    if (type && !/text\/html|text\/plain|application\/xhtml/i.test(type)) return null;

    const html = await readLimited(response, 500_000);
    const text = htmlToText(html).slice(0, 8000);
    if (text.length < 40) return null;
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? htmlToText(titleMatch[1]).slice(0, 160) : url.hostname;
    return { url: url.toString(), title: title || url.hostname, text };
  } catch {
    return null;
  }
}

function publicUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  if (blockedHost(url.hostname)) return null;
  if (url.protocol === "http:") {
    url.protocol = "https:";
  }
  return url;
}

function blockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal"
  ) {
    return true;
  }

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4) {
    const parts = ipv4.slice(1).map(Number);
    if (parts.some((part) => part > 255)) return true;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }

  if (host.includes(":")) {
    const bare = host.split("%")[0];
    if (bare === "::1" || bare.startsWith("fe80:") || bare.startsWith("fc") || bare.startsWith("fd")) return true;
  }
  return false;
}

async function readLimited(response: Response, max: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  while (size < max) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    size += value.byteLength;
    text += decoder.decode(value, { stream: true });
    if (size >= max) break;
  }
  await reader.cancel().catch(() => undefined);
  return text;
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}
