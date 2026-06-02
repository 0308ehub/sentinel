import { MarketingPageShell } from '../components/MarketingPageShell'

export const metadata = { title: 'Status — Sentinel' }

export default function StatusPage() {
  return (
    <MarketingPageShell
      pill={{ label: 'Resources' }}
      title="All systems operational"
      description="Real-time status for the Sentinel platform. Subscribe to incident notifications and view historical uptime across all services."
      cards={[
        { title: '✓ Signal processing', body: 'All signal ingestion pipelines are operating normally. Last checked 2 minutes ago.' },
        { title: '✓ AI agents', body: 'Synthesis, triage, and digest agents are running at full capacity. No degradation detected.' },
        { title: '✓ Connector sync', body: 'All active connectors — Slack, Linear, Jira, Zendesk — are syncing on schedule.' },
        { title: '✓ API', body: 'REST API is responding within SLA. p99 latency: 187ms. Uptime this month: 99.97%.' },
        { title: '✓ Web app', body: 'Dashboard and web application are fully available across all regions.' },
        { title: 'Incident history', body: 'View the full incident history and postmortems. We publish detailed RCAs for any incident lasting more than 15 minutes.' },
      ]}
      ctaLabel="Subscribe to updates"
      ctaHref="/contact"
    />
  )
}
