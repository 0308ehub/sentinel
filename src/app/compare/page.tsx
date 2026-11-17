import type { Metadata } from "next";
import { CompareIndex } from "@/components/marketing/compare-view";

export const metadata: Metadata = {
  title: "Compare — Kismet",
  description: "How Kismet compares with Statsig, Glean, Amplitude, and PostHog.",
};

export default function ComparePage() {
  return <CompareIndex />;
}
