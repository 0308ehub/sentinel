"use client"
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import { SentinelLogo } from './SentinelLogo'

const navLinks = [
  { href: '/customers', label: 'Customers' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/contact', label: 'Contact' },
]

export function MarketingNavClient({ isLoggedIn }: { isLoggedIn: boolean }) {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0d1117]/90 backdrop-blur-md">
      <nav aria-label="Main navigation" className="max-w-[1200px] mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" aria-label="Sentinel home" className="flex items-center gap-2.5 flex-shrink-0">
          <SentinelLogo />
        </Link>
        <ul className="hidden md:flex items-center gap-6 list-none m-0 p-0">
          {navLinks.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={`text-[13px] transition-colors cursor-pointer ${active ? 'text-white' : 'text-[#888] hover:text-white'}`}
                >
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>
        <div className="flex items-center gap-3">
          <span className="hidden md:block w-px h-4 bg-white/20" aria-hidden="true" />
          {isLoggedIn ? (
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="text-[13px] text-[#888] hover:text-white transition-colors cursor-pointer">
                Dashboard
              </Link>
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: 'h-7 w-7 rounded-full',
                  },
                }}
              />
            </div>
          ) : (
            <>
              <Link href="/sign-in" className="text-[13px] text-[#888] hover:text-white transition-colors cursor-pointer">
                Log in
              </Link>
              <Link
                href="/sign-up"
                className="bg-white text-black text-[13px] font-medium px-4 py-1.5 rounded-full hover:bg-white/90 transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
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
