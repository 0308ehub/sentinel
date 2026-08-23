"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export function AddChildForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [age, setAge] = useState("6");
  const [grade, setGrade] = useState("");
  const [interests, setInterests] = useState("");
  const [consent, setConsent] = useState(false);

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        Add a child
      </Button>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) {
      toast.error("Parental consent is required before your child can use Sentinel.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/children", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        ageYears: Number(age),
        gradeLabel: grade || undefined,
        interests: interests
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        consentGranted: true,
      }),
    });
    setSaving(false);
    const body = await res.json();
    if (!body.ok) {
      toast.error(body.error?.message ?? "Could not add child");
      return;
    }
    toast.success(`${name} is ready to meet Nova`);
    setOpen(false);
    setName("");
    setInterests("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border bg-card p-6">
      <h2 className="font-medium">Add a child</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input placeholder="First name" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input
          type="number"
          min={3}
          max={14}
          placeholder="Age"
          value={age}
          onChange={(e) => setAge(e.target.value)}
          required
        />
        <Input placeholder="Grade (optional)" value={grade} onChange={(e) => setGrade(e.target.value)} />
        <Input
          placeholder="Interests, comma separated"
          value={interests}
          onChange={(e) => setInterests(e.target.value)}
        />
      </div>
      <label className="flex items-start gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-1"
        />
        <span>
          I am this child&apos;s parent or guardian and I consent to them using Sentinel. I understand
          I can review all activity and delete their data at any time.
        </span>
      </label>
      <div className="flex gap-2">
        <Button type="submit" disabled={saving || !name || !consent}>
          {saving ? "Adding…" : "Add child"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
