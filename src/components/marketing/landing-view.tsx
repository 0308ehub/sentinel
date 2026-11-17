import Link from "next/link";
import { ExperimentDemo } from "@/components/marketing/experiment-demo";
import { FeatureBento } from "@/components/marketing/feature-bento";
import { MarketingFrame } from "@/components/marketing/marketing-frame";
import { SafariFrame } from "@/components/marketing/safari-frame";
import { TopoField } from "@/components/marketing/topo-field";

export function LandingView() {
  return (
    <MarketingFrame>
      <main>
        <section className="mx-auto max-w-[1200px] px-6 pb-2 pt-14 md:px-8 md:pt-20">
          <h1 className="max-w-[16em] text-left text-[clamp(1.85rem,3vw,2.6rem)] font-medium leading-[1.18] tracking-[-0.035em] text-[#141414]">
            Kismet is the modern product platform for the fastest software teams.
          </h1>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="/sign-up"
              className="inline-flex h-10 items-center rounded-full bg-[#0571d3] px-4 text-sm font-medium text-white hover:bg-[#0460b5]"
            >
              Sign up
            </Link>
            <Link
              href="/contact"
              className="inline-flex h-10 items-center rounded-full border border-[#e4e3de] bg-white px-4 text-sm font-medium text-[#2a2a28] hover:bg-[#fbfbfa]"
            >
              Request a demo
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-[1200px] px-4 pb-6 pt-10 md:px-8 md:pt-12" aria-label="Product demo">
          <div className="demo-stage">
            <TopoField />
            <div className="relative z-10 p-4 sm:p-6 md:p-10">
              <SafariFrame>
                <ExperimentDemo surface="window" />
              </SafariFrame>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-[1200px] px-4 pb-20 pt-4 md:px-8">
          <FeatureBento />
        </div>
      </main>
    </MarketingFrame>
  );
}
