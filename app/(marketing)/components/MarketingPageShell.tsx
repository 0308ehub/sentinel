import Link from 'next/link'
import { MarketingNav } from './MarketingNav'
import { Footer } from './Footer'

interface Pill {
  label: string
}

interface Card {
  title: string
  body: string
}

interface MarketingPageShellProps {
  pill?: Pill
  title: string
  description: string
  cards?: Card[]
  ctaLabel?: string
  ctaHref?: string
  ctaSecondaryLabel?: string
  ctaSecondaryHref?: string
}

export function MarketingPageShell({
  pill,
  title,
  description,
  cards = [],
  ctaLabel = 'Get started free',
  ctaHref = '/sign-up',
  ctaSecondaryLabel,
  ctaSecondaryHref,
}: MarketingPageShellProps) {
  return (
    <>
      <MarketingNav />
      <main>
        {/* Hero */}
        <section className="max-w-[1200px] mx-auto px-6 pt-24 pb-16 text-center">
          {pill && (
            <span className="inline-block mb-5 px-3 py-1 text-[11px] font-medium tracking-widest uppercase text-indigo-400 border border-indigo-500/30 rounded-full bg-indigo-500/10">
              {pill.label}
            </span>
          )}
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-5 max-w-2xl mx-auto">
            {title}
          </h1>
          <p className="text-[#9ca3af] text-lg max-w-xl mx-auto mb-10 leading-relaxed">
            {description}
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href={ctaHref}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-[14px] font-medium px-6 py-2.5 rounded-full transition-colors"
            >
              {ctaLabel}
            </Link>
            {ctaSecondaryLabel && ctaSecondaryHref && (
              <Link
                href={ctaSecondaryHref}
                className="text-[14px] text-[#9ca3af] hover:text-white transition-colors"
              >
                {ctaSecondaryLabel} →
              </Link>
            )}
          </div>
        </section>

        {/* Cards */}
        {cards.length > 0 && (
          <section className="max-w-[1200px] mx-auto px-6 pb-24">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cards.map((card) => (
                <div
                  key={card.title}
                  className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-6"
                >
                  <h3 className="text-[15px] font-medium text-white mb-2">{card.title}</h3>
                  <p className="text-[13px] text-[#9ca3af] leading-relaxed">{card.body}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  )
}
