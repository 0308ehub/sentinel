import { auth, currentUser } from '@clerk/nextjs/server'
import Link from 'next/link'
import Image from 'next/image'
import { ThemeToggle } from '@/components/theme-toggle'

export async function MarketingNav() {
  const { userId } = await auth()
  const user = userId ? await currentUser() : null

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <nav className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-brand flex items-center justify-center">
            <span className="text-brand-foreground text-xs font-bold">S</span>
          </div>
          <span className="font-semibold text-sm tracking-tight text-foreground">Sentinel</span>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5"
              >
                Dashboard
              </Link>
              <Link
                href="/dashboard"
                className="flex items-center gap-2 text-sm font-medium bg-foreground text-background px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
              >
                {user.imageUrl ? (
                  <Image
                    src={user.imageUrl}
                    alt={user.firstName ?? 'User'}
                    width={20}
                    height={20}
                    className="rounded-full"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-brand flex items-center justify-center">
                    <span className="text-brand-foreground text-[10px] font-bold">
                      {(user.firstName?.[0] ?? user.emailAddresses[0]?.emailAddress?.[0] ?? 'U').toUpperCase()}
                    </span>
                  </div>
                )}
                {user.firstName ?? 'Account'}
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5"
              >
                Sign in
              </Link>
              <a
                href="#waitlist"
                className="text-sm font-medium bg-foreground text-background px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
              >
                Get early access
              </a>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}
