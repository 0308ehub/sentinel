export interface JiraStatus {
  connected: boolean;
  site?: string;
  siteName?: string;
  account?: string;
  projects?: string[];
  error?: string;
}

export interface JiraIssue {
  key: string;
  summary: string;
  status: string;
  type: string;
  project: string;
  assignee: string;
  updated: string;
  url: string;
  description: string;
}

export interface JiraApiErrorBody {
  error: string;
  hint?: string;
}
