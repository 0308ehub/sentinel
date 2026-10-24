import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DocProse } from "@/components/marketing/doc-prose";
import { MarketingFrame } from "@/components/marketing/marketing-frame";
import { PRODUCT_DOCS, docBySlug } from "@/lib/product-docs";

export function generateStaticParams() {
  return PRODUCT_DOCS.map((doc) => ({ slug: doc.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const doc = docBySlug(slug);
  if (!doc) return { title: "Documentation — Kismet" };
  return { title: `${doc.title} — Kismet`, description: doc.summary };
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = docBySlug(slug);
  if (!doc) notFound();

  return (
    <MarketingFrame>
      <main className="px-6 pb-16 pt-16 md:px-16 md:pt-20">
        <Link href="/docs" className="text-sm text-[#5c6370] hover:text-[#111]">
          Documentation
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">{doc.title}</h1>
        <p className="mt-3 max-w-2xl text-lg leading-relaxed text-[#3c4250]">{doc.summary}</p>
        <article className="mt-10 max-w-2xl space-y-8 text-[15px] leading-relaxed text-[#3c4250]">
          {doc.sections.map((section) => (
            <section key={section.heading ?? section.paragraphs[0]} className="space-y-3">
              {section.heading && <h2 className="text-lg font-semibold text-[#111]">{section.heading}</h2>}
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>
                  <DocProse text={paragraph} />
                </p>
              ))}
            </section>
          ))}
          {doc.slug === "explore" && (
            <p>
              <Link href="/connectors" className="font-medium text-[#111] underline underline-offset-4">
                See the connectors
              </Link>
            </p>
          )}
        </article>
        <nav className="mt-12 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {PRODUCT_DOCS.filter((item) => item.slug !== doc.slug).map((item) => (
            <Link key={item.slug} href={`/docs/${item.slug}`} className="text-[#5c6370] hover:text-[#111]">
              {item.title}
            </Link>
          ))}
        </nav>
      </main>
    </MarketingFrame>
  );
}
