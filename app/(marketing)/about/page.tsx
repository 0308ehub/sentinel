import { MarketingPageShell } from '../components/MarketingPageShell'

export const metadata = { title: 'About — Sentinel' }

export default function AboutPage() {
  return (
    <MarketingPageShell
      pill={{ label: 'Company' }}
      title="Built for product teams who move fast"
      description="Sentinel was founded by engineers and PMs who spent years watching great insights get lost in Slack threads and spreadsheets. We built the tool we always needed."
      cards={[
        { title: 'Our mission', body: 'We believe every product team deserves a clear, real-time picture of what their customers need — without hiring a research army to get it.' },
        { title: 'Our approach', body: 'Sentinel is opinionated. We make choices so you don\'t have to: what to surface, what to ignore, and how to translate signals into shipped product.' },
        { title: 'Backed by the best', body: 'We\'re backed by investors who understand what it means to build great product. Our backers have scaled tools used by millions of developers.' },
        { title: 'Remote-first', body: 'Our team is distributed across North America and Europe. We operate async-first and document obsessively.' },
        { title: 'Open by default', body: 'We share our roadmap publicly, write about how we build, and listen closely to customers who push us toward better decisions.' },
        { title: 'Join us', body: 'We\'re a small team building something ambitious. If that sounds like your kind of problem, we\'d love to meet you.' },
      ]}
      ctaLabel="View open roles"
      ctaHref="/careers"
      ctaSecondaryLabel="Read our method"
      ctaSecondaryHref="/method"
    />
  )
}
