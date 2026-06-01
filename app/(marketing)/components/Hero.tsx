import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'
import { SentinelDemo } from './SentinelDemo'
import { WaitlistForm } from './WaitlistForm'

export async function Hero() {
  const { userId } = await auth()

  return (
    <section className="relative max-w-6xl mx-auto px-6 pt-20 pb-16 md:pt-32 md:pb-24 overflow-hidden">
      {/* Gradient blob background — Linear style */}
      <div className="pointer-events-none absolute inset-0 flex items-start justify-center">
        <div className="w-[800px] h-[500px] rounded-full bg-gradient-to-r from-brand/10 via-brand/6 to-brand/10 blur-3xl opacity-60 -translate-y-1/4" />
      </div>

      <div className="relative max-w-3xl mx-auto text-center mb-14">
        {/* Eyebrow — animate on load */}
        <div
          className="inline-flex items-center gap-2 border border-border px-3 py-1 rounded-full mb-8 animate-fade-up"
          style={{ animationDelay: '0ms', animationFillMode: 'both' }}
        >
          <span className="w-1.5 h-1.5 bg-brand rounded-full animate-pulse" />
          <span className="text-xs font-medium text-muted-foreground">Early Access — Limited Spots</span>
        </div>

        {/* Headline */}
        <h1
          className="text-5xl md:text-6xl lg:text-[4.5rem] font-bold text-foreground leading-[1.06] tracking-tight mb-5 animate-fade-up"
          style={{ animationDelay: '80ms', animationFillMode: 'both' }}
        >
          The first AI that{' '}
          <span className="text-brand">runs your projects</span>
        </h1>

        {/* Subheadline */}
        <p
          className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-10 animate-fade-up"
          style={{ animationDelay: '160ms', animationFillMode: 'both' }}
        >
          Sentinel scans your connectors hourly, surfaces insights, and
          autonomously generates tickets — so your team ships instead of manages.
        </p>

        {/* CTA */}
        <div
          className="animate-fade-up"
          style={{ animationDelay: '240ms', animationFillMode: 'both' }}
        >
          {userId ? (
            <div className="flex items-center justify-center gap-3">
              <Link
                href="/dashboard"
                className="bg-foreground text-background px-6 py-3 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity"
              >
                Go to Dashboard →
              </Link>
            </div>
          ) : (
            <div id="waitlist">
              <WaitlistForm />
              <p className="text-xs text-muted-foreground mt-3">No credit card required.</p>
            </div>
          )}
        </div>
      </div>

      {/* Demo window */}
      <div
        className="relative max-w-4xl mx-auto animate-fade-up"
        style={{ animationDelay: '360ms', animationFillMode: 'both' }}
      >
        <SentinelDemo />
        <div className="absolute -right-3 -top-3 bg-background border border-border rounded-xl px-3 py-2 shadow-lg text-left hidden md:block">
          <p className="text-xs font-semibold text-foreground">4.2 hrs saved</p>
          <p className="text-xs text-muted-foreground">this sprint</p>
        </div>
      </div>
    </section>
  )
}
