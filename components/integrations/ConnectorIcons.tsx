export function GmailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M44 8H4C1.8 8 0 9.8 0 12v24c0 2.2 1.8 4 4 4h40c2.2 0 4-1.8 4-4V12c0-2.2-1.8-4-4-4z" fill="#fff"/>
      <path d="M44 8H4C1.8 8 0 9.8 0 12v1.5l24 15 24-15V12c0-2.2-1.8-4-4-4z" fill="#EA4335"/>
      <path d="M0 13.5V36c0 2.2 1.8 4 4 4h40c2.2 0 4-1.8 4-4V13.5L24 28.5 0 13.5z" fill="#FBBC05"/>
      <path d="M0 13.5L24 28.5l24-15V36c0 2.2-1.8 4-4 4H4c-2.2 0-4-1.8-4-4V13.5z" fill="#34A853"/>
      <path d="M24 28.5L0 13.5V36c0 2.2 1.8 4 4 4h20V28.5z" fill="#C5221F"/>
      <path d="M24 28.5L48 13.5V36c0 2.2-1.8 4-4 4H24V28.5z" fill="#FBBC05"/>
    </svg>
  );
}

export function SlackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path d="M13.4 24.9c0 2.1-1.7 3.8-3.8 3.8S5.8 27 5.8 24.9s1.7-3.8 3.8-3.8h3.8v3.8z" fill="#E01E5A"/>
      <path d="M15.3 24.9c0-2.1 1.7-3.8 3.8-3.8s3.8 1.7 3.8 3.8v9.5c0 2.1-1.7 3.8-3.8 3.8s-3.8-1.7-3.8-3.8v-9.5z" fill="#E01E5A"/>
      <path d="M19.1 13.4c-2.1 0-3.8-1.7-3.8-3.8S17 5.8 19.1 5.8s3.8 1.7 3.8 3.8v3.8h-3.8z" fill="#36C5F0"/>
      <path d="M19.1 15.3c2.1 0 3.8 1.7 3.8 3.8s-1.7 3.8-3.8 3.8H9.6c-2.1 0-3.8-1.7-3.8-3.8s1.7-3.8 3.8-3.8h9.5z" fill="#36C5F0"/>
      <path d="M30.6 19.1c0-2.1 1.7-3.8 3.8-3.8s3.8 1.7 3.8 3.8-1.7 3.8-3.8 3.8h-3.8v-3.8z" fill="#2EB67D"/>
      <path d="M28.7 19.1c0 2.1-1.7 3.8-3.8 3.8s-3.8-1.7-3.8-3.8V9.6c0-2.1 1.7-3.8 3.8-3.8s3.8 1.7 3.8 3.8v9.5z" fill="#2EB67D"/>
      <path d="M24.9 30.6c2.1 0 3.8 1.7 3.8 3.8s-1.7 3.8-3.8 3.8-3.8-1.7-3.8-3.8v-3.8h3.8z" fill="#ECB22E"/>
      <path d="M24.9 28.7c-2.1 0-3.8-1.7-3.8-3.8s1.7-3.8 3.8-3.8h9.5c2.1 0 3.8 1.7 3.8 3.8s-1.7 3.8-3.8 3.8h-9.5z" fill="#ECB22E"/>
    </svg>
  );
}

export function LinearIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="linearGrad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5E6AD2"/>
          <stop offset="1" stopColor="#3D4FA8"/>
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="22" fill="url(#linearGrad)"/>
      <path d="M17.5 61.2L38.8 82.5C27.6 79.2 20.8 72.4 17.5 61.2z" fill="white"/>
      <path d="M15 52.3L47.7 85C43.3 84.4 39.2 83 35.4 80.8L19.2 64.6C17 60.8 15.6 56.7 15 52.3z" fill="white"/>
      <path d="M16.7 42.6L57.4 83.3C54.4 82.8 51.5 81.9 48.8 80.6L19.4 51.2C18.1 48.5 17.2 45.6 16.7 42.6z" fill="white"/>
      <path d="M20.6 33.8L66.2 79.4C63.7 78.4 61.3 77.1 59.1 75.5L24.5 40.9C22.9 38.7 21.6 36.3 20.6 33.8z" fill="white"/>
      <path d="M26.8 26.8C35 18.6 46.4 15 57.5 17.1L82.9 42.5C85 53.6 81.4 65 73.2 73.2L26.8 26.8z" fill="white"/>
    </svg>
  );
}

