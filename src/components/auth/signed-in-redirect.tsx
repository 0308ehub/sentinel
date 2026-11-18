"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "@/lib/auth/use-account";
import { destinationAfterSignIn } from "@/lib/onboarding";

/** The marketing page stays public. A session that lands here still has to leave it. */
export function SignedInRedirect() {
  const account = useAccount();
  const router = useRouter();

  useEffect(() => {
    if (!account) return;
    router.replace(destinationAfterSignIn());
  }, [account, router]);

  return null;
}
