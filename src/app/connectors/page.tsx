import type { Metadata } from "next";
import { MarketingFrame } from "@/components/marketing/marketing-frame";
import { ConnectorsGallery } from "@/components/marketing/connectors-gallery";

export const metadata: Metadata = {
  title: "Connectors — Kismet",
  description: "The tools Kismet can read from the company you already run.",
};

export default function ConnectorsPage() {
  return (
    <MarketingFrame>
      <main className="px-6 py-10 md:px-12">
        <ConnectorsGallery />
      </main>
    </MarketingFrame>
  );
}
