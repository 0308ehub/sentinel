import { MarketingPageShell } from '../components/MarketingPageShell'

export const metadata = { title: 'Intake — Sentinel' }

export default function IntakePage() {
  return (
    <MarketingPageShell
      pill={{ label: 'Product' }}
      title="Hear every signal, miss nothing"
      description="Sentinel connects to Slack, email, support tools, and sales calls to capture every customer signal the moment it happens — no manual logging required."
      cards={[
        { title: 'Slack & Teams', body: 'Connect your support and sales channels. Sentinel reads every thread and extracts actionable signals automatically.' },
        { title: 'Support tools', body: 'Pull from Zendesk, Intercom, and Freshdesk. Sentinel triages tickets and surfaces patterns before they become escalations.' },
        { title: 'Sales calls', body: 'Ingest call transcripts from Gong and Chorus. Understand what features close deals and what gaps lose them.' },
        { title: 'Product analytics', body: 'Connect Amplitude, Mixpanel, or Segment. Pair behavioral data with qualitative feedback for complete context.' },
        { title: 'CRM signals', body: 'Read Salesforce and HubSpot notes. Sentinel links deal context to product gaps without anyone touching a spreadsheet.' },
        { title: 'Custom sources', body: 'Webhook and API integrations let you push any signal — internal tools, data warehouses, or bespoke systems.' },
      ]}
      ctaSecondaryLabel="See all connectors"
      ctaSecondaryHref="/connectors"
    />
  )
}
