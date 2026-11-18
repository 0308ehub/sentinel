"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SIGN_IN_DESTINATION } from "@/lib/auth/destinations";

export function EnterGate() {
  const router = useRouter();

  useEffect(() => {
    router.replace(SIGN_IN_DESTINATION);
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f6f8] text-sm text-[#5c6570]">
      Opening Kismet…
    </div>
  );
}
