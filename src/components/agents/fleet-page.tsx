"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

const FleetView = dynamic(() => import("./fleet-view").then((mod) => mod.FleetView), { ssr: false });

export function FleetPage() {
  return (
    <Suspense fallback={null}>
      <FleetView />
    </Suspense>
  );
}
