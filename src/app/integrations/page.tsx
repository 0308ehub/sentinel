import type { Metadata } from "next";
import { MarketingFrame } from "@/components/marketing/marketing-frame";
import { ConnectorsGallery } from "@/components/marketing/connectors-gallery";

export const metadata: Metadata = {
  title: "Integrations — Kismet",
  description: "Search Kismet's integrations. Connect them once and Kismet already has the company context.",
};

export default function IntegrationsPage() {
  return (
    <MarketingFrame>
      <main>
        <ConnectorsGallery />
      </main>
    </MarketingFrame>
  );
}
