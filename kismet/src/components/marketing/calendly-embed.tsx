"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";

interface CalendlyApi {
  initInlineWidget: (options: { url: string; parentElement: HTMLElement }) => void;
}

declare global {
  interface Window {
    Calendly?: CalendlyApi;
  }
}

function pageHeight(data: unknown): number | null {
  if (!data || typeof data !== "object") return null;
  const record = data as { event?: unknown; payload?: { height?: unknown } };
  if (record.event !== "calendly.page_height") return null;
  const height = record.payload?.height;
  const value = typeof height === "number" ? height : typeof height === "string" ? Number.parseFloat(height) : NaN;
  if (!Number.isFinite(value)) return null;
  return Math.min(Math.max(value, 280), 2200);
}

export function CalendlyEmbed({ url }: { url: string }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const urlRef = useRef(url);
  urlRef.current = url;

  function mount() {
    const parent = parentRef.current;
    if (!parent || !window.Calendly) return;
    if (parent.querySelector("iframe")) return;
    window.Calendly.initInlineWidget({ url: urlRef.current, parentElement: parent });
    const iframe = parent.querySelector("iframe");
    if (iframe instanceof HTMLIFrameElement) {
      iframe.style.display = "block";
      iframe.style.width = "100%";
      iframe.style.height = "100%";
      iframe.style.border = "0";
    }
  }

  useEffect(() => {
    const parent = parentRef.current;
    if (parent) parent.replaceChildren();

    function onMessage(event: MessageEvent) {
      if (event.origin !== "https://calendly.com") return;
      const height = pageHeight(event.data);
      const node = parentRef.current;
      if (height == null || !node) return;
      node.style.height = `${Math.ceil(height)}px`;
    }

    window.addEventListener("message", onMessage);
    mount();
    return () => window.removeEventListener("message", onMessage);
  }, [url]);

  return (
    <>
      <div ref={parentRef} className="w-full" style={{ minWidth: 320, height: 720 }} />
      <Script src="https://assets.calendly.com/assets/external/widget.js" strategy="afterInteractive" onLoad={mount} />
    </>
  );
}
