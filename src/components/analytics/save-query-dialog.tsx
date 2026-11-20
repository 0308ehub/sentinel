"use client";

import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

interface SaveQueryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName: string;
  onSave: (name: string) => void;
  isUpdate?: boolean;
}

export function SaveQueryDialog({
  open,
  onOpenChange,
  defaultName,
  onSave,
  isUpdate,
}: SaveQueryDialogProps) {
  const [draft, setDraft] = useState({ open, defaultName, name: defaultName });
  if (draft.open !== open || (open && draft.defaultName !== defaultName)) {
    setDraft({ open, defaultName, name: defaultName });
  }
  const name = draft.open === open && draft.defaultName === defaultName ? draft.name : defaultName;
  const setName = (value: string) => setDraft({ open, defaultName, name: value });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <h2 className="text-sm font-semibold">
          {isUpdate ? "Update notebook" : "Save notebook"}
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Name this evidence notebook so you can reopen it from the sidebar.
        </p>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            onSave(name.trim());
            onOpenChange(false);
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="notebook-name">Notebook name</Label>
            <Input
              id="notebook-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Notebook name"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              {isUpdate ? "Update" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
