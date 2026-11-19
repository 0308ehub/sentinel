"use client";

import { useState } from "react";
import { Check, ChevronDown, Copy } from "lucide-react";

const NPM = "npm install @kismet/sdk";
const BROWSER = 'import { loadKismet } from "@kismet/sdk/browser";';
const SERVER = 'import { kismet } from "@kismet/sdk";';

const TARGETS = [
  { id: "next", label: "Next.js", command: NPM, then: SERVER },
  { id: "react", label: "React", command: NPM, then: BROWSER },
  { id: "vue", label: "Vue", command: NPM, then: BROWSER },
  { id: "svelte", label: "Svelte", command: NPM, then: BROWSER },
  { id: "node", label: "Node.js", command: NPM, then: SERVER },
  {
    id: "html",
    label: "HTML",
    command: '<script async src="https://app.sentinelai.one/kismet.js" data-site="YOUR_SITE_KEY"></script>',
    then: "Paste it into the <head> of every page.",
  },
];

export function SdkInstall() {
  const [id, setId] = useState(TARGETS[0].id);
  const [copied, setCopied] = useState(false);
  const target = TARGETS.find((item) => item.id === id) ?? TARGETS[0];

  async function copy() {
    try {
      await navigator.clipboard.writeText(target.command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <div className="mt-12 max-w-[560px]">
      <p className="text-sm font-medium text-[#111]">Install Kismet in just a few steps:</p>
      <div className="relative mt-3">
        <select
          aria-label="Framework"
          value={id}
          onChange={(event) => {
            setId(event.target.value);
            setCopied(false);
          }}
          className="h-11 w-full cursor-pointer appearance-none rounded-md bg-[#ececec] px-4 pr-10 text-[15px] text-[#111] outline-none focus-visible:ring-2 focus-visible:ring-[#111]/20"
        >
          {TARGETS.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-[#111]" />
      </div>
      <div className="mt-4 flex items-center gap-3 rounded-lg bg-[#1f2329] py-4 pl-5 pr-3">
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-[14px] text-[#f2f2f2]">{target.command}</code>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? "Copied" : "Copy"}
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-[#f2f2f2] hover:bg-white/10"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </button>
      </div>
      <p className="mt-3 font-mono text-[12.5px] text-[#6b6b6b]">{target.then}</p>
    </div>
  );
}
