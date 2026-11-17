import "server-only";

import { currentUserId } from "@/lib/connections/current";
import { getConnection, saveConnection } from "@/lib/connections/store";
import { framesInFile, layoutFromFigma, parseFigmaUrl, type FigmaNode, type Layout } from "@/lib/design/scene";

const MISSING = "Paste a Figma personal access token. Create one in Figma under Settings → Security.";

export class FigmaApiError extends Error {
  constructor(
    public hint: string,
    public status = 502,
  ) {
    super(hint);
  }
}

async function storedToken(): Promise<string> {
  const userId = await currentUserId();
  if (userId) {
    try {
      const stored = await getConnection<{ token?: unknown }>(userId, "figma");
      const value = typeof stored?.secret.token === "string" ? stored.secret.token.trim() : "";
      if (value) return value;
    } catch (error) {
      if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) throw error;
    }
  }
  return process.env.FIGMA_TOKEN?.trim() || "";
}

export async function figmaStatus(): Promise<{ connected: boolean; handle: string }> {
  const token = await storedToken();
  if (!token) return { connected: false, handle: "" };
  try {
    const me = await figmaFetch<{ handle?: string }>("/v1/me", token);
    return { connected: true, handle: me.handle?.trim() || "" };
  } catch {
    return { connected: false, handle: "" };
  }
}

export async function connectFigma(token: string): Promise<{ handle: string; saved: boolean }> {
  const me = await figmaFetch<{ handle?: string }>("/v1/me", token);
  const handle = me.handle?.trim() || "";
  const userId = await currentUserId();
  if (!userId) return { handle, saved: false };
  try {
    await saveConnection(userId, "figma", { token }, { handle });
    return { handle, saved: true };
  } catch {
    return { handle, saved: false };
  }
}

export async function importFigma(
  url: string,
  nodeId: string,
  candidate?: string,
): Promise<{ file: string; frames: { id: string; name: string }[] } | { file: string; frame: string; layout: Layout; url: string }> {
  const parsed = parseFigmaUrl(url);
  if (!parsed) throw new FigmaApiError("Paste a Figma file link.", 400);
  const token = candidate?.trim() || (await storedToken());
  if (!token) throw new FigmaApiError(MISSING, 503);
  const id = nodeId.trim() || parsed.nodeId;
  if (!id) {
    const file = await figmaFetch<{ name?: string; document?: FigmaNode }>(`/v1/files/${parsed.key}?depth=2`, token);
    const frames = framesInFile(file.document);
    if (frames.length === 0) {
      throw new FigmaApiError("That file has no frame on the first level. Copy a link to the frame itself.", 422);
    }
    if (frames.length > 1) return { file: file.name?.trim() || "Figma", frames };
    return pullFrame(parsed.key, frames[0].id, token, url, file.name?.trim() || "Figma");
  }
  return pullFrame(parsed.key, id, token, url, "");
}

async function pullFrame(key: string, id: string, token: string, url: string, fileName: string) {
  const payload = await figmaFetch<{ name?: string; nodes?: Record<string, { document?: FigmaNode } | null> }>(
    `/v1/files/${key}/nodes?ids=${encodeURIComponent(id)}&depth=4`,
    token,
  );
  const document = payload.nodes?.[id]?.document ?? Object.values(payload.nodes ?? {})[0]?.document;
  if (!document) throw new FigmaApiError("Figma did not return that frame.", 422);
  const layout = layoutFromFigma(document);
  if (!layout) throw new FigmaApiError("That frame has nothing Kismet can place on the canvas.", 422);
  return {
    file: payload.name?.trim() || fileName || "Figma",
    frame: document.name?.trim() || layout.name,
    layout,
    url,
  };
}

async function figmaFetch<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`https://api.figma.com${path}`, {
    headers: { "X-Figma-Token": token },
    cache: "no-store",
  });
  if (res.status === 401 || res.status === 403) {
    throw new FigmaApiError("Figma rejected the token. Create a new personal access token in Figma settings.", 401);
  }
  if (res.status === 404) throw new FigmaApiError("Figma could not find that file.", 404);
  if (res.status === 429) throw new FigmaApiError("Figma is limiting requests. Try again in a minute.", 429);
  if (!res.ok) throw new FigmaApiError("Figma did not return the file.", res.status);
  return (await res.json()) as T;
}
