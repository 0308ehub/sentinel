import { MarketingPageShell } from '../components/MarketingPageShell'

export const metadata = { title: 'Synthesize — Sentinel' }

export default function SynthesizePage() {
  return (
    <MarketingPageShell
      pill={{ label: 'Product' }}
      title="Turn noise into a clear picture"
      description="Sentinel clusters thousands of raw signals into structured themes, links them to existing issues, and surfaces the opportunities with the most business impact."
      cards={[
        { title: 'Automatic clustering', body: 'Signals are grouped by topic and intent — not just keyword. Similar feedback from different sources converges into a single, clear theme.' },
        { title: 'Impact scoring', body: 'Each theme is scored by frequency, revenue influence, and churn risk so you always know what to tackle first.' },
        { title: 'Issue deduplication', body: 'Sentinel checks your existing backlog before creating anything new. Duplicate noise never becomes duplicate issues.' },
        { title: 'Trend detection', body: 'Watch how themes grow or shrink over time. Catch a rising complaint before it becomes a churn wave.' },
        { title: 'Segment breakdown', body: 'See which customer segments drive each theme — enterprise vs. SMB, new vs. churned, by region or plan.' },
        { title: 'Evidence links', body: 'Every insight links back to the raw signals that created it. One click gets you to the original Slack thread or support ticket.' },
      ]}
    />
  )
}
