import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { redirect } from "next/navigation";
import { ConnectorCard } from "./connector-card";
import { ConnectModal } from "./connect-modal";
import { SlackChannelSetup } from "./slack-setup";
import { CheckCircle2, AlertCircle } from "lucide-react";

const CONNECTOR_CATALOG = [
  {
    type: "GMAIL",
    name: "Gmail",
    description: "Import customer emails, support threads, and sales conversations.",
    icon: "📧",
    authType: "oauth" as const,
    color: "bg-card border-border",
  },
  {
    type: "SLACK",
    name: "Slack",
    description: "Pull messages from customer-facing channels and internal feedback threads.",
    icon: "💬",
    authType: "oauth" as const,
    color: "bg-card border-border",
  },
  {
    type: "LINEAR",
    name: "Linear",
    description: "Import issues, bug reports, and feature requests from your Linear workspace.",
    icon: "🔷",
    authType: "apikey" as const,
    color: "bg-card border-border",
    fields: [{ key: "apiKey", label: "API Key", type: "password", placeholder: "lin_api_..." }],
  },
  {
    type: "JIRA",
    name: "Jira",
    description: "Import tickets, bugs, and feature requests from Jira projects.",
    icon: "🎯",
    authType: "apikey" as const,
    color: "bg-card border-border",
    fields: [
      { key: "domain", label: "Jira Domain", type: "text", placeholder: "yourcompany.atlassian.net" },
      { key: "email", label: "Email", type: "email", placeholder: "you@company.com" },
      { key: "apiToken", label: "API Token", type: "password", placeholder: "Your Jira API token" },
      { key: "projectKeys", label: "Project Keys (optional, comma-separated)", type: "text", placeholder: "ENG,PROD" },
    ],
  },
  {
    type: "INTERCOM",
    name: "Intercom",
    description: "Import customer support conversations and product feedback from Intercom.",
    icon: "💭",
    authType: "apikey" as const,
    color: "bg-card border-border",
    fields: [{ key: "accessToken", label: "Access Token", type: "password", placeholder: "dG9rOi..." }],
  },
  {
    type: "ZENDESK",
    name: "Zendesk",
    description: "Import support tickets and customer conversations from Zendesk.",
    icon: "🎫",
    authType: "apikey" as const,
    color: "bg-card border-border",
    fields: [
      { key: "subdomain", label: "Subdomain", type: "text", placeholder: "yourcompany (from yourcompany.zendesk.com)" },
      { key: "email", label: "Email", type: "email", placeholder: "you@company.com" },
      { key: "apiToken", label: "API Token", type: "password", placeholder: "Your Zendesk API token" },
    ],
  },
  {
    type: "HUBSPOT",
    name: "HubSpot",
    description: "Import CRM notes, call recordings, and sales feedback from HubSpot.",
    icon: "🧡",
    authType: "apikey" as const,
    color: "bg-card border-border",
    fields: [{ key: "accessToken", label: "Private App Token", type: "password", placeholder: "pat-na1-..." }],
  },
];

export default async function IntegrationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ connected?: string; error?: string; setup?: string }>;
}) {
  const { workspaceId } = await params;
  const { connected, error, setup } = await searchParams;

  try {
    await requireWorkspaceAccess(workspaceId);
  } catch {
    redirect("/sign-in");
  }

  const connectors = await prisma.connector.findMany({
    where: { workspaceId },
    include: { syncLogs: { orderBy: { startedAt: "desc" }, take: 1 } },
  });

  const connectedTypes = new Set(connectors.map((c) => c.type));

  return (
    <div>

      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Integrations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connect your tools to automatically import customer evidence into Sentinel.
          </p>
        </div>

        {/* Slack channel picker — shown right after Slack OAuth */}
        {setup && connected === "slack" && (
          <SlackChannelSetup connectorId={setup} workspaceId={workspaceId} />
        )}

        {/* Toast-style feedback banners */}
        {connected && !setup && (
          <div className="mb-6 flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-4 py-3 text-sm font-medium">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Successfully connected {connected.charAt(0).toUpperCase() + connected.slice(1)}! Click &quot;Review &amp; Import&quot; to import your first batch of data.
          </div>
        )}
        {error && (
          <div className="mb-6 flex items-center gap-2 bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 text-sm font-medium">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Failed to connect {error}. Please check your credentials and try again.
          </div>
        )}

        {/* Connected integrations */}
        {connectors.length > 0 && (
          <div className="mb-10">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Connected</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {connectors.map((connector) => {
                const meta = CONNECTOR_CATALOG.find((c) => c.type === connector.type);
                return (
                  <ConnectorCard
                    key={connector.id}
                    connector={connector as never}
                    meta={meta!}
                    workspaceId={workspaceId}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Available integrations */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            {connectors.length > 0 ? "Add More" : "Available Integrations"}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {CONNECTOR_CATALOG.filter((c) => !connectedTypes.has(c.type as never)).map((catalog) => (
              <ConnectModal
                key={catalog.type}
                catalog={catalog}
                workspaceId={workspaceId}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
