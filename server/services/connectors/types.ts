export interface ImportedDocument {
  title: string;
  text: string;
  externalId: string;
  sourceType: string;
  metadata?: Record<string, string>;
}

export interface GmailConfig {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  email: string;
  labelFilter?: string;
  historyId?: string;
}

export interface SlackConfig {
  botToken: string;
  teamId: string;
  teamName: string;
  channelIds: string[];
  oldestTs?: string;
}

export interface LinearConfig {
  apiKey: string;
  teamIds?: string[];
  lastSyncedAt?: string;
}

export interface JiraConfig {
  apiToken: string;
  email: string;
  domain: string;
  projectKeys?: string[];
  lastSyncedAt?: string;
}

export interface IntercomConfig {
  accessToken: string;
  lastSyncedAt?: string;
}

export interface ZendeskConfig {
  subdomain: string;
  email: string;
  apiToken: string;
  lastSyncedAt?: string;
}

export interface HubSpotConfig {
  accessToken: string;
  lastSyncedAt?: string;
}
