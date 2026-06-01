import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-brand flex items-center justify-center">
            <span className="text-brand-foreground text-[10px] font-bold">S</span>
          </div>
          <span className="text-sm font-semibold text-foreground">Sentinel</span>
        </div>
        <div className="flex items-center gap-6 text-xs text-muted-foreground">
          <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          <span>© 2025 Sentinel AI</span>
        </div>
      </div>
    </footer>
  )
}
