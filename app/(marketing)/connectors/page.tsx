import { MarketingPageShell } from '../components/MarketingPageShell'

export const metadata = { title: 'Connectors — Sentinel' }

export default function ConnectorsPage() {
  return (
    <MarketingPageShell
      pill={{ label: 'Features' }}
      title="Connect every source of truth"
      description="Sentinel integrates with the tools your team already uses. One-click setup, no engineering required, and new connectors ship every month."
      cards={[
        { title: 'Slack & Teams', body: 'Read support and sales channels. Sentinel processes threads in real time and never stores unnecessary message history.' },
        { title: 'Linear', body: 'Bi-directional sync keeps your backlog and Sentinel in perfect alignment. Issues created, updated, and closed stay in sync automatically.' },
        { title: 'Jira', body: 'Full Jira Cloud and Data Center support. Sentinel reads your project structure and places new issues in the right epic and sprint.' },
        { title: 'GitHub Issues', body: 'Turn customer signals into GitHub issues with the right labels, milestones, and assignees — no copy-paste required.' },
        { title: 'Zendesk & Intercom', body: 'Ingest support tickets automatically. Sentinel clusters them by theme and links high-frequency issues directly to your roadmap.' },
        { title: 'Gong & Chorus', body: 'Analyze sales call transcripts for recurring objections, feature requests, and competitive mentions at scale.' },
        { title: 'Salesforce & HubSpot', body: 'Pull deal notes and opportunity context. Understand which product gaps are costing you revenue.' },
        { title: 'Webhooks & API', body: 'Push any custom signal via webhook or the Sentinel REST API. Full documentation available for engineering teams.' },
        { title: 'More coming', body: 'Amplitude, Mixpanel, Segment, Notion, Confluence, Productboard, and more are on the connector roadmap.' },
      ]}
    />
  )
}
