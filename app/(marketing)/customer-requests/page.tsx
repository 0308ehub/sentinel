import { MarketingPageShell } from '../components/MarketingPageShell'

export const metadata = { title: 'Customer Requests — Sentinel' }

export default function CustomerRequestsPage() {
  return (
    <MarketingPageShell
      pill={{ label: 'Features' }}
      title="Every request, tracked and linked"
      description="Sentinel captures customer requests from every channel, deduplicates them, and links them to roadmap items — so you always know who asked for what and whether it shipped."
      cards={[
        { title: 'Auto-capture', body: 'Requests from Slack, support tickets, sales calls, and CRM notes are captured and structured automatically — no manual logging.' },
        { title: 'Deduplication', body: 'Similar requests from different customers merge into a single tracked item. No more counting the same ask twice.' },
        { title: 'Customer linking', body: 'Each request is linked to the company and contact it came from. See which of your most valuable customers want the same thing.' },
        { title: 'Revenue weighting', body: 'Requests are weighted by ARR, plan tier, and churn risk — so the highest-impact work rises to the top automatically.' },
        { title: 'Shipment notifications', body: 'When a requested feature ships, Sentinel can notify the customers who asked for it — closing the loop without manual effort.' },
        { title: 'Reporting', body: 'Share a live request dashboard with your sales and CS teams so everyone knows what\'s in progress and what\'s planned.' },
      ]}
    />
  )
}
