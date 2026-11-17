"use client";

import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export function ReportProblem({
  children,
  open: controlledOpen,
  onOpenChange,
}: {
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const [localOpen, setLocalOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);
  const open = controlledOpen ?? localOpen;

  function changeOpen(next: boolean) {
    if (controlledOpen === undefined) setLocalOpen(next);
    onOpenChange?.(next);
    if (!next) setStatus("");
  }

  async function submit() {
    setSending(true);
    setStatus("");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, page: pathname }),
      });
      if (!response.ok) {
        setStatus((await response.text()) || "Could not send feedback.");
        return;
      }
      setMessage("");
      setStatus("Thanks — this goes straight to the Kismet team.");
    } catch {
      setStatus("Could not send feedback.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent>
        <div>
          <h2 className="text-sm font-semibold">Report a problem</h2>
          <p className="mt-1 text-xs text-muted-foreground">Tell the Kismet team what went wrong.</p>
        </div>
        <Textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="What happened? What did you expect?"
          minLength={10}
          maxLength={2000}
          rows={6}
          autoFocus
        />
        {status && <p className="text-xs text-muted-foreground" role="status">{status}</p>}
        <div className="flex justify-end">
          <Button type="button" onClick={() => void submit()} disabled={sending || message.trim().length < 10}>
            {sending ? "Sending…" : "Send"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
