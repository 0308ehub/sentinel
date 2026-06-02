import { MarketingPageShell } from '../components/MarketingPageShell'

export const metadata = { title: 'Careers — Sentinel' }

export default function CareersPage() {
  return (
    <MarketingPageShell
      pill={{ label: 'Careers' }}
      title="Help us build the future of product"
      description="We're a small, high-trust team that ships fast and thinks carefully. If you want to work on a hard problem that matters, we'd love to talk."
      cards={[
        { title: 'Staff Engineer', body: 'Own the architecture behind Sentinel\'s signal processing pipeline. We process millions of events per day — performance and reliability are table stakes.' },
        { title: 'Product Designer', body: 'Craft the interface that product teams use every day. You\'ll own design end-to-end — research, prototyping, implementation, and iteration.' },
        { title: 'AI / ML Engineer', body: 'Build and improve the models that cluster signals, score impact, and draft issues. You\'ll work at the intersection of NLP, ranking, and product intuition.' },
        { title: 'Growth Engineer', body: 'Own acquisition and activation from the technical side. Build experiments, instrument funnels, and make every signup a success.' },
        { title: 'Account Executive', body: 'Close enterprise deals with product and engineering leaders. You know our ICP because you\'ve lived in their world.' },
        { title: 'Don\'t see your role?', body: 'We\'re always interested in exceptional people. Send us a note at careers@sentinel.ai and tell us what you\'d build.' },
      ]}
      ctaLabel="Send us a note"
      ctaHref="/contact"
    />
  )
}
