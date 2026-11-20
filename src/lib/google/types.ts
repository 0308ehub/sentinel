export interface GoogleStatus {
  configured: boolean;
  connected: boolean;
  email?: string;
  hostedDomain?: string;
  gmail?: boolean;
  docs?: boolean;
  calendar?: boolean;
  redirectUri?: string;
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

export interface GoogleEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
  snippet?: string;
  link?: string;
  organizer?: string;
}

export interface GooglePreview {
  email?: string;
  hostedDomain?: string;
  messages: GoogleMessage[];
  docs: GoogleDoc[];
  events: GoogleEvent[];
  errors?: { mail?: string; docs?: string; calendar?: string };
}
