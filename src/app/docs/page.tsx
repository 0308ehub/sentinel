import type { Metadata } from "next";
import Link from "next/link";
import { MarketingFrame } from "@/components/marketing/marketing-frame";
import { PRODUCT_DOCS } from "@/lib/product-docs";

export const metadata: Metadata = {
  title: "Documentation — Kismet",
  description: "What Kismet can do: optimize, experiment, explore, plan, and ship.",
};

export default function DocsPage() {
  return (
    <MarketingFrame>
      <main className="px-6 pb-16 pt-16 md:px-16 md:pt-20">
        <h1 className="text-3xl font-semibold tracking-[-0.03em]">Documentation</h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[#3c4250]">
          Five parts of the product brain. Each one is a way Kismet works with the company you already run.
        </p>
        <ul className="mt-10 max-w-2xl divide-y divide-[#eceef1] border-y border-[#eceef1]">
          <li>
            <Link href="/any" className="block py-5 hover:bg-[#fafbfc]">
              <span className="font-semibold">any%</span>
              <p className="mt-1 text-sm leading-relaxed text-[#3c4250]">
                The experimentation platform. The shortest valid test, then the next one.
              </p>
            </Link>
          </li>
          {PRODUCT_DOCS.map((doc) => (
            <li key={doc.slug}>
              <Link href={`/docs/${doc.slug}`} className="block py-5 hover:bg-[#fafbfc]">
                <span className="font-semibold">{doc.title}</span>
                <p className="mt-1 text-sm leading-relaxed text-[#3c4250]">{doc.summary}</p>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </MarketingFrame>
  );
}
