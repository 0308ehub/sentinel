"use client";

import { useParams } from "next/navigation";
import { WorkDetail } from "@/components/work/work-detail";

export function ExperimentDetail() {
  const params = useParams();
  const experimentId = typeof params.id === "string" ? params.id : "";
  return <WorkDetail nodeId={experimentId} backHref="/experiments" backLabel="Experiments" />;
}
