import React from 'react'

type FeatureSectionProps = {
  number: string
  label: string
  headline: string
  subheadline: string
  mockup: React.ReactNode
  border?: boolean
}

export function FeatureSection({
  number,
  label,
  headline,
  subheadline,
  mockup,
  border = true,
}: FeatureSectionProps) {
  return (
    <section className={`py-24 ${border !== false ? 'border-t border-white/[0.06]' : ''}`}>
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 mb-12 lg:mb-20 items-start">
          <h2 className="text-[clamp(2.5rem,5vw,4rem)] font-bold tracking-tight leading-[1.05] text-white">
            {headline}
          </h2>
          <div>
            <p className="text-[17px] text-[#888] leading-relaxed mb-6">{subheadline}</p>
            <div className="flex items-center gap-2 text-[13px] text-[#555]">
              <span className="font-medium text-[#888]">{number}</span>
              <span className="text-[#333]">·</span>
              <span className="text-white/60 hover:text-white transition-colors cursor-pointer">{label}</span>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-white/[0.06] overflow-hidden bg-[#0f0f0f]">
          {mockup}
        </div>
      </div>
    </section>
  )
}
