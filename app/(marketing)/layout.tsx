import Link from "next/link";
import { ElvaMark } from "@/components/brand/elva-logo";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="marketing min-h-screen overflow-x-hidden">
      <header className="sticky top-0 z-50 border-b border-[var(--rule)] bg-[var(--paper)]/85 backdrop-blur-md">
        <nav
          aria-label="Main navigation"
          className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4"
        >
          <Link href="/" className="flex items-center gap-2.5 text-[var(--ink)]">
            <ElvaMark size={20} />
            <span className="font-display text-lg font-semibold tracking-tight">Elva</span>
          </Link>

          <div className="flex items-center gap-1 text-sm">
            <a
              href="#how"
              className="hidden rounded-full px-4 py-2 text-[var(--ink-soft)] transition-colors hover:bg-[var(--paper-deep)] hover:text-[var(--ink)] sm:block"
            >
              How it works
            </a>
            <a
              href="#safety"
              className="hidden rounded-full px-4 py-2 text-[var(--ink-soft)] transition-colors hover:bg-[var(--paper-deep)] hover:text-[var(--ink)] sm:block"
            >
              For parents
            </a>
            <Link
              href="/sign-in"
              className="rounded-full px-4 py-2 text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)]"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="rounded-full bg-[var(--ink)] px-5 py-2 font-medium text-[var(--paper)] transition-transform duration-200 hover:-translate-y-px hover:bg-[var(--accent)]"
            >
              Get started
            </Link>
          </div>
        </nav>
      </header>

      <main>{children}</main>

      <footer className="border-t border-[var(--rule)] bg-[var(--paper-deep)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <ElvaMark size={18} />
            <span className="font-display text-base font-semibold">Elva</span>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-[var(--ink-faint)]">
            An AI mentor that learns how your child thinks. Built with parental consent,
            review, and deletion at its core.
          </p>
          <p className="text-xs text-[var(--ink-faint)]">
            © {new Date().getFullYear()} Elva
          </p>
        </div>
      </footer>
    </div>
  );
}
