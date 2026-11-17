"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function InboxPresence() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    void fetch("/api/inbox/work", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "edit", tz: -new Date().getTimezoneOffset() }),
    });
  }, [pathname]);

  return null;
}
