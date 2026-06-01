import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'
import { HeroDemo } from './HeroDemo'

export async function Hero() {
  const { userId } = await auth()

  return (
    <section className="relative overflow-hidden">
      <div className="max-w-[1200px] mx-auto px-6 py-16 lg:py-24">
        <div className="flex flex-col lg:flex-row lg:items-center gap-12 lg:gap-16">

          {/* Left: headline + CTAs */}
          <div className="flex-1">
            <div className="flex items-center gap-2.5 mb-7">
              <span className="w-2 h-2 rounded-full bg-[#5b6af9] motion-safe:animate-pulse flex-shrink-0" />
              <span className="text-[13px] text-[#888]">AI product intelligence is here</span>
              <a
                href="/sign-up"
                className="text-[13px] text-white/40 hover:text-white/60 transition-colors"
              >
                sentinel.ai/start →
              </a>
            </div>

            <h1 className="text-[clamp(2.5rem,4.5vw,4.5rem)] font-bold tracking-[-0.03em] leading-[1.03] text-white mb-5">
              The autonomous PM<br className="hidden sm:block" /> for teams and agents
            </h1>
            <p className="text-[17px] text-[#888] leading-relaxed mb-9 max-w-[400px]">
              Purpose-built for product intelligence and workflow automation. Designed for the AI era.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/sign-up"
                className="bg-white text-black text-[14px] font-medium px-5 py-2.5 rounded-lg hover:bg-white/90 transition-colors cursor-pointer"
              >
                Get started free
              </Link>
              <Link
                href="/contact"
                className="text-[14px] text-[#888] hover:text-white transition-colors px-5 py-2.5 border border-white/[0.12] rounded-lg hover:border-white/20 cursor-pointer"
              >
                Contact sales
              </Link>
            </div>

            {userId && (
              <div className="mt-5">
                <Link
                  href="/dashboard"
                  className="text-[13px] text-[#888] hover:text-white transition-colors"
                >
                  Go to dashboard →
                </Link>
              </div>
            )}
          </div>

          {/* Right: animated live demo */}
          <div className="flex-1 w-full lg:max-w-[500px]">
            <HeroDemo />
          </div>

        </div>
      </div>
    </section>
  )
}
