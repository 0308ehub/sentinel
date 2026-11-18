import Link from "next/link";

const COLUMNS = [
  {
    title: "Product",
    links: [
      ["Experiments", "/docs/experiment"],
      ["Guardrails", "/docs/optimize"],
      ["Ship", "/docs/ship"],
      ["Pricing", "/pricing"],
      ["Connectors", "/connectors"],
    ],
  },
  {
    title: "Company",
    links: [
      ["Enterprise", "/enterprise"],
      ["Blog", "/blog"],
      ["Contact sales", "/contact"],
      ["Learn", "/learn"],
    ],
  },
  {
    title: "Developers",
    links: [
      ["Docs", "/docs"],
      ["Benchmark", "/benchmark"],
      ["Compare", "/compare"],
    ],
  },
  {
    title: "Resources",
    links: [
      ["Privacy", "/privacy"],
      ["Terms", "/terms"],
      ["Sign in", "/sign-in"],
      ["Sign up", "/sign-up"],
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="bg-[#2454e6] text-white">
      <div className="mx-auto max-w-[1200px] px-6 pb-10 pt-16 md:px-8 md:pt-20">
        <p className="text-xs font-medium tracking-[0.14em] text-white/70">KISMET</p>
        <p className="mt-4 max-w-[14em] text-[clamp(2.4rem,5vw,4.4rem)] font-medium leading-[0.98] tracking-[-0.04em]">
          Know what to test next.
        </p>
        <div className="mt-14 grid gap-10 border-t border-white/25 pt-10 sm:grid-cols-2 lg:grid-cols-4">
          {COLUMNS.map((column) => (
            <div key={column.title}>
              <p className="text-sm font-medium">{column.title}</p>
              <ul className="mt-4 space-y-2.5">
                {column.links.map(([label, href]) => (
                  <li key={href}>
                    <Link href={href} className="text-sm text-white/75 hover:text-white">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/70">
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
