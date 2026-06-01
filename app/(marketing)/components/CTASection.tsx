import { FadeUp } from './FadeUp'
import { WaitlistForm } from './WaitlistForm'

export function CTASection() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-20">
      <FadeUp>
        <div className="bg-foreground rounded-3xl px-8 py-16 md:px-16 text-center relative overflow-hidden">
          {/* gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-brand/10 via-transparent to-brand/8 pointer-events-none" />
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-brand/8 rounded-full blur-3xl pointer-events-none" />

          <div className="relative">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 px-3 py-1 rounded-full mb-6">
              <span className="w-1.5 h-1.5 bg-brand rounded-full animate-pulse" />
              <span className="text-xs font-medium text-white/70">Accepting early teams now</span>
            </div>

            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 tracking-tight">
              Be the team that ships faster
            </h2>
            <p className="text-white/50 text-lg mb-10 max-w-xl mx-auto leading-relaxed">
              We&apos;re opening Sentinel to a small cohort of early teams. Get personal onboarding and lock in founding-member pricing.
            </p>

            <div className="max-w-md mx-auto">
              <WaitlistForm dark />
            </div>
            <p className="text-white/30 text-xs mt-4">No credit card required.</p>
          </div>
        </div>
      </FadeUp>
    </section>
  )
}
