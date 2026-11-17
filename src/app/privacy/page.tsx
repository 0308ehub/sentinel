import type { Metadata } from "next";
import Link from "next/link";
import { MarketingFrame } from "@/components/marketing/marketing-frame";

export const metadata: Metadata = {
  title: "Privacy policy — Kismet",
  description: "How Kismet handles the company data you connect.",
};

export default function PrivacyPage() {
  return (
    <MarketingFrame>
      <main className="max-w-2xl px-6 pb-16 pt-16 text-[15px] leading-relaxed text-[#3c4250] md:px-16 md:pt-20">
        <h1 className="text-3xl font-semibold tracking-[-0.03em] text-[#111]">Privacy policy</h1>
        <p className="mt-3 text-sm text-[#6a717c]">Updated November 7, 2026.</p>
        <div className="mt-8 space-y-4">
          <p>
            Kismet reads the tools you connect so it can answer product questions. That includes Slack, Google, Jira,
            Databricks, GitHub, Figma, and any other connector you turn on.
          </p>
          <p>
            Chat is sent to the model provider configured for the workspace, Anthropic or OpenAI, along with the
            excerpts needed to answer. Kismet does not train a foundation model on that data, and it does not sell it.
          </p>
          <p>
            Sign-in is handled by Clerk. The host that serves this site may count page views without setting an
            analytics cookie. Shared document links are not listed for search engines.
          </p>
          <p>
            Keys you paste stay with the workspace that asked for them. Disconnecting a source stops Kismet from
            reading it. Model use is capped per account and for the whole site, so one script cannot run up the bill.
          </p>
          <p>
            To ask what is stored, or to ask for it to be deleted, write through{" "}
            <Link href="/contact" className="text-[#111] underline">Talk to us</Link>.
            The same address is where to report a security problem.
          </p>
          <p>Kismet is not directed at children.</p>
          <p>
            This is a plain summary of how the product behaves. It is not a negotiated enterprise agreement, and it is
            not legal advice.
          </p>
        </div>
      </main>
    </MarketingFrame>
  );
}
