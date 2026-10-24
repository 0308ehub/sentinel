import type { Metadata } from "next";
import { MarketingFrame } from "@/components/marketing/marketing-frame";

export const metadata: Metadata = {
  title: "Terms of service — Kismet",
  description: "The terms for using Kismet.",
};

export default function TermsPage() {
  return (
    <MarketingFrame>
      <main className="max-w-2xl px-6 pb-16 pt-16 text-[15px] leading-relaxed text-[#3c4250] md:px-16 md:pt-20">
        <h1 className="text-3xl font-semibold tracking-[-0.03em] text-[#111]">Terms of service</h1>
        <div className="mt-8 space-y-4">
          <p>
            Kismet is a workspace for your product team. You keep ownership of your company’s data. You are responsible
            for the accounts and keys you connect, and for who on your team can use them.
          </p>
          <p>
            Experiments that Kismet ships run only inside the permissions you grant. A change that needs a person still
            waits for that person.
          </p>
          <p>
            This is a plain summary for the product, not a negotiated enterprise agreement. Talk to a human if you need
            that.
          </p>
        </div>
      </main>
    </MarketingFrame>
  );
}
