"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function WorkspaceNameEditor({
  workspaceId,
  initialName,
}: {
  workspaceId: string;
  initialName: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (trimmed === initialName) { setEditing(false); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error("Update failed");
      toast.success("Workspace renamed");
      setEditing(false);
      router.refresh();
    } catch {
      toast.error("Failed to rename workspace");
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") { setName(initialName); setEditing(false); }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={saving}
          className="text-xl font-bold text-gray-900 border-b-2 border-violet-400 bg-transparent focus:outline-none w-64"
        />
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="p-1 rounded text-violet-600 hover:bg-violet-50 disabled:opacity-40 transition-colors"
          title="Save"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        </button>
        <button
          onClick={() => { setName(initialName); setEditing(false); }}
          disabled={saving}
          className="p-1 rounded text-gray-400 hover:bg-gray-100 transition-colors"
          title="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-2">
      <h1 className="text-xl font-bold text-gray-900">{initialName}</h1>
      <button
        onClick={() => setEditing(true)}
        className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
        title="Rename workspace"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
