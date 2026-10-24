export interface GoogleStatus {
  configured: boolean;
  connected: boolean;
  email?: string;
  error?: string;
}

export interface GoogleMessage {
  id: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
}

export interface GoogleDoc {
  id: string;
  name: string;
  modified: string;
  link?: string;
  excerpt?: string;
}

export interface GooglePreview {
  email?: string;
  messages: GoogleMessage[];
  docs: GoogleDoc[];
}
