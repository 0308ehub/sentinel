import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DocProse } from "@/components/marketing/doc-prose";
import { DocsShell } from "@/components/marketing/docs-shell";
import { docBySlug, docNeighbors, PRODUCT_DOCS } from "@/lib/product-docs";

export function generateStaticParams() {
  return PRODUCT_DOCS.map((doc) => ({ slug: doc.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const doc = docBySlug(slug);
  if (!doc) return { title: "Docs — Kismet" };
  return { title: `${doc.title} — Kismet Docs`, description: doc.summary };
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = docBySlug(slug);
  if (!doc) notFound();

  const href = `/docs/${doc.slug}`;
  const { prev, next } = docNeighbors(href);

  return (
    <DocsShell
      current={href}
      toc={doc.sections.map((section) => ({ id: section.id, label: section.heading }))}
    >
      <p className="text-sm text-[#6a717c]">
        <Link href="/docs" className="hover:text-[#111]">
          Docs
        </Link>
        <span className="px-1.5">/</span>
        <span className="text-[#111]">{doc.title}</span>
      </p>
      <h1 className="mt-3 text-[2rem] font-semibold leading-[1.15] tracking-[-0.03em] text-[#111]">{doc.title}</h1>
      <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-[#3c4250]">{doc.summary}</p>

      <article className="mt-10 max-w-2xl space-y-10 text-[15px] leading-relaxed text-[#3c4250]">
        {doc.sections.map((section) => (
          <section key={section.id} className="scroll-mt-20 space-y-3">
            <h2 id={section.id} className="text-xl font-semibold tracking-[-0.02em] text-[#111]">
              {section.heading}
            </h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>
                <DocProse text={paragraph} />
              </p>
            ))}
            {section.bullets && (
              <ul className="list-disc space-y-1.5 pl-5">
                {section.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </article>

      <nav className="mt-14 grid gap-3 border-t border-[#eceef1] pt-6 sm:grid-cols-2">
        {prev ? (
          <Link href={prev.href} className="rounded-lg border border-[#eceef1] px-4 py-3 hover:border-[#cfd3d8]">
            <span className="block text-xs text-[#6a717c]">Previous</span>
            <span className="mt-1 block text-sm font-medium text-[#111]">{prev.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link href={next.href} className="rounded-lg border border-[#eceef1] px-4 py-3 text-right hover:border-[#cfd3d8]">
            <span className="block text-xs text-[#6a717c]">Next</span>
            <span className="mt-1 block text-sm font-medium text-[#111]">{next.title}</span>
          </Link>
        )}
      </nav>
    </DocsShell>
  );
}
