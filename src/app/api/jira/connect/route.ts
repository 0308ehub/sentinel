import { currentUserId } from "@/lib/connections/current";
import { connectErrorMessage } from "@/lib/connections/errors";
import { saveConnection } from "@/lib/connections/store";
import { getJiraStatus, normalizeJiraConfig, type JiraSecret } from "@/lib/jira/client";

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const secret: JiraSecret = {
      baseUrl: text(body.baseUrl),
      email: text(body.email),
      apiToken: text(body.apiToken),
      projectKey: text(body.projectKey) || undefined,
    };
    if (!secret.baseUrl || !secret.email || !secret.apiToken) {
      throw new Error("Site URL, email, and API token are required.");
    }

    // Check the credential works before saving it.
    const config = normalizeJiraConfig(secret);
    const status = await getJiraStatus(config);
    if (!status.connected) throw new Error(status.error);

    await saveConnection(
      userId,
      "jira",
      { baseUrl: config.base, email: config.email, apiToken: config.token, projectKey: config.projectKey },
      { site: status.site }
    );
    return Response.json(status);
  } catch (error) {
    return Response.json({ error: connectErrorMessage(error, "Could not connect Jira.") }, { status: 400 });
  }
}
