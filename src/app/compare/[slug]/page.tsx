import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CompareArticle } from "@/components/marketing/compare-view";
import { COMPARISONS, comparisonBySlug } from "@/lib/comparisons";

export function generateStaticParams() {
  return COMPARISONS.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const comparison = comparisonBySlug(slug);
  if (!comparison) return { title: "Compare — Kismet" };
  return {
    title: `Kismet and ${comparison.name} — Kismet`,
    description: comparison.summary,
  };
}

export default async function CompareSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const comparison = comparisonBySlug(slug);
  if (!comparison) notFound();
  return <CompareArticle comparison={comparison} />;
}
