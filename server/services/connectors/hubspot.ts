import type { HubSpotConfig, ImportedDocument } from "./types";

export async function testHubSpotConnection(accessToken: string) {
  const res = await fetch("https://api.hubapi.com/crm/v3/owners?limit=1", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Invalid HubSpot credentials");
  return true;
}

export async function syncHubSpot(config: HubSpotConfig, maxItems = 100): Promise<ImportedDocument[]> {
  const headers = { Authorization: `Bearer ${config.accessToken}`, "Content-Type": "application/json" };
  const updatedAfter = config.lastSyncedAt ?? new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

  // Pull recent notes, calls, emails from the CRM
  const engRes = await fetch(
    `https://api.hubapi.com/crm/v3/objects/notes?limit=${maxItems}&properties=hs_note_body,hs_timestamp,hs_created_by&sorts=-hs_timestamp`,
    { headers }
  );
  const engData = (await engRes.json()) as Record<string, unknown>;
  const notes = ((engData.results as unknown[]) ?? []);

  const docs: ImportedDocument[] = [];
  for (const note of notes) {
    const n = note as Record<string, unknown>;
    const props = n.properties as Record<string, string>;
    if (props.hs_timestamp < updatedAfter) continue;
    const body = props.hs_note_body ?? "";
    if (!body.trim()) continue;

    docs.push({
      title: `HubSpot Note — ${new Date(props.hs_timestamp).toLocaleDateString()}`,
      externalId: n.id as string,
      text: body,
      sourceType: "HUBSPOT",
      metadata: { timestamp: props.hs_timestamp },
    });
  }

  return docs;
}
