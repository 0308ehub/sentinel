import Link from "next/link";

const LINKS = [
  { href: "/docs", label: "Docs" },
  { href: "/integrations", label: "Integrations" },
  { href: "/compare", label: "Comparisons" },
];

export function SiteFooter() {
  return (
    <footer className="bg-[#111] text-white">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-8 px-6 py-10 md:px-8">
        <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Footer">
          {LINKS.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm text-white/75 hover:text-white">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/70">
          <span>© {new Date().getFullYear()} Kismet</span>
          <Link href="/privacy" className="hover:text-white">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-white">
            Terms
          </Link>
        </div>
      </div>
    </footer>
  );
}
