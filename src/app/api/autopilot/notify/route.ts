import { getNotifyPrefs, saveNotifyPrefs } from "@/lib/autopilot/notify";
import { withAutopilotUser } from "@/lib/autopilot/scope";
import { currentUserId } from "@/lib/connections/current";
import { CHANNEL_ID_PATTERN, postSlackMessage, SlackApiError } from "@/lib/slack/client";

export const dynamic = "force-dynamic";

async function signedInUser(): Promise<string | Response> {
  const userId = await currentUserId();
  return userId ?? Response.json({ error: "Sign in required." }, { status: 401 });
}

export async function GET() {
  const user = await signedInUser();
  if (user instanceof Response) return user;
  return Response.json(await withAutopilotUser(user, getNotifyPrefs));
}

export async function PUT(request: Request) {
  const user = await signedInUser();
  if (user instanceof Response) return user;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (
    typeof body?.enabled !== "boolean" ||
    typeof body?.channelId !== "string" ||
    typeof body?.channelName !== "string" ||
    typeof body?.digest !== "boolean" ||
    (body.channelId !== "" && !CHANNEL_ID_PATTERN.test(body.channelId)) ||
    body.channelName.length > 120
  ) {
    return Response.json({ error: "Invalid notification settings." }, { status: 400 });
  }
  if (body.enabled && !body.channelId) {
    return Response.json({ error: "Choose a Slack channel." }, { status: 400 });
  }
  const prefs = await withAutopilotUser(user, () => saveNotifyPrefs({
    enabled: body.enabled as boolean,
    channelId: body.channelId as string,
    channelName: (body.channelName as string).trim(),
    digest: body.digest as boolean,
  }));
  return Response.json(prefs);
}

export async function POST(request: Request) {
  const user = await signedInUser();
  if (user instanceof Response) return user;
  const body = await request.json().catch(() => null) as { action?: unknown } | null;
  if (body?.action !== "test") return Response.json({ error: "Invalid action." }, { status: 400 });
  const prefs = await withAutopilotUser(user, getNotifyPrefs);
  if (!prefs.enabled || !prefs.channelId) {
    return Response.json({ error: "Enable notifications and choose a channel first." }, { status: 400 });
  }
  try {
    await withAutopilotUser(user, () => postSlackMessage(prefs.channelId, "Kismet notifications are connected here."));
    return Response.json({ ok: true });
  } catch (error) {
    const slack = error instanceof SlackApiError ? error : null;
    return Response.json(
      { error: slack?.code ?? "slack_error", hint: slack?.hint ?? "Kismet could not post to Slack." },
      { status: slack?.status ?? 502 },
    );
  }
}
