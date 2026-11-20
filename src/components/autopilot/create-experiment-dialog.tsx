"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { BuilderMenu, useAccountBuilder } from "@/components/autopilot/builder-menu";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { Builder } from "@/lib/autopilot/builders";

export function CreateExperimentDialog({
  open,
  busy,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: { title: string; change: string; page: string; builder: Builder }) => Promise<void>;
}) {
  const accountBuilder = useAccountBuilder();
  const [title, setTitle] = useState("");
  const [change, setChange] = useState("");
  const [page, setPage] = useState("");
  const [picked, setPicked] = useState<Builder | null>(null);
  const [error, setError] = useState("");
  const builder = picked ?? accountBuilder;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await onCreate({ title: title.trim(), change: change.trim(), page: page.trim(), builder });
      setTitle("");
      setChange("");
      setPage("");
      setPicked(null);
      onOpenChange(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create the experiment.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 p-0">
        <form onSubmit={(event) => void submit(event)}>
          <div className="border-b border-[#eef0f3] px-5 py-4">
            <h2 className="text-base font-medium text-[#111]">Create experiment</h2>
          </div>
          <div className="space-y-4 px-5 py-4">
            <label className="block text-sm">
              <span className="text-[#374151]">Name</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Homepage banner" className="mt-1 h-9 w-full rounded-md border border-[#e1e4e8] px-3 text-sm outline-none focus:border-[#111]" />
            </label>
            <label className="block text-sm">
              <span className="text-[#374151]">What should change</span>
              <textarea value={change} onChange={(event) => setChange(event.target.value)} required rows={4} placeholder="Showing items you may like on the homepage banner will increase purchases" className="mt-1 w-full resize-none rounded-md border border-[#e1e4e8] px-3 py-2 text-sm outline-none focus:border-[#111]" />
            </label>
            <BuilderMenu value={builder} onChange={setPicked} />
            <label className="block text-sm">
              <span className="text-[#6b7280]">Page, if you know it</span>
              <input value={page} onChange={(event) => setPage(event.target.value)} placeholder="/home" className="mt-1 h-9 w-full rounded-md border border-[#e1e4e8] px-3 text-sm outline-none focus:border-[#111]" />
            </label>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <div className="flex justify-end gap-2 border-t border-[#eef0f3] px-5 py-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" className="bg-[#111] text-white hover:bg-[#2a2a2a]" disabled={busy || change.trim().length < 8}>
              {busy && <Loader2 className="animate-spin" />}
              Create experiment
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
