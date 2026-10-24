"use client";

import { useSyncExternalStore } from "react";
import { formatRelativeTime } from "@/lib/utils";

function subscribe() {
  return () => {};
}

export function RelativeTime({
  date,
  className,
}: {
  date: Date | string;
  className?: string;
}) {
  const label = useSyncExternalStore(
    subscribe,
    () => formatRelativeTime(date),
    () => ""
  );

  return <span className={className}>{label}</span>;
}
