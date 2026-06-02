import { MarketingPageShell } from '../components/MarketingPageShell'

export const metadata = { title: 'Agents — Sentinel' }

export default function AgentsPage() {
  return (
    <MarketingPageShell
      pill={{ label: 'Features' }}
      title="AI agents that work like a senior PM"
      description="Sentinel agents don't just surface information — they reason about it, make decisions, and take actions. Grounded in your data, auditable at every step."
      cards={[
        { title: 'Signal agent', body: 'Continuously monitors all connected sources, extracts structured signals, and routes them to the right themes without human intervention.' },
        { title: 'Triage agent', body: 'Reviews incoming issues, scores them by impact, and recommends priority placement based on current team capacity and roadmap goals.' },
        { title: 'Synthesis agent', body: 'Clusters raw signals into themes, detects trends over time, and proactively surfaces anomalies that warrant a PM\'s attention.' },
        { title: 'Digest agent', body: 'Composes weekly stakeholder digests, sprint review summaries, and executive briefings — tailored to each audience automatically.' },
        { title: 'Roadmap agent', body: 'Reviews your roadmap weekly against fresh signals and suggests additions, removals, and reprioritizations with supporting evidence.' },
        { title: 'Human-in-the-loop', body: 'Every agent action is reviewable and reversible. Approve, edit, or reject any recommendation before it reaches your tracker.' },
      ]}
    />
  )
}
