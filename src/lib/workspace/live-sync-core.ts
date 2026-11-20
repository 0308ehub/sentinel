export type PresenceEntry = {
  userId: string;
  name: string;
  imageUrl: string;
  location: string;
};

export type WorkspaceLocation =
  | { kind: "experiment"; experimentId: string }
  | { kind: "page"; pathname: string };

export function formatLocation(pathname: string, experimentId?: string | null): string {
  const cleanPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const location = experimentId ? `experiments:${experimentId}` : `page:${cleanPath}`;
  return location.slice(0, 200);
}

export function parseLocation(location: string): WorkspaceLocation | null {
  if (location.startsWith("experiments:") && location.length > 12) {
    return { kind: "experiment", experimentId: location.slice(12) };
  }
  if (location.startsWith("page:/")) return { kind: "page", pathname: location.slice(5) };
  return null;
}

export function presenceHere(entries: PresenceEntry[], location: string): PresenceEntry[] {
  return entries.filter((entry) => entry.location === location);
}

export function versionChanged(previous: number | null, next: number): boolean {
  return previous !== null && next !== previous;
}
