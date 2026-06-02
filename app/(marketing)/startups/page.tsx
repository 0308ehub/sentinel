import { MarketingPageShell } from '../components/MarketingPageShell'

export const metadata = { title: 'Startups — Sentinel' }

export default function StartupsPage() {
  return (
    <MarketingPageShell
      pill={{ label: 'Startups' }}
      title="The unfair advantage for early-stage teams"
      description="Sentinel gives seed and Series A teams the signal-processing infrastructure that enterprise companies build large research teams to replicate — at a price that fits the stage."
      cards={[
        { title: '90% off for 12 months', body: 'Qualifying startups get the Sentinel Business plan at 10% of list price for the first year. No strings attached.' },
        { title: 'Who qualifies', body: 'Seed to Series A, under $5M ARR, fewer than 50 employees, and not previously a Sentinel customer. Apply in under 5 minutes.' },
        { title: 'Onboarding partner', body: 'Every startup gets a dedicated onboarding partner for the first 30 days — not a support ticket, a person who answers your questions.' },
        { title: 'Community access', body: 'Join a private Slack community of early-stage founders and PMs using Sentinel. Share what\'s working, get feedback on your setup.' },
        { title: 'Investor perks', body: 'We partner with leading seed and Series A funds. Check with your investor — they may have additional credits for portfolio companies.' },
        { title: 'Graduate pricing', body: 'When you grow past the startup threshold, you\'ll graduate to standard pricing on a schedule that matches your growth, not ours.' },
      ]}
      ctaLabel="Apply now"
      ctaHref="/contact"
      ctaSecondaryLabel="See pricing"
      ctaSecondaryHref="/pricing"
    />
  )
}
