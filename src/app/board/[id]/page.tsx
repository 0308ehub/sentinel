"use client";

import { useParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { WorkDetail } from "@/components/work/work-detail";

export default function BoardItemPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  return (
    <AppShell>
      <WorkDetail nodeId={id} backHref="/board" backLabel="Board" />
    </AppShell>
  );
}
