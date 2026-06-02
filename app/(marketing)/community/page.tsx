import { MarketingPageShell } from '../components/MarketingPageShell'

export const metadata = { title: 'Community — Sentinel' }

export default function CommunityPage() {
  return (
    <MarketingPageShell
      pill={{ label: 'Community' }}
      title="Build with people who get it"
      description="The Sentinel community is where product managers, founders, and engineers share how they work, ask questions, and shape what Sentinel becomes."
      cards={[
        { title: 'Slack community', body: 'A private Slack workspace with 1,200+ product professionals. Share your setup, ask questions, and get answers from people doing the same work.' },
        { title: 'Monthly AMA', body: 'Every month, we open a live Q&A with the Sentinel founding team. No prepared questions — bring whatever is on your mind.' },
        { title: 'Feedback forum', body: 'Vote on features, submit ideas, and see exactly what\'s planned, in progress, and shipped. Your voice directly shapes our roadmap.' },
        { title: 'PM playbooks', body: 'Community-contributed guides on signal-driven roadmapping, autonomous triage setups, and stakeholder communication strategies.' },
        { title: 'Integration showcase', body: 'See how other teams have configured their connector stack, agent rules, and automation workflows. Fork what works for you.' },
        { title: 'Become an advisor', body: 'Power users can join our advisor program — early feature access, direct line to the product team, and recognition in our changelog.' },
      ]}
      ctaLabel="Join the community"
      ctaHref="/contact"
    />
  )
}
