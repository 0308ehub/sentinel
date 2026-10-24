import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/marketing/brand-logo";
import { ConnectorsGallery } from "@/components/marketing/connectors-gallery";

export const metadata: Metadata = {
  title: "Connectors — Kismet",
  description: "The tools Kismet can read from the company you already run.",
};

export default function ConnectorsPage() {
  return (
    <div className="force-light min-h-screen bg-white px-6 py-8 text-[#111] md:px-12 md:py-10">
      <div className="flex items-center justify-between">
        <Link href="/" className="inline-flex text-[#111]">
          <BrandLogo className="h-8" />
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/sign-in" className="hover:underline">
            Sign in
          </Link>
          <Link href="/contact" className="hover:underline">
            Talk to us
          </Link>
        </div>
      </div>
      <ConnectorsGallery />
    </div>
  );
}
