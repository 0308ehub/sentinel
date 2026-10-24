import { connectorById } from "@/lib/connectors/catalog";

const KEY = "kismet-connectors";

export interface SavedConnector {
  id: string;
  values: Record<string, string>;
  savedAt: string;
}

export function readSavedConnectors(): SavedConnector[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedConnector[];
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.id === "string") : [];
  } catch {
    return [];
  }
}

export function savedConnector(id: string): SavedConnector | undefined {
  return readSavedConnectors().find((item) => item.id === id);
}

export function writeConnector(id: string, values: Record<string, string>): SavedConnector {
  const next: SavedConnector = { id, values, savedAt: new Date().toISOString() };
  const others = readSavedConnectors().filter((item) => item.id !== id);
  localStorage.setItem(KEY, JSON.stringify([next, ...others]));
  return next;
}

export function removeConnector(id: string) {
  const others = readSavedConnectors().filter((item) => item.id !== id);
  localStorage.setItem(KEY, JSON.stringify(others));
}

/** Names and graph roles only. Credential values stay out of the graph and the model prompt. */
export function connectorGraphLabel(id: string): { name: string; filesAs: string } | null {
  const connector = connectorById(id);
  if (!connector) return null;
  return { name: connector.name, filesAs: connector.filesAs };
}
