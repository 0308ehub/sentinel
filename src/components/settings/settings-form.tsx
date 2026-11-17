"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Switch } from "@/components/ui/switch";

export function useSavedFlag() {
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(false), 2000);
    return () => window.clearTimeout(timer);
  }, [saved]);
  return [saved, () => setSaved(true)] as const;
}

export function Saved({ show }: { show: boolean }) {
  return show ? <span className="text-xs text-muted-foreground">Saved</span> : null;
}

export function ToggleRow({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={title} />
    </div>
  );
}

export function Choice({
  selected,
  title,
  description,
  onSelect,
}: {
  selected: boolean;
  title: string;
  description: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-md border px-3 py-2.5 text-left ${
        selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
      }`}
    >
      <span className="text-sm font-medium">{title}</span>
      <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
    </button>
  );
}

export function SectionNote({ children }: { children: ReactNode }) {
  return <p className="text-xs leading-relaxed text-muted-foreground">{children}</p>;
}

export const fieldClass = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";
