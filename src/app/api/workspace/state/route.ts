import { isPersonalStateKey, STATE_KEYS, type StateKey } from "@/lib/workspace/keys";
import { autopilotConfigured } from "@/lib/autopilot/db";
import { currentAccountId, currentUserId } from "@/lib/connections/current";
import { isStateKey, loadStates, saveState } from "@/lib/workspace/state-store";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 3_500_000;

function errorResponse(error: string, status: number): Response {
  return Response.json({ error }, { status });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

async function identity(): Promise<string | Response> {
  const userId = await currentAccountId();
  if (!userId) return errorResponse("sign_in_required", 401);
  if (!autopilotConfigured()) return errorResponse("not_configured", 503);
  return userId;
}

/** Chats and personal setup stay with the person; everything else belongs to the (possibly shared) account. */
async function ownerFor(key: StateKey, accountId: string): Promise<string> {
  return isPersonalStateKey(key) ? (await currentUserId()) ?? accountId : accountId;
}

export async function GET(): Promise<Response> {
  const userId = await identity();
  if (userId instanceof Response) return userId;
  try {
    const person = (await currentUserId()) ?? userId;
    const [shared, personal] = await Promise.all([
      loadStates(userId),
      person === userId ? Promise.resolve({}) : loadStates(person),
    ]);
    const states = Object.fromEntries(
      STATE_KEYS.flatMap((key) => {
        const source = isPersonalStateKey(key) && person !== userId ? personal : shared;
        const value = (source as Record<string, unknown>)[key];
        return value === undefined ? [] : [[key, value]];
      }),
    );
    return Response.json({ userId, states });
  } catch (error) {
    console.error("[workspace]", error);
    return errorResponse("unknown_error", 500);
  }
}

export async function PUT(request: Request): Promise<Response> {
  const userId = await identity();
  if (userId instanceof Response) return userId;
  const text = await request.text();
  if (Buffer.byteLength(text) > MAX_BODY_BYTES) return errorResponse("too_large", 413);
  try {
    const body = JSON.parse(text) as Record<string, unknown>;
    if (!isPlainObject(body) || !isStateKey(body.key) || !isPlainObject(body.data)) {
      return errorResponse("bad_request", 400);
    }
    if (!Number.isInteger(body.baseVersion) || (body.baseVersion as number) < 0) {
      return errorResponse("bad_request", 400);
    }
    const result = await saveState(await ownerFor(body.key, userId), body.key, body.data, body.baseVersion as number);
    return result.ok
      ? Response.json({ version: result.version })
      : Response.json({ data: result.data, version: result.version }, { status: 409 });
  } catch (error) {
    if (error instanceof SyntaxError) return errorResponse("bad_request", 400);
    console.error("[workspace]", error);
    return errorResponse("unknown_error", 500);
  }
}
