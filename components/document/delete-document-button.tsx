"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DeleteDocumentButton({ documentId }: { documentId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/documents/${documentId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Document deleted");
      router.refresh();
    } catch {
      toast.error("Failed to delete document");
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  };

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500">Delete?</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleDelete}
          disabled={loading}
          className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          {loading ? "…" : "Yes"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setConfirming(false)}
          disabled={loading}
          className="h-7 px-2 text-xs text-gray-500"
        >
          No
        </Button>
      </div>
    );
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => setConfirming(true)}
      title="Delete document"
      className="h-7 w-7 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}
