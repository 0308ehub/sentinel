"use client";

import { useParams } from "next/navigation";
import { WorkDetail } from "@/components/work/work-detail";

export function FeatureWorkspaceView() {
  const params = useParams();
  const featureId = typeof params.id === "string" ? params.id : "";
  return <WorkDetail nodeId={featureId} backHref="/features" backLabel="Features" />;
}
