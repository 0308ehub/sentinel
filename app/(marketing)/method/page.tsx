import { MarketingPageShell } from '../components/MarketingPageShell'

export const metadata = { title: 'Method — Sentinel' }

export default function MethodPage() {
  return (
    <MarketingPageShell
      pill={{ label: 'Method' }}
      title="The Sentinel method"
      description="Sentinel is built around a specific philosophy about how great product teams work. This is that philosophy — made concrete."
      cards={[
        { title: '1. Listen everywhere', body: 'Customer insight doesn\'t live in one place. It\'s scattered across support tickets, sales calls, Slack messages, and analytics events. You have to hear all of it.' },
        { title: '2. Synthesize, don\'t aggregate', body: 'Raw data is noise. Synthesis turns it into signal. The job isn\'t to show you more — it\'s to show you what matters, with the evidence to back it up.' },
        { title: '3. Act fast, review carefully', body: 'Speed matters in product. But so does accuracy. Sentinel moves fast on your behalf — and always puts a human in the loop before anything reaches your tracker.' },
        { title: '4. Close the loop', body: 'Insight without action is waste. Action without feedback is luck. Sentinel tracks every decision from signal to shipped feature and learns from the outcome.' },
        { title: '5. Earn trust incrementally', body: 'Autonomy is earned, not assumed. Sentinel starts as an assistant and grows into an agent as it proves its judgment matches yours.' },
        { title: '6. Explain everything', body: 'Every recommendation Sentinel makes is traceable back to the signals that created it. Black boxes don\'t belong in product management.' },
      ]}
      ctaLabel="See how it works"
      ctaHref="/sign-up"
      ctaSecondaryLabel="Read the blog"
      ctaSecondaryHref="/blog"
    />
  )
}
