import Link from "next/link";
import { MarketingFrame } from "@/components/marketing/marketing-frame";

export function PlaceholderPage({
  title,
  lede,
  action,
}: {
  title: string;
  lede: string;
  action?: { href: string; label: string };
}) {
  return (
    <MarketingFrame>
      <main className="px-6 pb-24 pt-16 md:px-16 md:pt-20">
        <h1 className="max-w-xl text-[2rem] font-medium leading-[1.15] tracking-[-0.03em] text-[#141414] md:text-[2.5rem]">
          {title}
        </h1>
        <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-[#3c4250]">{lede}</p>
        {action && (
          <Link
            href={action.href}
            className="mt-8 inline-flex h-10 items-center rounded-full bg-[#0571d3] px-4 text-sm font-medium text-white hover:bg-[#0460b5]"
          >
            {action.label}
          </Link>
        )}
      </main>
    </MarketingFrame>
  );
}
