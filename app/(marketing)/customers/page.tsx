import { MarketingNav } from '../components/MarketingNav'
import { Footer } from '../components/Footer'

const customers = [
  { name: 'Vercel', bg: '#000000', textColor: '#ffffff', headline: 'How Vercel ships 3× faster with Sentinel', type: 'Read story' },
  { name: 'Loom', bg: '#615fff', textColor: '#ffffff', headline: "Loom's PM team runs on autopilot with Sentinel", type: 'Read story' },
  { name: 'Linear', bg: '#5b6af9', textColor: '#ffffff', headline: 'Building Linear with Sentinel as our PM', type: 'Read story' },
  { name: 'Notion', bg: '#1a1a1a', textColor: '#ffffff', headline: 'How Notion triaged 10,000 feedback items in a week', type: 'Watch video' },
  { name: 'Figma', bg: '#f24e1e', textColor: '#ffffff', headline: "Figma's product intelligence story", type: 'Read story' },
  { name: 'Stripe', bg: '#635bff', textColor: '#ffffff', headline: 'Stripe scales product ops with autonomous PM', type: 'Read story' },
  { name: 'OpenAI', bg: '#10a37f', textColor: '#ffffff', headline: 'How OpenAI manages thousands of user requests', type: 'Read story' },
  { name: 'Anthropic', bg: '#c96442', textColor: '#ffffff', headline: "Anthropic's Claude team uses Sentinel for feedback", type: 'Read story' },
  { name: 'Runway', bg: '#111111', textColor: '#f5f5f5', headline: 'Runway ships creative features 2× faster', type: 'Watch video' },
]

const categories = ['Featured', 'SaaS', 'AI', 'Fintech', 'Consumer', 'Enterprise']

export default function CustomersPage() {
  return (
    <>
      <MarketingNav />
      <main className="min-h-screen bg-[#0a0a0a]">
        <div className="max-w-[1200px] mx-auto px-6 pt-20 pb-12">
          <h1 className="text-[clamp(2.5rem,5vw,4rem)] font-bold text-white tracking-tight mb-8">
            Customers
          </h1>
          <div className="flex items-center gap-0 border-b border-white/[0.06]">
            {categories.map((cat, i) => (
              <button
                key={cat}
                className={`px-4 py-2.5 text-[13px] transition-colors border-b-2 -mb-px ${
                  i === 0
                    ? 'text-white border-white'
                    : 'text-[#555] border-transparent hover:text-[#888]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="max-w-[1200px] mx-auto px-6 pb-24">
          <div className="grid grid-cols-3 gap-6">
            {customers.map((c) => (
              <div key={c.name} className="group cursor-pointer">
                <div
                  className="rounded-xl mb-4 h-[200px] flex items-center justify-center overflow-hidden border border-white/[0.06]"
                  style={{ backgroundColor: c.bg }}
                >
                  <span
                    className="text-[28px] font-bold tracking-tight"
                    style={{ color: c.textColor }}
                  >
                    {c.name}
                  </span>
                </div>
                <p className="text-[15px] text-white font-medium leading-snug mb-2">
                  {c.headline}
                </p>
                <p className="text-[13px] text-[#555] group-hover:text-[#888] transition-colors">
                  {c.type} →
                </p>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
