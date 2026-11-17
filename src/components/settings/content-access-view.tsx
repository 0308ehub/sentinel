"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsShell } from "@/components/settings/settings-shell";
import { Choice, fieldClass, ToggleRow } from "@/components/settings/settings-form";
import { readLiving } from "@/lib/prd/document";
import { useGraphHydrated, useGraphStore } from "@/lib/graph/graph-store";
import { updateWorkspace, useWorkspaceSettings, type ShareAudience } from "@/lib/settings/workspace";

const AUDIENCES: { id: ShareAudience; title: string; description: string }[] = [
  { id: "anyone", title: "Anyone with the link", description: "A public link can be opened without an account." },
  { id: "domain", title: "Company domain", description: "The viewer enters an email at the allowed domain." },
  { id: "invited", title: "Specific emails", description: "The link opens for the addresses on that document." },
];

const DAYS = [7, 30, 90, 365];

export function ContentAccessView() {
  const settings = useWorkspaceSettings();
  const hydrated = useGraphHydrated();
  const nodes = useGraphStore((state) => state.nodes);
  const docs = nodes.filter((node) => node.metadata && typeof node.metadata.living === "object");

  return (
    <SettingsShell wide title="Content access" description="Who can open a shared PRD">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Share links</CardTitle>
            <CardDescription>
              These rules are checked the next time someone copies a link. A link already sent stays valid until it expires, because the document travels inside the link.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="divide-y divide-border overflow-hidden rounded-md border border-border">
              <ToggleRow
                title="Allow public links"
                description="People can share a PRD with anyone who has the link."
                checked={settings.allowPublicLinks}
                onCheckedChange={(allowPublicLinks) => updateWorkspace({ allowPublicLinks })}
              />
              <ToggleRow
                title="Require an expiration"
                description="New links stop opening after the period you set."
                checked={settings.requireExpiry}
                onCheckedChange={(requireExpiry) => updateWorkspace({ requireExpiry })}
              />
            </div>
            {settings.requireExpiry && (
              <div className="space-y-1.5">
                <label htmlFor="share-days" className="text-sm font-medium">
                  Link lifetime
                </label>
                <select
                  id="share-days"
                  className={fieldClass}
                  value={settings.shareMaxDays}
                  onChange={(event) => updateWorkspace({ shareMaxDays: Number(event.target.value) })}
                >
                  {DAYS.map((days) => (
                    <option key={days} value={days}>
                      {days} days
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-2">
              <p className="text-sm font-medium">Default audience</p>
              {AUDIENCES.map((audience) => (
                <Choice
                  key={audience.id}
                  selected={settings.shareAudience === audience.id}
                  title={audience.title}
                  description={audience.description}
                  onSelect={() => updateWorkspace({ shareAudience: audience.id })}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
            <CardDescription>Audience saved on each PRD</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {!hydrated ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">Reading documents…</p>
            ) : docs.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">No PRDs in this workspace yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Document</th>
                    <th className="px-4 py-2 font-medium">Audience</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map((node) => {
                    const living = readLiving(node.metadata);
                    return (
                      <tr key={node.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3">
                          <Link href={`/features/${node.id}`} className="font-medium hover:underline">
                            {node.title}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{audienceLabel(living.audience, living.domain)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </SettingsShell>
  );
}

function audienceLabel(audience: string, domain: string): string {
  if (audience === "domain") return domain ? `Anyone at ${domain}` : "Company domain";
  if (audience === "invited") return "Specific emails";
  return "Anyone with the link";
}
