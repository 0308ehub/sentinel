"use client";

import { useMemo, useState, type FormEvent } from "react";
import Image from "next/image";
import { Search } from "lucide-react";
import { CONNECTOR_CATEGORIES, CONNECTORS } from "@/lib/connectors/catalog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function ConnectorsGallery() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const items = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return CONNECTORS.filter((connector) => {
      if (selected.length > 0 && !selected.includes(connector.category)) return false;
      if (!needle) return true;
      return (
        connector.name.toLowerCase().includes(needle) ||
        connector.description.toLowerCase().includes(needle)
      );
    });
  }, [query, selected]);

  function toggle(name: string, on: boolean) {
    setSelected((current) => (on ? [...current, name] : current.filter((item) => item !== name)));
  }

  return (
    <div className="mx-auto max-w-[1100px] px-6 pb-24 pt-16 md:px-8 md:pt-20">
      <h1 className="max-w-[16em] text-[clamp(2.1rem,4.4vw,3.5rem)] font-medium leading-[1.08] tracking-[-0.045em] text-[#111]">
        <span className="text-[#2f6b45]">Kismet</span>
        {" "}
        knows your company&apos;s context.
      </h1>
      <p className="mt-5 max-w-[38em] text-base leading-relaxed text-[#3f3f3f] md:text-lg">
        Search <span className="text-[#2f6b45]">Kismet&apos;s</span> over {CONNECTORS.length} integrations.
      </p>

      <div className="mt-14 flex flex-col gap-10 md:flex-row md:gap-12">
        <nav className="shrink-0 md:w-44" aria-label="Integration categories">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.04em] text-[#8a8a8a]">Categories</p>
          <ul className="space-y-0.5">
            {CONNECTOR_CATEGORIES.filter((name) => CONNECTORS.some((connector) => connector.category === name)).map((name) => {
              const checked = selected.includes(name);
              const id = `integration-category-${name}`;
              return (
                <li key={name}>
                  <label
                    htmlFor={id}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-[13.5px] leading-snug",
                      checked ? "text-[#111]" : "text-[#4a4a4a] hover:text-[#111]",
                    )}
                  >
                    <Checkbox
                      id={id}
                      checked={checked}
                      onCheckedChange={(value) => toggle(name, value === true)}
                    />
                    {name}
                  </label>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0 flex-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a9a9a]" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search integrations…"
              aria-label="Search integrations"
              className="h-10 w-full rounded-lg border border-[#e6e6e3] bg-white pl-9 pr-3 text-sm text-[#111] placeholder:text-[#9a9a9a] outline-none focus-visible:ring-2 focus-visible:ring-[#111]"
            />
          </div>
          <p className="mt-3 text-[13px] text-[#8a8a8a]">
            {items.length} {items.length === 1 ? "integration" : "integrations"}
          </p>

          {items.length === 0 ? (
            <p className="mt-10 text-sm text-[#6b6b6b]">No integrations match that search.</p>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              {items.map((connector) => (
                <article
                  key={connector.id}
                  className="rounded-xl border border-[#ecece8] bg-white px-5 py-5"
                >
                  <div className="flex h-8 w-8 items-center justify-center">
                    {connector.logo ? (
                      <Image
                        src={connector.logo}
                        alt=""
                        width={28}
                        height={28}
                        className="h-7 w-7 object-contain"
                        unoptimized
                      />
                    ) : (
                      <span className="text-sm font-medium text-[#111]">{connector.name.slice(0, 1)}</span>
                    )}
                  </div>
                  <h2 className="mt-4 text-[15px] font-medium text-[#111]">{connector.name}</h2>
                  <p className="mt-1 text-[13px] leading-relaxed text-[#6b6b6b]">{connector.description}</p>
                </article>
              ))}
            </div>
          )}

          <div className="mt-8">
            <RequestIntegration />
          </div>
        </div>
      </div>
    </div>
  );
}

const REQUEST_SUGGESTIONS = ["Postgres / database", "Granola", "Google Calendar", "Sentry", "Dropbox", "Linear", "Pylon"];

function RequestIntegration() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) setStatus("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setStatus("");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: `Integration request: ${name.trim()}`, page: "/integrations" }),
      });
      if (!response.ok) {
        setStatus((await response.text()) || "Could not send request.");
        return;
      }
      setName("");
      setStatus("Thanks — this goes straight to the Kismet team.");
    } catch {
      setStatus("Could not send request.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">Request an integration</Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={(event) => void submit(event)} className="grid gap-4">
          <div>
            <h2 className="text-sm font-semibold">Request an integration</h2>
            <p className="mt-1 text-xs text-muted-foreground">Tell us which tool or data source Kismet should connect to.</p>
          </div>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Tool name"
            aria-label="Tool name"
            maxLength={200}
            autoFocus
          />
          <div className="flex flex-wrap gap-1.5">
            {REQUEST_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setName(suggestion)}
                className="rounded-full border border-[#e6e6e3] px-2.5 py-1 text-xs text-[#4a4a4a] hover:text-[#111]"
              >
                {suggestion}
              </button>
            ))}
          </div>
          {status && <p className="text-xs text-muted-foreground" role="status">{status}</p>}
          <div className="flex justify-end">
            <Button type="submit" disabled={sending || name.trim().length === 0}>
              {sending ? "Sending…" : "Send request"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