export function JiraIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="jiraGrad1" x1="24" y1="14.3" x2="14.5" y2="23.8" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0052CC"/>
          <stop offset="1" stopColor="#2684FF"/>
        </linearGradient>
        <linearGradient id="jiraGrad2" x1="24.5" y1="33.7" x2="34" y2="24.2" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0052CC"/>
          <stop offset="1" stopColor="#2684FF"/>
        </linearGradient>
      </defs>
      <path d="M24.2 4.5L4.5 24.2l8.5 8.5 11.2-11.2 11.2 11.2 8.5-8.5L24.2 4.5z" fill="#2684FF"/>
      <path d="M24.2 20.5L13 31.7l11.2 11.8 11.2-11.8L24.2 20.5z" fill="url(#jiraGrad2)"/>
      <path d="M24.2 4.5L4.5 24.2l8.5 8.5L24.2 21.5l11.2 11.2 8.5-8.5L24.2 4.5z" fill="url(#jiraGrad1)"/>
    </svg>
  );
}

export function ZendeskIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22 14c0-4.4-3.6-8-8-8S6 9.6 6 14v20h16V14z" fill="#03363D"/>
      <path d="M6 34l16-20H6v20z" fill="#78A300"/>
      <path d="M26 34c0 4.4 3.6 8 8 8s8-3.6 8-8V14H26v20z" fill="#03363D"/>
      <path d="M42 14L26 34h16V14z" fill="#78A300"/>
    </svg>
  );
}

export function HubSpotIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="33" cy="14" r="6" fill="#FF7A59"/>
      <path d="M28 14c0-2.8 2.2-5 5-5V4c-5.5 0-10 4.5-10 10v6h5v-6z" fill="#FF7A59"/>
      <path d="M10 18v12h6V18h-6z" fill="#33475B"/>
      <path d="M13 8c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4z" fill="#33475B"/>
      <path d="M22 24c0 6.1 4.9 11 11 11s11-4.9 11-11-4.9-11-11-11-11 4.9-11 11z" fill="#FF7A59" fillOpacity=".15"/>
      <path d="M29 24c0-2.2 1.8-4 4-4s4 1.8 4 4-1.8 4-4 4-4-1.8-4-4z" fill="#FF7A59"/>
      <path d="M4 30l8 8v-6H4v-2z" fill="#33475B"/>
      <path d="M16 30H4v6h8l8-8v2l-4 4v4h4v-8l4-4h-8z" fill="#33475B"/>
    </svg>
  );
}

export function IntercomIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="10" fill="#1F8DED"/>
      <path d="M24 8c-9.9 0-16 6.1-16 16 0 5.3 2.3 10.1 6 13.3V42l5.4-3.6c1.5.4 3 .6 4.6.6 9.9 0 16-6.1 16-16S33.9 8 24 8zm-9 18a2 2 0 110-4 2 2 0 010 4zm9 0a2 2 0 110-4 2 2 0 010 4zm9 0a2 2 0 110-4 2 2 0 010 4z" fill="white"/>
    </svg>
  );
}

export function ConnectorIcon({ type, className }: { type: string; className?: string }) {
  switch (type) {
    case "GMAIL": return <GmailIcon className={className} />;
    case "SLACK": return <SlackIcon className={className} />;
    case "LINEAR": return <LinearIcon className={className} />;
    case "JIRA": return <JiraIcon className={className} />;
    case "ZENDESK": return <ZendeskIcon className={className} />;
    case "HUBSPOT": return <HubSpotIcon className={className} />;
    case "INTERCOM": return <IntercomIcon className={className} />;
    default: return <span className={className}>🔌</span>;
  }
}
