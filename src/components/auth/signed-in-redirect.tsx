"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "@/lib/auth/use-account";
import { SIGN_IN_DESTINATION } from "@/lib/auth/destinations";

/** The marketing page stays public. A session that lands here opens the workspace. */
export function SignedInRedirect() {
  const account = useAccount();
  const router = useRouter();

  useEffect(() => {
    if (!account) return;
    router.replace(SIGN_IN_DESTINATION);
  }, [account, router]);

  return null;
}
