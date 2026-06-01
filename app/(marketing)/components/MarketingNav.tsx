import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'
import { SentinelLogo } from './SentinelLogo'

const NAV_LINKS = [
  { label: 'Product', href: '/product' },
  { label: 'Customers', href: '/customers' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Contact', href: '/contact' },
] as const

export async function MarketingNav() {
  const { userId } = await auth()
  const isLoggedIn = Boolean(userId)

  return (
    <header className="sticky top-0 z-50 h-14 border-b border-white/[0.06] bg-[#0a0a0a]/90 backdrop-blur-md">
      <nav
        aria-label="Main navigation"
        className="max-w-[1200px] mx-auto px-6 h-full flex items-center justify-between"
      >
        {/* Logo */}
        <Link href="/" aria-label="Sentinel home">
          <SentinelLogo />
        </Link>

        {/* Center nav links */}
        <ul className="hidden md:flex items-center gap-6 list-none m-0 p-0">
          {NAV_LINKS.map(({ label, href }) => (
            <li key={href}>
              <Link
                href={href}
                className="text-[13px] text-[#888888] hover:text-white transition-colors"
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Right side auth actions */}
        <div className="flex items-center gap-3">
          <span className="hidden md:block w-px h-4 bg-white/20" aria-hidden="true" />
          {isLoggedIn ? (
            <Link
              href="/dashboard"
              className="text-[13px] text-[#888888] hover:text-white transition-colors"
            >
              Dashboard &rarr;
            </Link>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="text-[13px] text-[#888888] hover:text-white transition-colors"
              >
                Log in
              </Link>
              <Link
                href="/sign-up"
                className="bg-white text-black text-[13px] font-medium px-4 py-1.5 rounded-full hover:bg-white/90 transition-colors"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}
