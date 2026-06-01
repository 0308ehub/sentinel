import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'
import { HeroMockup } from './HeroMockup'

export async function Hero() {
  const { userId } = await auth()

  return (
    <section className="relative pt-32 pb-0 overflow-hidden">
      <div className="max-w-[1200px] mx-auto px-6">
        {/* Content row */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 lg:gap-8 mb-12 lg:mb-16">
          {/* Left: headline + subtitle */}
          <div className="max-w-[660px]">
            <h1 className="text-[clamp(3rem,6.5vw,5.5rem)] font-bold tracking-[-0.03em] leading-[1.02] text-white mb-5">
              The autonomous PM<br />for teams and agents
            </h1>
            <p className="text-[17px] text-[#888888] leading-relaxed max-w-[440px]">
              Purpose-built for product intelligence and workflow automation. Designed for the AI era.
            </p>
          </div>

          {/* Right: live indicator pill */}
          <div className="flex-shrink-0 mt-4 flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-[#5b6af9] motion-safe:animate-pulse flex-shrink-0" />
            <span className="text-[14px] text-[#888888]">AI product intelligence is here</span>
            <a
              href="/sign-up"
              className="text-[14px] text-white/50 hover:text-white transition-colors"
            >
              sentinel.ai/start →
            </a>
          </div>
        </div>

        {/* Mockup */}
        <div className="relative">
          <HeroMockup />
          {/* Gradient fade at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#0a0a0a] to-transparent pointer-events-none" />
        </div>

        {/* Dashboard link for logged-in users */}
        {userId && (
          <div className="mt-6 text-center">
            <Link
              href="/dashboard"
              className="text-[13px] text-[#888] hover:text-white transition-colors"
            >
              Go to dashboard →
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}
