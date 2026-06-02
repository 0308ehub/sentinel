"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Loader2, Plus, X, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConnectorIcon } from "@/components/integrations/ConnectorIcons";

interface CatalogEntry {
  type: string;
  name: string;
  description: string;
  icon: string;
  authType: "oauth" | "apikey";
  color: string;
  fields?: { key: string; label: string; type: string; placeholder: string }[];
}

type TestState = "idle" | "testing" | "ok" | "fail";

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
  const [testState, setTestState] = useState<TestState>("idle");
  const [testInfo, setTestInfo] = useState("");
  const [error, setError] = useState("");

  function reset() {
    setExpanded(false);
    setError("");
    setTestState("idle");
    setTestInfo("");
    setValues({});
  }

  function buildConfig(): Record<string, unknown> | null {
    const config: Record<string, unknown> = {};
    for (const field of catalog.fields ?? []) {
      const val = values[field.key]?.trim();
      if (!val && !field.label.toLowerCase().includes("optional")) {
        setError(`${field.label} is required`);
        return null;
      }
      if (field.key === "projectKeys" && val) {
        config[field.key] = val.split(",").map((s) => s.trim());
      } else {
        config[field.key] = val ?? "";
      }
    }
    return config;
  }

  async function handleTestAndConnect() {
    setError("");
    const config = buildConfig();
    if (!config) return;

    // Step 1: test connection
    setTestState("testing");
    try {
      const testRes = await fetch(`/api/workspaces/${workspaceId}/connectors/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: catalog.type, config }),
      });
      const testData = await testRes.json();
      if (!testData.ok) throw new Error(testData.error?.message ?? "Connection test failed");
      setTestInfo(testData.data.info ?? "Connected");
      setTestState("ok");
    } catch (err) {
      setTestState("fail");
      setError(err instanceof Error ? err.message : "Could not reach the service. Check your credentials.");
      return;
    }

    // Step 2: save connector
    setLoading(true);
    try {
      const config2 = buildConfig()!;
      const res = await fetch(`/api/workspaces/${workspaceId}/connectors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: catalog.type, name: catalog.name, config: config2 }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error?.message ?? "Failed to connect");
      reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
      setTestState("idle");
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth() {
    window.location.href = `/api/auth/${catalog.type.toLowerCase()}?workspaceId=${workspaceId}`;
  }

  const isBusy = loading || testState === "testing";

  return (
    <Card className={cn("border transition-all", catalog.color, expanded && "ring-2 ring-indigo-400")}>
      <CardHeader className="pb-2">
        <div className="flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center p-1.5 shrink-0">
              <ConnectorIcon type={catalog.type} className="w-full h-full" />
            </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">{catalog.name}</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-snug">{catalog.description}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {!expanded ? (
          <Button
            size="sm"
            onClick={() => setExpanded(true)}
            variant="outline"
            className="w-full gap-1.5 text-xs border-gray-200 text-gray-700 hover:border-indigo-300 hover:text-indigo-700"
          >
            <Plus className="h-3 w-3" />
            Connect
          </Button>
        ) : (
          <div className="space-y-3">
            {catalog.authType === "oauth" ? (
              <>
                <p className="text-xs text-gray-600 bg-white/80 rounded-lg p-3 border border-gray-100 leading-relaxed">
                  You&apos;ll be redirected to <span className="font-medium">{catalog.name}</span> to
                  authorize Sentinel. We only request read access to import your data.
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleOAuth}
                    className="flex-1 gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    Connect with {catalog.name}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={reset} className="text-xs px-2">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </>
            ) : (
              <>
                {catalog.fields?.map((field) => (
                  <div key={field.key} className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">{field.label}</label>
                    <Input
                      type={field.type}
                      placeholder={field.placeholder}
                      value={values[field.key] ?? ""}
                      onChange={(e) => {
                        setValues((v) => ({ ...v, [field.key]: e.target.value }));
                        setTestState("idle");
                        setTestInfo("");
                      }}
                      className="text-xs h-8"
                      disabled={isBusy}
                    />
                  </div>
                ))}

                {/* Test result banner */}
                {testState === "ok" && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-2">
                    <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                    {testInfo}
                  </div>
                )}
                {error && <p className="text-xs text-red-600">{error}</p>}

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleTestAndConnect}
                    disabled={isBusy}
                    className="flex-1 gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    {testState === "testing" ? (
                      <><Loader2 className="h-3 w-3 animate-spin" /> Checking credentials…</>
                    ) : loading ? (
                      <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>
                    ) : (
                      "Save & Connect"
                    )}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={reset} className="text-xs px-2" disabled={isBusy}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
