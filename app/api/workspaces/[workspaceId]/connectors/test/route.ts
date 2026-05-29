import { requireWorkspaceAccess, unauthorizedResponse } from "@/lib/auth/helpers";
import { apiSuccess, apiError } from "@/types";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;
  try {
    await requireWorkspaceAccess(workspaceId);
  } catch {
    return unauthorizedResponse();
  }

  const { type, config } = (await req.json()) as { type: string; config: Record<string, string> };

  try {
    let info = "Connected";

    switch (type) {
      case "LINEAR": {
        const { testLinearConnection } = await import("@/server/services/connectors/linear");
        info = `Connected as ${await testLinearConnection(config.apiKey)}`;
        break;
      }
      case "JIRA": {
        const { testJiraConnection } = await import("@/server/services/connectors/jira");
        info = `Connected as ${await testJiraConnection(config as never)}`;
        break;
      }
      case "INTERCOM": {
        const { testIntercomConnection } = await import("@/server/services/connectors/intercom");
        info = `Connected to ${await testIntercomConnection(config.accessToken)}`;
        break;
      }
      case "ZENDESK": {
        const { testZendeskConnection } = await import("@/server/services/connectors/zendesk");
        info = `Connected as ${await testZendeskConnection(config as never)}`;
        break;
      }
      case "HUBSPOT": {
        const { testHubSpotConnection } = await import("@/server/services/connectors/hubspot");
        await testHubSpotConnection(config.accessToken);
        info = "Connected to HubSpot";
        break;
      }
      default:
        return Response.json(
          apiError("UNSUPPORTED", `Cannot test connector type: ${type}`),
          { status: 400 }
        );
    }

    return Response.json(apiSuccess({ info }));
  } catch (err) {
    return Response.json(
      apiError("TEST_FAILED", err instanceof Error ? err.message : "Connection test failed"),
      { status: 400 }
    );
  }
}
