import { MarketingPageShell } from '../components/MarketingPageShell'

export const metadata = { title: 'Insights — Sentinel' }

export default function InsightsPage() {
  return (
    <MarketingPageShell
      pill={{ label: 'Features' }}
      title="Insights that explain themselves"
      description="Sentinel surfaces what's changing in your product, your market, and your customers — and shows you exactly why, with the evidence to back it up."
      cards={[
        { title: 'Theme trends', body: 'Track how each theme grows or fades over time. Spot a rising complaint at week two, not month three.' },
        { title: 'Segment analysis', body: 'Break down any insight by customer segment — plan tier, industry, team size, geography — to understand who is actually affected.' },
        { title: 'Competitive signals', body: 'Sentinel flags mentions of competitors in support tickets and sales calls and clusters them into competitive intelligence themes.' },
        { title: 'Churn risk', body: 'Correlate feedback themes with churn events. Understand which product gaps are driving cancellations before it shows in the numbers.' },
        { title: 'Velocity metrics', body: 'Measure how fast themes are growing, how many signals are being processed, and how quickly the team is acting on insights.' },
        { title: 'Exportable reports', body: 'Generate shareable insight reports for leadership, board decks, or quarterly business reviews in one click.' },
      ]}
    />
  )
}
