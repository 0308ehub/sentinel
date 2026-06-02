import { MarketingPageShell } from '../components/MarketingPageShell'

export const metadata = { title: 'Automate — Sentinel' }

export default function AutomatePage() {
  return (
    <MarketingPageShell
      pill={{ label: 'Product' }}
      title="Let Sentinel run the recurring work"
      description="Weekly digests, stakeholder updates, sprint reviews, and roadmap grooming — Sentinel handles the PM busywork so your team stays in flow."
      cards={[
        { title: 'Weekly digests', body: 'Every Monday, Sentinel sends each stakeholder a personalized summary of what shipped, what surfaced, and what needs a decision.' },
        { title: 'Sprint reviews', body: 'Auto-generated sprint review docs pull data from your tracker, link to evidence, and format for async consumption.' },
        { title: 'Roadmap grooming', body: 'Sentinel scans your backlog weekly and flags stale items, newly relevant issues, and priority shifts based on fresh signals.' },
        { title: 'Escalation alerts', body: 'When a theme crosses a configurable threshold — frequency, revenue impact, churn risk — Sentinel pings the right person immediately.' },
        { title: 'Custom workflows', body: 'Build automation rules with simple if-then logic. No code required — define triggers, conditions, and actions in plain language.' },
        { title: 'Audit trail', body: 'Every automated action is logged with the reasoning behind it. Nothing ships without a traceable justification.' },
      ]}
    />
  )
}
