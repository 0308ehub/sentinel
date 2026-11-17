import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/marketing/placeholder-page";

export const metadata: Metadata = {
  title: "Enterprise — Kismet",
  description: "Kismet for larger product teams.",
};

export default function EnterprisePage() {
  return (
    <PlaceholderPage
      title="Enterprise"
      lede="Kismet for a larger product org. Security, rollout, and a person to talk it through with."
      action={{ href: "/contact", label: "Request a demo" }}
    />
  );
}
