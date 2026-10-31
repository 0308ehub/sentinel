"use client";

import { useParams } from "next/navigation";
import { useGraphHydrated, useGraphStore } from "@/lib/graph/graph-store";
import { LivingPrd } from "@/components/prd/living-prd";
import { WorkDetail } from "@/components/work/work-detail";

export function FeatureWorkspaceView() {
  const params = useParams();
  const featureId = typeof params.id === "string" ? params.id : "";
  const hydrated = useGraphHydrated();
  const type = useGraphStore((state) => state.nodes.find((node) => node.id === featureId)?.type);
  if (!hydrated) return <div className="h-full bg-background" />;
  if (type === "FEATURE") return <LivingPrd featureId={featureId} />;
  return <WorkDetail nodeId={featureId} backHref="/features" backLabel="Features" />;
}
