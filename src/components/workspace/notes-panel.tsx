"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";

interface Note {
  id: string;
  title: string;
  body: string;
  at: string;
}

export function WorkspaceNotes() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancel = false;
    void fetch("/api/workspace")
      .then(async (response) => {
        if (!response.ok) return;
        const data = (await response.json()) as { configured?: boolean; notes?: Note[] };
        if (cancel) return;
        setConfigured(Boolean(data.configured));
        setNotes(Array.isArray(data.notes) ? data.notes : []);
      })
      .catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, []);

  async function addNote(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "note", title, text }),
      });
      const data = (await response.json()) as { notes?: Note[]; error?: string };
      if (!response.ok) {
        setError(data.error || "The note could not be saved.");
        return;
      }
      setNotes(data.notes ?? []);
      setTitle("");
      setText("");
    } catch {
      setError("The note could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function removeNote(id: string) {
    const response = await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "remove-note", id }),
    });
    if (!response.ok) return;
    const data = (await response.json()) as { notes?: Note[] };
    setNotes(data.notes ?? []);
  }

  return (
    <section>
      <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2">
        <h2 className="text-sm font-medium">Notes</h2>
        <span className="text-xs text-muted-foreground">The chat reads these</span>
      </div>
      {configured === null ? (
        <p className="px-1 py-3 text-sm text-muted-foreground">Loading</p>
      ) : configured === false ? (
        <p className="px-1 py-3 text-sm text-muted-foreground">
          Add the Supabase connection string on the deploy. Notes, the graph, and chat are kept there.
        </p>
      ) : (
        <>
          <form onSubmit={addNote} className="space-y-2 px-1 py-3">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Title"
              maxLength={120}
              className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
            />
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Who it is for, what is missing, or what you learned."
              maxLength={4000}
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <Button type="submit" size="sm" disabled={saving || !title.trim() || !text.trim()}>
              Save note
            </Button>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </form>
          {notes.length === 0 ? (
            <p className="px-1 py-3 text-sm text-muted-foreground">Write what you know about this product.</p>
          ) : (
            notes.map((note) => (
              <div key={note.id} className="flex items-start justify-between gap-4 px-1 py-3">
                <div className="min-w-0">
                  <p className="text-sm">{note.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{note.body}</p>
                </div>
                <button type="button" onClick={() => void removeNote(note.id)} className="shrink-0 text-xs text-muted-foreground hover:text-foreground">
                  Remove
                </button>
              </div>
            ))
          )}
        </>
      )}
    </section>
  );
}
