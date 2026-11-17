import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/marketing/placeholder-page";

export const metadata: Metadata = {
  title: "PM Benchmark — Kismet",
  description: "A benchmark for product-management models. Not published yet.",
};

export default function BenchmarkPage() {
  return (
    <PlaceholderPage
      title="PM Benchmark"
      lede="A benchmark for product-management models: how they read a product, write a plan, and call an experiment. We will build this out."
    />
  );
}
