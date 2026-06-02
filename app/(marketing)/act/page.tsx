import { MarketingPageShell } from '../components/MarketingPageShell'

export const metadata = { title: 'Act — Sentinel' }

export default function ActPage() {
  return (
    <MarketingPageShell
      pill={{ label: 'Product' }}
      title="From insight to action in seconds"
      description="Sentinel drafts issues, assigns owners, and syncs everything to your project tracker — so your team ships the right things without a PM playing telephone."
      cards={[
        { title: 'One-click issue creation', body: 'Turn any insight into a fully-formed Linear, Jira, or GitHub issue with title, description, and priority pre-filled.' },
        { title: 'Owner assignment', body: 'Sentinel learns your team structure and routes new issues to the right squad based on domain and capacity.' },
        { title: 'Roadmap placement', body: 'New issues are slotted into the right initiative or milestone based on your current roadmap structure.' },
        { title: 'Bi-directional sync', body: 'Status updates in Linear or Jira flow back to Sentinel. Stakeholders always see the current state without leaving Slack.' },
        { title: 'Evidence bundles', body: 'Every created issue ships with a linked evidence bundle — the exact signals that motivated it, ready for sprint planning.' },
        { title: 'Rejection loop', body: "Declined issues feed back into Sentinel's model, improving future routing and reducing PM review time over time." },
      ]}
      ctaSecondaryLabel="See integrations"
      ctaSecondaryHref="/connectors"
    />
  )
}
