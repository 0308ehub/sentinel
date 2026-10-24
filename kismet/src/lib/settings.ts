export type ConnectorStatus = "connected" | "available" | "error";

export interface ConnectedApp {
  id: string;
  name: string;
  description: string;
  category: string;
  logo: string;
  status: ConnectorStatus;
  connectedAt?: string;
  accountLabel?: string;
}

export interface OrgProject {
  id: string;
  name: string;
  description: string;
  status: "active" | "archived";
  members: number;
}

export const CURRENT_USER = {
  id: "person-you",
  name: "You",
  email: "",
  role: "Product",
  initials: "Y",
  title: "Product",
};

export const ORG = {
  name: "Your company",
  id: "org_workspace",
  url: "workspace",
  plan: "Trial",
  planRenewsAt: "2026-10-15",
  seats: 1,
  seatsUsed: 1,
};

export const ORG_PROJECTS: OrgProject[] = [
  {
    id: "product-workspace",
    name: "Workspace",
    description: "The product graph for this workspace",
    status: "active",
    members: 1,
  },
];

export const CONNECTED_APPS: ConnectedApp[] = [
  {
    id: "slack",
    name: "Slack",
    description: "Post updates, alerts, and decision reminders to channels",
    category: "Communication",
    logo: "/connectors/slack.png",
    status: "connected",
  },
  {
    id: "google-workspace",
    name: "Google Workspace",
    description: "Sync Drive docs, Calendar, and Gmail context into the graph",
    category: "Productivity",
    logo: "/connectors/google-workspace.svg",
    status: "available",
  },
  {
    id: "atlassian",
    name: "Atlassian",
    description: "Jira issues and Confluence pages linked to features",
    category: "Project management",
    logo: "/connectors/atlassian.svg",
    status: "available",
  },
  {
    id: "github",
    name: "GitHub",
    description: "Pull requests, commits, and repo activity on the timeline",
    category: "Engineering",
    logo: "/connectors/github.svg",
    status: "available",
  },
  {
    id: "linear",
    name: "Linear",
    description: "Issues and cycles mapped to product graph nodes",
    category: "Project management",
    logo: "/connectors/linear.svg",
    status: "available",
  },
  {
    id: "notion",
    name: "Notion",
    description: "Import specs, PRDs, and research into the knowledge graph",
    category: "Docs",
    logo: "/connectors/notion.svg",
    status: "available",
  },
  {
    id: "granola",
    name: "Granola",
    description: "Meeting notes and action items attached to decisions",
    category: "Meetings",
    logo: "/connectors/granola.png",
    status: "available",
  },
  {
    id: "databricks",
    name: "Databricks",
    description: "SQL warehouse for product events and company tables",
    category: "Warehouse",
    logo: "/connectors/databricks.svg",
    status: "available",
  },
  {
    id: "pendo",
    name: "Pendo",
    description: "Product analytics and in-app guides as evidence",
    category: "Analytics",
    logo: "/connectors/pendo.png",
    status: "available",
  },
  {
    id: "sentry",
    name: "Sentry",
    description: "Errors and performance issues linked to features",
    category: "Engineering",
    logo: "/connectors/sentry.svg",
    status: "available",
  },
];

export type NotificationPrefKey =
  | "featureUpdates"
  | "decisionRequests"
  | "riskAlerts"
  | "launchReminders"
  | "connectorSync"
  | "weeklyDigest"
  | "mentions"
  | "emailDigest";

export interface NotificationPref {
  key: NotificationPrefKey;
  label: string;
  description: string;
  defaultEnabled: boolean;
}

export const NOTIFICATION_PREFS: NotificationPref[] = [
  {
    key: "featureUpdates",
    label: "Feature updates",
    description: "Status changes on features you own or follow",
    defaultEnabled: true,
  },
  {
    key: "decisionRequests",
    label: "Decision requests",
    description: "When you’re asked to review or approve a decision",
    defaultEnabled: true,
  },
  {
    key: "riskAlerts",
    label: "Risk alerts",
    description: "Health drops, blocked work, and critical issues",
    defaultEnabled: true,
  },
  {
    key: "launchReminders",
    label: "Launch reminders",
    description: "Upcoming launch dates and checklist gaps",
    defaultEnabled: true,
  },
  {
    key: "connectorSync",
    label: "Connector sync",
    description: "Failures and reconnect prompts for linked apps",
    defaultEnabled: true,
  },
  {
    key: "mentions",
    label: "Mentions",
    description: "When someone @mentions you in notes or decisions",
    defaultEnabled: true,
  },
  {
    key: "weeklyDigest",
    label: "Weekly digest",
    description: "Monday summary of product health and activity",
    defaultEnabled: false,
  },
  {
    key: "emailDigest",
    label: "Email notifications",
    description: "Also send matching alerts to your work email",
    defaultEnabled: false,
  },
];
