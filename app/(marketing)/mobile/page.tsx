import { MarketingPageShell } from '../components/MarketingPageShell'

export const metadata = { title: 'Mobile — Sentinel' }

export default function MobilePage() {
  return (
    <MarketingPageShell
      pill={{ label: 'Features' }}
      title="Sentinel in your pocket"
      description="Review insights, approve actions, and stay on top of your product from anywhere. The Sentinel mobile app brings the full workflow to iOS and Android."
      cards={[
        { title: 'Insight feed', body: 'A real-time feed of everything Sentinel has surfaced — themed, prioritized, and ready for a quick review on the go.' },
        { title: 'Action approvals', body: 'Approve or reject agent-created issues with a single tap. Nothing ships to your tracker without your sign-off.' },
        { title: 'Digest notifications', body: 'Get your weekly digest as a push notification. Tap to read the full summary, complete with evidence links.' },
        { title: 'Search', body: 'Full-text search across all signals, themes, and issues. Find anything in seconds, from any device.' },
        { title: 'Offline support', body: 'Your last sync is available offline. Review insights and queue approvals — they submit automatically when you reconnect.' },
        { title: 'Coming soon', body: 'Mobile is in closed beta. Join the waitlist to get early access when we roll out to the first cohort.' },
      ]}
      ctaLabel="Join the waitlist"
      ctaHref="/contact"
    />
  )
}
