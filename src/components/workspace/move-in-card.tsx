"use client";

import { useEffect, useState } from "react";
import { useOrganization } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export function MoveInCard() {
  const { organization } = useOrganization();
  const [eligible, setEligible] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!organization) return;
    void fetch("/api/workspace/move-in", { cache: "no-store" }).then((res) => res.json()).then((body: { eligible?: boolean }) => setEligible(Boolean(body.eligible)));
  }, [organization]);
  if (!organization || !eligible) return null;

  async function act(method: "POST" | "DELETE") {
    setBusy(true);
    const response = await fetch("/api/workspace/move-in", { method });
    if (response.ok) window.location.reload();
    else setBusy(false);
  }

  return (
    <div className="mx-4 mt-4 flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4">
      <div>
        <p className="font-medium">Move your Kismet data into {organization.name}?</p>
        <p className="text-sm text-muted-foreground">Your experiments, connections, settings, and workspace data will become shared. Chat stays private.</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="outline" disabled={busy} onClick={() => void act("DELETE")}>Start empty</Button>
        <Button disabled={busy} onClick={() => void act("POST")}>Move it in</Button>
      </div>
    </div>
  );
}
