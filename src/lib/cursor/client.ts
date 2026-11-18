import "server-only";

// Cursor's Cloud Agents API (v1, public beta): https://cursor.com/docs/cloud-agent/api/endpoints

const API = "https://api.cursor.com";

export class CursorApiError extends Error {
  constructor(
    public code: string,
    public hint: string,
    public status = 502,
  ) {
    super(code);
  }
}

async function cursor<T>(key: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    cache: "no-store",
  });
  if (res.status === 401) {
    throw new CursorApiError("unauthorized", "Cursor rejected the API key. Create a new one in the Cursor dashboard.", 401);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
    throw new CursorApiError(
      body.error?.code || "cursor_error",
      body.error?.message || "The Cursor request failed.",
      res.status,
    );
  }
  return (await res.json()) as T;
}

/** Throws unless Cursor accepts the key. */
export async function checkCursorKey(key: string): Promise<void> {
  await cursor(key, "/v1/agents?limit=1");
}

export interface CursorAgentStart {
  agentId: string;
  runId: string;
  url: string | null;
}

/** Starts a cloud agent that works on `branch` and pushes to it. Kismet opens the pull request itself. */
export async function createCursorAgent(
  key: string,
  input: { repo: string; branch: string; prompt: string; name: string },
): Promise<CursorAgentStart> {
  const created = await cursor<{ agent?: { id?: string; url?: string }; run?: { id?: string } }>(key, "/v1/agents", {
    method: "POST",
    body: JSON.stringify({
      prompt: { text: input.prompt },
      name: input.name.slice(0, 100),
      repos: [{ url: `https://github.com/${input.repo}`, startingRef: input.branch }],
      workOnCurrentBranch: true,
      autoCreatePR: false,
    }),
  });
  if (!created.agent?.id || !created.run?.id) {
    throw new CursorApiError("cursor_error", "Cursor did not return the agent it started.", 502);
  }
  return { agentId: created.agent.id, runId: created.run.id, url: created.agent.url ?? null };
}

export async function cursorRunStatus(key: string, agentId: string, runId: string): Promise<string | undefined> {
  const run = await cursor<{ status?: string }>(
    key,
    `/v1/agents/${encodeURIComponent(agentId)}/runs/${encodeURIComponent(runId)}`,
  );
  return run.status;
}

/** Stops a run. A run that already ended cannot be cancelled, which is fine. */
export async function cancelCursorRun(key: string, agentId: string, runId: string): Promise<void> {
  try {
    await cursor(key, `/v1/agents/${encodeURIComponent(agentId)}/runs/${encodeURIComponent(runId)}/cancel`, {
      method: "POST",
    });
  } catch (error) {
    if (!(error instanceof CursorApiError) || error.status !== 409) throw error;
  }
}
