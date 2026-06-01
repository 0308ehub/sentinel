import Link from 'next/link'
import { SentinelLogo } from './SentinelLogo'

const FOOTER_COLUMNS = [
  {
    heading: 'Product',
    links: [
      { label: 'Intake', href: '#' },
      { label: 'Synthesize', href: '#' },
      { label: 'Act', href: '#' },
      { label: 'Automate', href: '#' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Security', href: '#' },
    ],
  },
  {
    heading: 'Features',
    links: [
      { label: 'Connectors', href: '#' },
      { label: 'Agents', href: '#' },
      { label: 'Customer Requests', href: '#' },
      { label: 'Insights', href: '#' },
      { label: 'Mobile', href: '#' },
      { label: 'Changelog', href: '#' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About', href: '#' },
      { label: 'Customers', href: '/customers' },
      { label: 'Careers', href: '#' },
      { label: 'Blog', href: '#' },
      { label: 'Method', href: '#' },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { label: 'Documentation', href: '#' },
      { label: 'Download', href: '#' },
      { label: 'Status', href: '#' },
      { label: 'Enterprise', href: '#' },
      { label: 'Startups', href: '#' },
    ],
  },
  {
    heading: 'Connect',
    links: [
      { label: 'Contact us', href: '/contact' },
      { label: 'Community', href: '#' },
      { label: 'X (Twitter)', href: '#' },
      { label: 'GitHub', href: '#' },
      { label: 'YouTube', href: '#' },
    ],
  },
] as const

export function Footer() {
  return (
    <footer className="bg-[#0a0a0a] border-t border-white/[0.06] py-16">
      <div className="max-w-[1200px] mx-auto px-6">
        {/* Main grid: logo col + 5 link columns */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-10">
          {/* Logo column */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" aria-label="Sentinel home">
              <SentinelLogo />
            </Link>
          </div>

          {/* Link columns */}
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.heading}>
              <p className="text-[13px] font-medium text-white mb-4">{col.heading}</p>
              <ul className="list-none m-0 p-0">
                {col.links.map(({ label, href }) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="block text-[13px] text-[#555555] hover:text-[#888888] transition-colors mb-2"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom copyright row */}
        <div className="mt-12 pt-8 border-t border-white/[0.04] text-center">
          <p className="text-[12px] text-[#444444]">© 2025 Sentinel AI</p>
        </div>
      </div>
    </footer>
  )
}
