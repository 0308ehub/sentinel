import { MarketingNav } from './components/MarketingNav'
import { Hero } from './components/Hero'
import { HowItWorks } from './components/HowItWorks'
import { ProductOverview } from './components/ProductOverview'
import { CTASection } from './components/CTASection'
import { Footer } from './components/Footer'

export default function LandingPage() {
  return (
    <>
      <MarketingNav />
      <main>
        <Hero />
        <HowItWorks />
        <ProductOverview />
        <CTASection />
      </main>
      <Footer />
    </>
  )
}
