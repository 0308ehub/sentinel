"use client";

import { useRef } from "react";
import { BrandLogo } from "@/components/marketing/brand-logo";

const DOTS = [
  { top: "14%", left: "16%", delay: "0s" },
  { top: "20%", left: "78%", delay: "0.6s" },
  { top: "36%", left: "10%", delay: "1.2s" },
  { top: "72%", left: "18%", delay: "0.3s" },
  { top: "80%", left: "70%", delay: "1.7s" },
  { top: "28%", left: "88%", delay: "2.1s" },
  { top: "62%", left: "90%", delay: "0.9s" },
  { top: "88%", left: "40%", delay: "1.4s" },
];

export function PixelStage() {
  const invert = useRef<HTMLDivElement>(null);

  function move(event: React.MouseEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    const layer = invert.current;
    if (!layer) return;
    const mask = `radial-gradient(128px circle at ${x}px ${y}px, #000 34%, transparent 72%)`;
    layer.style.opacity = "1";
    layer.style.maskImage = mask;
    layer.style.webkitMaskImage = mask;
  }

  function leave() {
    if (invert.current) invert.current.style.opacity = "0";
  }

  return (
    <div
      onMouseMove={move}
      onMouseLeave={leave}
      className="relative aspect-square w-full overflow-hidden border border-[#eceef1] bg-white"
    >
      <div className="pixel-grid absolute inset-0" />
      <div className="pixel-scan pointer-events-none absolute inset-x-0" />
      <div
        ref={invert}
        className="pixel-invert pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200"
      />
      {DOTS.map((dot) => (
        <span
          key={`${dot.top}-${dot.left}`}
          className="pixel-dot pointer-events-none absolute"
          style={{ top: dot.top, left: dot.left, animationDelay: dot.delay }}
        />
      ))}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <BrandLogo priority className="logo-drift h-24" />
      </div>
    </div>
  );
}
