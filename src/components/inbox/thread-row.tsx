"use client";

import { useEffect, useRef, useState } from "react";
import { ThreadFaces } from "@/components/inbox/thread-faces";
import { cn } from "@/lib/utils";
import type { InboxThread } from "@/lib/inbox/types";

const PIN_W = 74;
const ACTION_W = 78;

export function ThreadRow({
  thread,
  selected,
  revealed,
  onReveal,
  onSelect,
  onPin,
  onMute,
  onTalk,
  onDelete,
  time,
}: {
  thread: InboxThread;
  selected: boolean;
  revealed: boolean;
  onReveal: (id: string | null) => void;
  onSelect: () => void;
  onPin: () => void;
  onMute: () => void;
  onTalk: () => void;
  onDelete: () => void;
  time: string;
}) {
  const direct = thread.kind === "direct";
  const actions = (direct ? 3 : 1) * ACTION_W;
  const [x, setX] = useState(0);
  const xRef = useRef(0);
  const held = useRef(false);
  const start = useRef({ x: 0, origin: 0, dragging: false });
  const agent = thread.agents[0];

  function moveTo(next: number) {
    xRef.current = next;
    setX(next);
  }

  useEffect(() => {
    if (!revealed) moveTo(0);
  }, [revealed]);

  function finish(next: number) {
    if (next <= -actions + 24) {
      onDelete();
      moveTo(0);
      onReveal(null);
      return;
    }
    if (next <= -40) {
      moveTo(-actions);
      onReveal(thread.id);
      return;
    }
    if (next >= 40) {
      onPin();
      moveTo(0);
      onReveal(null);
      return;
    }
    moveTo(0);
    onReveal(null);
  }

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-y-0 left-0 flex" style={{ width: PIN_W }}>
        <Action color="#ff9f0a" label={thread.pinned ? "Unpin" : "Pin"} onClick={onPin} />
      </div>
      <div className="absolute inset-y-0 right-0 flex">
        {direct && <Action color="#8e8e93" label={agent?.muted ? "Unmute" : "Mute"} onClick={onMute} />}
        {direct && <Action color="#2f6bff" label="Talk more" onClick={onTalk} />}
        <Action color="#ff3b30" label="Delete" onClick={onDelete} />
      </div>
      <div
        className="relative flex w-full items-center bg-[#f2f2f6] px-2 py-0.5 text-left"
        style={{ transform: `translateX(${x}px)`, touchAction: "pan-y" }}
        role="button"
        tabIndex={0}
        aria-label={thread.title}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          held.current = true;
          start.current = { x: event.clientX, origin: xRef.current, dragging: false };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!held.current || event.buttons === 0) return;
          const delta = event.clientX - start.current.x;
          if (Math.abs(delta) < 8 && !start.current.dragging) return;
          start.current.dragging = true;
          onReveal(thread.id);
          moveTo(Math.max(-actions - 12, Math.min(PIN_W, start.current.origin + delta)));
        }}
        onPointerUp={() => {
          if (!held.current) return;
          held.current = false;
          if (!start.current.dragging) {
            if (xRef.current !== 0) {
              moveTo(0);
              onReveal(null);
            } else onSelect();
            return;
          }
          finish(xRef.current);
        }}
        onPointerCancel={() => {
          held.current = false;
          start.current.dragging = false;
          moveTo(0);
          onReveal(null);
        }}
      >
        <span className={cn("flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2 py-1.5", selected ? "bg-[#d8d8de]" : "hover:bg-black/[0.04]")}>
        <ThreadFaces thread={thread} size={40} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className={cn("truncate text-sm", thread.unread > 0 && "font-semibold")}>{thread.title}</span>
            <span className="shrink-0 text-[11px] text-muted-foreground">{time}</span>
          </span>
          <span className="mt-0.5 flex items-center gap-2">
            <span className="truncate text-xs text-muted-foreground">{thread.preview}</span>
            {thread.unread > 0 && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#007aff]" />}
          </span>
        </span>
        </span>
      </div>
    </div>
  );
}

function Action({ color, label, onClick }: { color: string; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="grid h-full place-items-center px-2 text-[11px] font-medium text-white" style={{ width: ACTION_W, background: color }}>
      {label}
    </button>
  );
}
