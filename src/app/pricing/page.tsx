import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/marketing/placeholder-page";

export const metadata: Metadata = {
  title: "Pricing — Kismet",
  description: "Kismet pricing is not published yet.",
};

export default function PricingPage() {
  return (
    <PlaceholderPage
      title="Pricing"
      lede="Pricing is not published yet. Request a demo and we will walk through it with your team."
      action={{ href: "/contact", label: "Request a demo" }}
    />
  );
}
