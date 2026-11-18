"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { destinationAfterSignIn } from "@/lib/onboarding";

export function EnterGate() {
  const router = useRouter();

  useEffect(() => {
    router.replace(destinationAfterSignIn());
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f6f8] text-sm text-[#5c6570]">
      Opening Kismet…
    </div>
  );
}
