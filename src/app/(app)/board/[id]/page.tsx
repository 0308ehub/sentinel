"use client";

import { useParams } from "next/navigation";
import { WorkDetail } from "@/components/work/work-detail";

export default function BoardItemPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  return (
    <WorkDetail nodeId={id} backHref="/board" backLabel="Board" />
  );
}
