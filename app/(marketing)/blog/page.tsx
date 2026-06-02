import { MarketingPageShell } from '../components/MarketingPageShell'

export const metadata = { title: 'Blog — Sentinel' }

export default function BlogPage() {
  return (
    <MarketingPageShell
      pill={{ label: 'Blog' }}
      title="Thinking out loud about product"
      description="Essays, guides, and case studies on autonomous product management, signal processing, and how great teams build great software."
      cards={[
        { title: 'Why PMs drown in Slack', body: 'The average product manager spends 11 hours a week reading and triaging signals that never make it to the roadmap. Here\'s why — and how to fix it.' },
        { title: 'The case for AI-assisted triage', body: 'We analyzed 50,000 support tickets across 12 B2B SaaS companies. The patterns were striking — and almost none of them were reaching the product team.' },
        { title: 'How to build a signal-driven roadmap', body: 'A step-by-step guide to replacing gut-feel prioritization with a process grounded in customer evidence and business impact.' },
        { title: 'What "customer-obsessed" actually means', body: 'Companies that say they\'re customer-obsessed rarely have a system for turning customer feedback into product decisions. This is that system.' },
        { title: 'The PM\'s guide to AI agents', body: 'What AI agents can do well, what they still can\'t, and how to design a workflow that keeps humans in the right parts of the loop.' },
        { title: 'Sentinel\'s approach to data privacy', body: 'We built Sentinel to handle some of your most sensitive business data. Here\'s exactly how we think about security, privacy, and trust.' },
      ]}
      ctaLabel="Subscribe to updates"
      ctaHref="/contact"
    />
  )
}
