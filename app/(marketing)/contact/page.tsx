import { MarketingNav } from '../components/MarketingNav'
import { Footer } from '../components/Footer'

export default function ContactPage() {
  return (
    <>
      <MarketingNav />
      <main className="min-h-screen bg-[#0a0a0a]">
        <div className="max-w-[1200px] mx-auto px-6 pt-20 pb-24">
          <div className="grid grid-cols-2 gap-16 items-start">
            {/* Left */}
            <div>
              <h1 className="text-[clamp(2.5rem,5vw,4rem)] font-bold text-white tracking-tight leading-[1.05] mb-5">
                How can we help?
              </h1>
              <p className="text-[16px] text-[#555] leading-relaxed max-w-[320px]">
                Get in touch with our sales and support teams for demos, onboarding support, or product questions.
              </p>
            </div>

            {/* Right: contact cards */}
            <div className="space-y-3">
              <div className="border border-white/[0.06] rounded-xl p-8 flex flex-col gap-12 bg-[#0f0f0f]">
                <h2 className="text-[15px] font-medium text-white">Sales</h2>
                <div>
                  <p className="text-[14px] text-[#555] leading-relaxed mb-4">
                    Speak to our sales team about plans, pricing, enterprise contracts, or request a demo.
                  </p>
                  <a
                    href="mailto:sales@sentinel.ai"
                    className="text-[13px] text-white border border-white/[0.12] rounded-lg px-4 py-2 hover:bg-white/[0.05] transition-colors inline-block"
                  >
                    Contact sales →
                  </a>
                </div>
              </div>

              <div className="border border-white/[0.06] rounded-xl p-8 flex flex-col gap-12 bg-[#0f0f0f]">
                <h2 className="text-[15px] font-medium text-white">Support</h2>
                <div>
                  <p className="text-[14px] text-[#555] leading-relaxed mb-4">
                    We are here to help. Ask us product questions, report problems, or leave feedback.
                  </p>
                  <a
                    href="mailto:support@sentinel.ai"
                    className="text-[13px] text-white border border-white/[0.12] rounded-lg px-4 py-2 hover:bg-white/[0.05] transition-colors inline-block"
                  >
                    Get support →
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom row */}
          <div className="mt-20 pt-12 border-t border-white/[0.06] grid grid-cols-2 gap-16">
            <div />
            <div className="grid grid-cols-2 gap-8">
              <div>
                <h3 className="text-[13px] font-medium text-white mb-3">Community</h3>
                <p className="text-[13px] text-[#555] mb-2">Connect with Sentinel users on Slack</p>
                <a href="#" className="text-[13px] text-[#888] hover:text-white transition-colors">
                  Join Slack ↗
                </a>
              </div>
              <div>
                <h3 className="text-[13px] font-medium text-white mb-3">General communication</h3>
                <p className="text-[13px] text-[#555] mb-2">For other questions, email us</p>
                <a href="mailto:hello@sentinel.ai" className="text-[13px] text-[#888] hover:text-white transition-colors">
                  hello@sentinel.ai +
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
