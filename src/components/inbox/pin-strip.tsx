"use client";
/* eslint-disable react-hooks/refs -- Drag ordering needs the latest rendered list and active pointer id before pointer-up. */

import { useEffect, useRef, useState } from "react";
import { ThreadFaces } from "@/components/inbox/thread-faces";
import { cn } from "@/lib/utils";
import type { InboxThread } from "@/lib/inbox/types";

export function PinStrip({
  threads,
  selected,
  onSelect,
  onReorder,
}: {
  threads: InboxThread[];
  selected: string | null;
  onSelect: (id: string) => void;
  onReorder: (ids: string[]) => void;
}) {
  const [items, setItems] = useState(threads);
  const itemsRef = useRef(threads);
  const drag = useRef<{ id: string; moved: boolean } | null>(null);
  const row = useRef<HTMLDivElement>(null);
  itemsRef.current = items;

  useEffect(() => {
    if (!drag.current) setItems(threads);
  }, [threads]);

  function reorder(id: string, clientX: number) {
    const buttons = row.current?.querySelectorAll<HTMLButtonElement>("[data-pin]") ?? [];
    const over = [...buttons].find((button) => {
      if (button.dataset.pin === id) return false;
      const box = button.getBoundingClientRect();
      return clientX > box.left && clientX < box.right;
    });
    const target = over?.dataset.pin;
    if (!target) return;
    setItems((current) => {
      const next = [...current];
      const from = next.findIndex((item) => item.id === id);
      const to = next.findIndex((item) => item.id === target);
      if (from < 0 || to < 0 || from === to) return current;
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item!);
      return next;
    });
  }

  return (
    <div ref={row} className="flex gap-4 overflow-x-auto px-4 py-3">
      {items.map((thread) => (
        <button
          key={thread.id}
          type="button"
          data-pin={thread.id}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            drag.current = { id: thread.id, moved: false };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!drag.current || drag.current.id !== thread.id || event.buttons === 0) return;
            if (Math.abs(event.movementX) + Math.abs(event.movementY) > 4) drag.current.moved = true;
            if (drag.current.moved) reorder(thread.id, event.clientX);
          }}
          onPointerUp={() => {
            const current = drag.current;
            drag.current = null;
            if (!current || current.id !== thread.id) return;
            const latest = itemsRef.current;
            if (!current.moved) onSelect(thread.id);
            else if (latest.some((item, index) => threads[index]?.id !== item.id)) onReorder(latest.map((item) => item.id));
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
          className={cn("flex w-16 shrink-0 cursor-grab flex-col items-center gap-1 active:cursor-grabbing", drag.current?.id === thread.id && "scale-105")}
        >
          <ThreadFaces thread={thread} size={52} selected={selected === thread.id} />
          <span className={cn("w-full truncate text-center text-[11px] text-[#3a3a3c]", selected === thread.id && "font-medium")}>{thread.title}</span>
          {selected === thread.id && <span className="sr-only">Selected</span>}
        </button>
      ))}
    </div>
  );
}
