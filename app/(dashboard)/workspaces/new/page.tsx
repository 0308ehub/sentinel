"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const schema = z.object({
  orgName: z.string().min(1, "Organization name required"),
  workspaceName: z.string().min(1, "Workspace name required"),
  description: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function NewWorkspacePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      // Sync user first
      await fetch("/api/users/sync", { method: "POST" });

      // Create org
      const orgRes = await fetch("/api/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.orgName }),
      });
      const orgData = await orgRes.json();
      if (!orgData.ok) throw new Error(orgData.error?.message ?? "Failed to create organization");

      // Create workspace
      const wsRes = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgData.data.id,
          name: data.workspaceName,
          description: data.description,
        }),
      });
      const wsData = await wsRes.json();
      if (!wsData.ok) throw new Error(wsData.error?.message ?? "Failed to create workspace");

      toast.success("Workspace created!");
      router.push(`/workspaces/${wsData.data.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-lg">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Create a workspace</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workspace details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Organization name</label>
              <Input {...register("orgName")} placeholder="Acme Inc." />
              {errors.orgName && <p className="text-xs text-red-500">{errors.orgName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Workspace name</label>
              <Input {...register("workspaceName")} placeholder="Analytics Dashboard" />
              {errors.workspaceName && <p className="text-xs text-red-500">{errors.workspaceName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Description <span className="text-gray-400 font-normal">(optional)</span></label>
              <Textarea {...register("description")} placeholder="What product area is this workspace for?" rows={3} />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {loading ? "Creating…" : "Create workspace"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
