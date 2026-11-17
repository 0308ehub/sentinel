import type { Metadata } from "next";

/** Signed-in pages. Search engines are told not to index them. */
export function privatePage(title: string, description: string): Metadata {
  return {
    title: `${title} — Kismet`,
    description,
    robots: { index: false, follow: false },
  };
}
