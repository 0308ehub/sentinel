import Link from "next/link";
import { BrandLogo } from "@/components/marketing/brand-logo";
import { MarketingFrame } from "@/components/marketing/marketing-frame";
import { PhraseWheel } from "@/components/marketing/phrase-wheel";
import { PRODUCT_DOCS } from "@/lib/product-docs";

export function LandingView() {
  return (
    <MarketingFrame>
      <main>
        <section className="flex min-h-[calc(100svh-4rem)] flex-col items-center justify-center px-6 pb-20 pt-8 text-center">
          <BrandLogo mark priority className="h-20 w-20" />
          <h1 className="mt-8 max-w-4xl text-[2.15rem] font-medium leading-[1.12] tracking-[-0.04em] text-[#111] sm:text-5xl md:text-[3.25rem]">
            <span className="block" aria-hidden>
              Kismet is the AI-native platform
            </span>
            <span className="block" aria-hidden>
              for your product teams to
            </span>
            <PhraseWheel />
          </h1>
        </section>

        <ul className="mx-auto max-w-2xl space-y-5 px-6 pb-20 md:px-8">
          <li>
            <Link href="/any" className="group block text-[17px] leading-relaxed">
              <span className="font-medium text-[#111] group-hover:underline">any%.</span>{" "}
              <span className="font-medium text-[#3c4250]">
                The experimentation platform. Cross the evidence, ship the shortest valid test, and start the next one from the result.
              </span>
            </Link>
          </li>
          {PRODUCT_DOCS.map((doc) => (
            <li key={doc.slug}>
              <Link href={`/docs/${doc.slug}`} className="group block text-[17px] leading-relaxed">
                <span className="font-medium text-[#111] group-hover:underline">{doc.title}.</span>{" "}
                <span className="font-medium text-[#3c4250]">{doc.summary}</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </MarketingFrame>
  );
}
