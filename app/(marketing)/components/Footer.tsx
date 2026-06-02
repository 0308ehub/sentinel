import Link from 'next/link'
import { SentinelLogo } from './SentinelLogo'

const FOOTER_COLUMNS = [
  {
    heading: 'Product',
    links: [
      { label: 'Intake', href: '/intake' },
      { label: 'Synthesize', href: '/synthesize' },
      { label: 'Act', href: '/act' },
      { label: 'Automate', href: '/automate' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Security', href: '/security' },
    ],
  },
  {
    heading: 'Features',
    links: [
      { label: 'Connectors', href: '/connectors' },
      { label: 'Agents', href: '/agents' },
      { label: 'Customer Requests', href: '/customer-requests' },
      { label: 'Insights', href: '/insights' },
      { label: 'Mobile', href: '/mobile' },
      { label: 'Changelog', href: '/changelog' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Customers', href: '/customers' },
      { label: 'Careers', href: '/careers' },
      { label: 'Blog', href: '/blog' },
      { label: 'Method', href: '/method' },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { label: 'Documentation', href: '/documentation' },
      { label: 'Download', href: '/download' },
      { label: 'Status', href: '/status' },
      { label: 'Enterprise', href: '/enterprise' },
      { label: 'Startups', href: '/startups' },
    ],
  },
  {
    heading: 'Connect',
    links: [
      { label: 'Contact us', href: '/contact' },
      { label: 'Community', href: '/community' },
      { label: 'X (Twitter)', href: 'https://x.com/sentinelai', external: true },
      { label: 'GitHub', href: 'https://github.com/sentinelai', external: true },
      { label: 'YouTube', href: 'https://youtube.com/@sentinelai', external: true },
    ],
  },
] as const

export function Footer() {
  return (
    <footer className="bg-[#0f1523] border-t border-white/[0.08] py-16">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-10">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" aria-label="Sentinel home">
              <SentinelLogo />
            </Link>
          </div>

          {FOOTER_COLUMNS.map((col) => (
            <div key={col.heading}>
              <p className="text-[13px] font-medium text-white mb-4">{col.heading}</p>
              <ul className="list-none m-0 p-0">
                {col.links.map(({ label, href, ...rest }) => {
                  const isExternal = 'external' in rest && rest.external
                  return (
                    <li key={label}>
                      <Link
                        href={href}
                        target={isExternal ? '_blank' : undefined}
                        rel={isExternal ? 'noopener noreferrer' : undefined}
                        className="block text-[13px] text-[#6b7280] hover:text-[#9ca3af] transition-colors mb-2"
                      >
                        {label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-white/[0.06] text-center">
          <p className="text-[12px] text-[#6b7280]">© 2025 Sentinel AI</p>
        </div>
      </div>
    </footer>
  )
}
