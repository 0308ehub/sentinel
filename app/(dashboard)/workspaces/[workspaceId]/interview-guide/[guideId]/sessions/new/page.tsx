"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, UserPlus } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function NewSessionPage({
  params,
}: {
  params: Promise<{ workspaceId: string; guideId: string }>;
}) {
  const { workspaceId, guideId } = use(params);
  const router = useRouter();
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error("Interviewee name is required."); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/interview-guide/${guideId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intervieweeName: name.trim(), intervieweeRole: role.trim() || undefined, intervieweeCompany: company.trim() || undefined, date: new Date(date).toISOString() }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error?.message ?? "Failed");
      toast.success("Session created");
      router.push(`/workspaces/${workspaceId}/interview-guide/${guideId}/sessions/${data.data.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create session");
    } finally { setLoading(false); }
  }

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="flex items-center gap-3 px-8 py-5 border-b border-border bg-card">
        <Link href={`/workspaces/${workspaceId}/interview-guide/${guideId}`}>
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Back</Button>
        </Link>
        <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-indigo-500" /> New Interview Session
        </h1>
      </div>
      <div className="p-8 max-w-lg">
        <form onSubmit={handleSubmit} className="bg-card rounded-xl border border-border p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Interviewee Name <span className="text-red-400">*</span></label>
            <input autoFocus type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sarah Chen"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Role</label>
              <input type="text" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Product Manager"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Company</label>
              <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Corp"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <Button type="submit" disabled={loading} className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</> : <><UserPlus className="h-4 w-4" /> Start Session</>}
          </Button>
        </form>
      </div>
    </div>
  );
}
