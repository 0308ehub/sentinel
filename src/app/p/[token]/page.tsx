import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/marketing/brand-logo";
import { SharedPrd } from "@/components/prd/shared-prd";
import { shareVisible, verifyShare } from "@/lib/prd/share-token";

export const metadata: Metadata = {
  title: "Shared document — Kismet",
  description: "A document shared from a Kismet workspace.",
  robots: { index: false, follow: false },
};

export default async function SharedPrdPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const share = verifyShare(token);
  if (!share) return <ShareNotice title="This link does not open a PRD" />;

  const access = await shareVisible(share);
  if (access === "expired") return <ShareNotice title="This link has expired" />;
  if (access === "signin") {
    const next = encodeURIComponent(`/p/${token}`);
    return (
      <ShareNotice title="Sign in to open this PRD" detail="The link is limited to specific email addresses. Sign in with one of them.">
        <Link href={`/sign-in?redirect_url=${next}`} className="mt-4 inline-flex h-8 items-center rounded-md bg-foreground px-3 text-xs text-background">
          Sign in
        </Link>
      </ShareNotice>
    );
  }
  if (access === "denied") return <ShareNotice title="This account cannot open this PRD" detail="Sign in with the email the link was shared to." />;

  return <SharedPrd share={share} token={token} />;
}

function ShareNotice({ title, detail, children }: { title: string; detail?: string; children?: ReactNode }) {
  return (
    <div className="mx-auto mt-24 max-w-md px-6">
      <BrandLogo className="h-7" />
      <h1 className="mt-6 text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{detail ?? "Ask the sender for a new link."}</p>
      {children}
    </div>
  );
}
