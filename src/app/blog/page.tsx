import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/marketing/placeholder-page";

export const metadata: Metadata = {
  title: "Blog — Kismet",
  description: "Notes from the Kismet team.",
};

export default function BlogPage() {
  return <PlaceholderPage title="Blog" lede="Notes on product work. Nothing posted yet." />;
}
