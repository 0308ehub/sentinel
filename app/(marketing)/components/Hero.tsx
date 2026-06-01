import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'
import { SentinelDemo } from './SentinelDemo'
import { WaitlistForm } from './WaitlistForm'

export async function Hero() {
  const { userId } = await auth()

  return (
    <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 md:pt-28 md:pb-20">
      <div className="max-w-3xl mx-auto text-center mb-12">
        {/* Eyebrow */}
        <div className="inline-flex items-center gap-2 border border-border px-3 py-1 rounded-full mb-7">
          <span className="w-1.5 h-1.5 bg-brand rounded-full animate-pulse" />
          <span className="text-xs font-medium text-muted-foreground">Early Access — Limited Spots</span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-semibold text-foreground leading-[1.05] tracking-tight mb-5">
          The first AI that{' '}
          <span className="text-brand">runs your projects</span>
        </h1>

        {/* Subheadline */}
        <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-10">
          Sentinel scans your connectors hourly, surfaces insights, and autonomously generates tickets — so your team ships instead of manages.
        </p>

        {/* CTA */}
        {userId ? (
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/dashboard"
              className="bg-foreground text-background px-5 py-2.5 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity"
            >
              Go to Dashboard →
            </Link>
          </div>
        ) : (
          <div id="waitlist">
            <WaitlistForm />
            <p className="text-xs text-muted-foreground mt-3">
              No credit card required.
            </p>
          </div>
        )}
      </div>

      {/* Demo window */}
      <div className="relative max-w-4xl mx-auto">
        <SentinelDemo />
        {/* Floating badge */}
        <div className="absolute -right-3 -top-3 bg-background border border-border rounded-xl px-3 py-2 shadow-lg text-left hidden md:block">
          <p className="text-xs font-semibold text-foreground">4.2 hrs saved</p>
          <p className="text-xs text-muted-foreground">this sprint</p>
        </div>
      </div>
    </section>
  )
}
