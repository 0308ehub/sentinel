"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/marketing/brand-logo";
import { PrdStory } from "@/components/prd/prd-story";
import { livingFromShare, type PrdShare } from "@/lib/prd/document";
import { graphStore } from "@/lib/graph/graph-store";
import { useUIStore } from "@/stores/ui-store";
import { clearSharedPrd, rememberSharedPrd } from "@/components/prd/living-prd";

export function SharedPrd({ share, token }: { share: PrdShare; token: string }) {
  const router = useRouter();
  const productId = useUIStore((state) => state.activeProductId);

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
