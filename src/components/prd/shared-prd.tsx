"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { BrandLogo } from "@/components/marketing/brand-logo";
import { PrdStory, ShareGate } from "@/components/prd/prd-story";
import { decodeShare, emailAllowed, livingFromShare } from "@/lib/prd/document";
import { graphStore } from "@/lib/graph/graph-store";
import { useUIStore } from "@/stores/ui-store";
import { clearSharedPrd, rememberSharedPrd } from "@/components/prd/living-prd";

export function SharedPrd() {
  const params = useParams();
  const router = useRouter();
  const token = typeof params.token === "string" ? params.token : "";
  const share = decodeShare(token);
  const productId = useUIStore((state) => state.activeProductId);
  const [email, setEmail] = useState("");
  const [gateError, setGateError] = useState("");
  const allowed = share ? share.audience === "anyone" || emailAllowed(share, email) : false;

  function tryEmail(value: string) {
    if (!share) return;
    if (emailAllowed(share, value)) {
      setGateError("");
      setEmail(value);
      return;
    }
    setGateError(share.audience === "domain" ? `Use an @${share.domain} email.` : "That email is not on the list.");
  }

  if (!share) {
    return (
      <div className="mx-auto mt-24 max-w-md px-6">
        <BrandLogo className="h-7" />
        <h1 className="mt-6 text-2xl font-semibold">This link does not open a PRD</h1>
        <p className="mt-2 text-sm text-muted-foreground">Ask the sender for a new link.</p>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="min-h-screen bg-background">
        <header className="flex h-14 items-center px-6">
          <BrandLogo className="h-6" />
        </header>
        <ShareGate
          title={share.title}
          detail={
            share.audience === "domain"
              ? `This PRD is shared with anyone at ${share.domain || "the company"}. Confirm your work email to view it.`
              : "This PRD was sent to specific people. Enter the email it was shared to."
          }
          error={gateError}
          onSubmit={tryEmail}
        />
      </div>
    );
  }

  function saveCopy() {
    const id = graphStore.getState().importSharedPrd(share!, productId || "product-workspace");
    clearSharedPrd();
    if (id) router.push(`/features/${id}`);
  }

  function createAccount() {
    rememberSharedPrd(token);
    router.push("/sign-up");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-14 items-center justify-between border-b border-border px-6">
        <Link href="/">
          <BrandLogo className="h-6" />
        </Link>
        <div className="flex items-center gap-2">
          <button type="button" onClick={saveCopy} className="h-8 rounded-md border border-border px-3 text-xs">
            I already use Kismet
          </button>
          <button type="button" onClick={createAccount} className="h-8 rounded-md bg-foreground px-3 text-xs text-background">
            Create an account to edit
          </button>
        </div>
      </header>
      <PrdStory
        editing={false}
        title={share.title}
        doc={livingFromShare(share)}
        evidence={share.evidence.map((item, index) => ({ id: `${item.type}-${index}`, type: item.type, title: item.title, detail: item.detail }))}
        links={share.links.map((item, index) => ({ id: `${item.type}-${index}`, type: item.type, title: item.title, href: "/graph" }))}
        agents={[]}
      />
    </div>
  );
}
