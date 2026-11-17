import type { ReactNode } from "react";

export function SafariFrame({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[10px] bg-white shadow-[0_22px_60px_rgba(16,36,48,0.16)] ring-1 ring-black/10">
      <div className="relative flex h-11 items-center border-b border-[#e4e4e4] bg-[#f3f3f3] px-3.5">
        <div className="flex items-center gap-[7px]" aria-hidden>
          <span className="h-[11px] w-[11px] rounded-full bg-[#ff5f57]" />
          <span className="h-[11px] w-[11px] rounded-full bg-[#febc2e]" />
          <span className="h-[11px] w-[11px] rounded-full bg-[#28c840]" />
        </div>
        <div className="pointer-events-none absolute left-1/2 top-1/2 flex h-[26px] min-w-[168px] w-[min(56%,240px)] -translate-x-1/2 -translate-y-1/2 items-center justify-center whitespace-nowrap rounded-md bg-white text-[13px] font-normal tracking-normal text-[#1d1d1f] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]">
          <span className="sr-only">Address</span>
          usekismetai.com
        </div>
      </div>
      <div className="bg-white">{children}</div>
    </div>
  );
}
