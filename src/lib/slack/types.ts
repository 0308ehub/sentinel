export interface SlackStatus {
  connected: boolean;
  team?: string;
  teamUrl?: string;
  botName?: string;
  error?: string;
}

export interface SlackChannel {
  id: string;
  name: string;
  isPrivate: boolean;
  topic?: string;
  memberCount?: number;
}

export interface SlackMessage {
  ts: string;
  threadTs?: string;
  userId?: string;
  userName: string;
  userAvatar?: string;
  text: string;
  postedAt: string;
  replyCount: number;
  latestReplyAt?: string;
  permalink?: string;
}

export interface SlackApiErrorBody {
  error: string;
  hint?: string;
}

export interface SlackInboxItem {
  id: string;
  action: "feature" | "assign";
  title: string;
  description: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  assigneeName: string;
  issueKey: string;
  jiraKey: string;
  jiraUrl: string;
  sprint: string;
  channelName: string;
  permalink: string;
  askedBy: string;
  note: string;
  at: string;
}
