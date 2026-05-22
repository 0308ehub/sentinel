"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Loader2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface CatalogEntry {
  type: string;
  name: string;
  description: string;
  icon: string;
  authType: "oauth" | "apikey";
  color: string;
  fields?: { key: string; label: string; type: string; placeholder: string }[];
}

export function ConnectModal({
  catalog,
  workspaceId,
}: {
  catalog: CatalogEntry;
  workspaceId: string;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleConnect() {
    setError("");
    setLoading(true);

    try {
      if (catalog.authType === "oauth") {
        // Redirect to OAuth flow
        window.location.href = `/api/auth/${catalog.type.toLowerCase()}?workspaceId=${workspaceId}`;
        return;
      }

      // API key: build config from fields
      const config: Record<string, unknown> = {};
      for (const field of catalog.fields ?? []) {
        const val = values[field.key]?.trim();
        if (!val && !field.label.toLowerCase().includes("optional")) {
          setError(`${field.label} is required`);
          setLoading(false);
          return;
        }
        if (field.key === "projectKeys" && val) {
          config[field.key] = val.split(",").map((s) => s.trim());
        } else {
          config[field.key] = val;
        }
      }

      const res = await fetch(`/api/workspaces/${workspaceId}/connectors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: catalog.type, name: catalog.name, config }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error?.message ?? "Failed to connect");

      setExpanded(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className={cn("border transition-all", catalog.color, expanded && "ring-2 ring-violet-400")}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{catalog.icon}</span>
            <div>
              <p className="font-semibold text-gray-900 text-sm">{catalog.name}</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-snug">{catalog.description}</p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {!expanded ? (
          <Button
            size="sm"
            onClick={() => setExpanded(true)}
            variant="outline"
            className="w-full gap-1.5 text-xs border-gray-200 text-gray-700 hover:border-violet-300 hover:text-violet-700"
          >
            <Plus className="h-3 w-3" />
            Connect
          </Button>
        ) : (
          <div className="space-y-3">
            {catalog.authType === "oauth" ? (
              <p className="text-xs text-gray-600 bg-white/80 rounded p-2 border border-gray-100">
                You&apos;ll be redirected to {catalog.name} to authorize Sentinel. Make sure you have
                {catalog.type === "GMAIL"
                  ? " GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET"
                  : " SLACK_CLIENT_ID and SLACK_CLIENT_SECRET"}{" "}
                set in your .env.local.
              </p>
            ) : (
              catalog.fields?.map((field) => (
                <div key={field.key} className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">{field.label}</label>
                  <Input
                    type={field.type}
                    placeholder={field.placeholder}
                    value={values[field.key] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                    className="text-xs h-8"
                  />
                </div>
              ))
            )}

            {error && <p className="text-xs text-red-600">{error}</p>}

            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleConnect}
                disabled={loading}
                className="flex-1 gap-1.5 text-xs bg-violet-600 hover:bg-violet-700 text-white"
              >
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                {catalog.authType === "oauth" ? `Connect with ${catalog.name}` : "Save & Connect"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setExpanded(false); setError(""); }}
                className="text-xs px-2"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
