import { MarketingNav } from './components/MarketingNav'
import { Hero } from './components/Hero'
import { LogoCloud } from './components/LogoCloud'
import { Tagline } from './components/Tagline'
import { FigCards } from './components/FigCards'
import { FeatureSection } from './components/FeatureSection'
import { ListenMockup } from './components/ListenMockup'
import { SynthesizeMockup } from './components/SynthesizeMockup'
import { ActMockup } from './components/ActMockup'
import { AutomateMockup } from './components/AutomateMockup'
import { CTASection } from './components/CTASection'
import { Footer } from './components/Footer'

export default function LandingPage() {
  return (
    <>
      <MarketingNav />
      <main>
        <Hero />
        <LogoCloud />
        <Tagline />
        <FigCards />
        <FeatureSection
          number="1.0"
          label="Listen →"
          headline="Make product operations self-driving"
          subheadline="Turn conversations and customer feedback into actionable issues that are routed, labeled, and prioritized for the right team."
          mockup={<ListenMockup />}
        />
        <FeatureSection
          number="2.0"
          label="Synthesize →"
          headline="Define the product direction"
          subheadline="Plan and navigate from signal to strategy. Align your team with product initiatives, roadmaps, and clear, up-to-date PRDs."
          mockup={<SynthesizeMockup />}
        />
        <FeatureSection
          number="3.0"
          label="Act →"
          headline="Turn insights into shipped product"
          subheadline="Build and deploy AI agents that work alongside your team. Work on complex tasks together or delegate entire issues end-to-end."
          mockup={<ActMockup />}
        />
        <FeatureSection
          number="4.0"
          label="Automate →"
          headline="Your PM that never stops working"
          subheadline="Sentinel runs 24/7, scanning every connector, synthesizing signals, and taking action — so your team ships instead of manages."
          mockup={<AutomateMockup />}
        />
        <CTASection />
      </main>
      <Footer />
    </>
  )
}
