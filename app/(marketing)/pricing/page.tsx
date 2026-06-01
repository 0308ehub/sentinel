import { MarketingNav } from '../components/MarketingNav'
import { Footer } from '../components/Footer'

const tiers = [
  {
    name: 'Free',
    price: '$0',
    priceLabel: null,
    billing: null,
    billingNote: 'Free for everyone',
    cta: 'Get started',
    ctaHref: '/sign-up',
    features: [
      'Unlimited members',
      '2 workspaces',
      '250 documents',
      '50 insights/month',
      'Sentinel Agent (beta)',
    ],
  },
  {
    name: 'Starter',
    price: '$12',
    priceLabel: 'per user/month',
    billing: 'Billed yearly',
    billingNote: null,
    cta: 'Get started',
    ctaHref: '/sign-up',
    features: [
      'All Free features +',
      '5 workspaces',
      'Unlimited documents',
      'Unlimited insights',
      'Unlimited file uploads',
      'Admin roles',
    ],
  },
  {
    name: 'Business',
    price: '$24',
    priceLabel: 'per user/month',
    billing: 'Billed yearly',
    billingNote: null,
    cta: 'Get started',
    ctaHref: '/sign-up',
    features: [
      'All Starter features +',
      'Unlimited workspaces',
      'Private workspaces & guests',
      'Triage Intelligence',
      'Sentinel automations',
      'Code Intelligence (beta)',
      'AI Insights',
      'PRD generation',
    ],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    priceLabel: null,
    billing: null,
    billingNote: 'Annual billing only',
    cta: 'Contact sales',
    ctaHref: '/contact',
    features: [
      'All Business features +',
      'Invoice/PO billing',
      'SAML and SCIM',
      'Granular admin controls',
      'Enterprise-grade security',
      'Advanced org modeling',
      'Migration & onboarding support',
      'Priority support',
    ],
  },
]

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-[#555] mt-0.5 flex-shrink-0" viewBox="0 0 16 16" fill="none">
      <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PricingTier({ tier }: { tier: (typeof tiers)[number] }) {
  return (
    <div className="bg-[#0a0a0a] p-8 flex flex-col">
      <h3 className="text-[18px] font-semibold text-white mb-2">{tier.name}</h3>
      <div className="flex items-baseline gap-1.5 mb-1">
        <span className="text-[32px] font-bold text-white leading-none">{tier.price}</span>
        {tier.priceLabel && (
          <span className="text-[13px] text-[#555]">{tier.priceLabel}</span>
        )}
      </div>
      <div className="border-t border-white/[0.06] my-5" />
      {tier.billing ? (
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-4 bg-[#5b6af9] rounded-full flex items-center px-0.5">
            <div className="w-3 h-3 rounded-full bg-white ml-auto" />
          </div>
          <span className="text-[12px] text-[#555]">{tier.billing}</span>
        </div>
      ) : (
        <p className="text-[13px] text-[#555] mb-5">{tier.billingNote}</p>
      )}
      <ul className="space-y-2.5 flex-1 mb-8">
        {tier.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <CheckIcon />
            <span className="text-[13px] text-[#888]">{f}</span>
          </li>
        ))}
      </ul>
      <a
        href={tier.ctaHref}
        className="text-center text-[13px] font-medium py-2.5 rounded-lg border border-white/[0.12] text-white hover:bg-white/[0.05] transition-colors"
      >
        {tier.cta}
      </a>
    </div>
  )
}

export default function PricingPage() {
  return (
    <>
      <MarketingNav />
      <main className="min-h-screen bg-[#0a0a0a]">
        <div className="max-w-[1200px] mx-auto px-6 pt-20 pb-24">
          <h1 className="text-[clamp(2.5rem,5vw,4rem)] font-bold text-white tracking-tight mb-16">
            Pricing
          </h1>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-px bg-white/[0.06] rounded-xl overflow-hidden border border-white/[0.06]">
            {tiers.map((tier) => (
              <PricingTier key={tier.name} tier={tier} />
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
