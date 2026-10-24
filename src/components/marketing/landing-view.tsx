import Link from "next/link";
import { MarketingFrame } from "@/components/marketing/marketing-frame";
import { PRODUCT_DOCS } from "@/lib/product-docs";

export function LandingView() {
  return (
    <MarketingFrame>
      <main className="px-6 pb-16 pt-16 md:px-16 md:pt-24">
        <div className="max-w-2xl">
          <h1 className="text-[2rem] font-semibold leading-[1.15] tracking-[-0.03em] text-[#111] md:text-[2.65rem]">
            Kismet is an AI-native platform for product teams.
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-[#3c4250] md:text-xl">
            The <span className="font-semibold text-[#111]">product brain</span> for your company.
          </p>
        </div>

        <ul className="mt-14 max-w-2xl space-y-5">
          {PRODUCT_DOCS.map((doc) => (
            <li key={doc.slug}>
              <Link href={`/docs/${doc.slug}`} className="group block text-[17px] leading-relaxed">
                <span className="font-semibold text-[#111] group-hover:underline">{doc.title}.</span>{" "}
                <span className="text-[#3c4250]">{doc.summary}</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </MarketingFrame>
  );
}
