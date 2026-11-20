export interface SessionFolder {
  id: string;
  name: string;
  open: boolean;
}

export interface SessionFolderState {
  folders: SessionFolder[];
  membership: Record<string, string>;
}

export function emptyFolders(): SessionFolderState {
  return { folders: [], membership: {} };
}

export function parseFolders(raw: string | null): SessionFolderState {
  if (!raw) return emptyFolders();
  try {
    const parsed = JSON.parse(raw) as Partial<SessionFolderState>;
    const folders = Array.isArray(parsed.folders)
      ? parsed.folders.flatMap((folder) => {
          if (!folder || typeof folder.id !== "string" || !folder.id || typeof folder.name !== "string") return [];
          const name = folder.name.trim();
          if (!name) return [];
          return [{ id: folder.id, name, open: folder.open !== false }];
        })
      : [];
    const membership: Record<string, string> = {};
    const known = new Set(folders.map((folder) => folder.id));
    for (const [experimentId, folderId] of Object.entries(parsed.membership ?? {})) {
      if (typeof folderId === "string" && known.has(folderId)) membership[experimentId] = folderId;
    }
    return { folders, membership };
  } catch {
    return emptyFolders();
  }
}

export function groupedSessions<T extends { id: string }>(items: T[], state: SessionFolderState): {
  folders: { folder: SessionFolder; items: T[] }[];
  loose: T[];
} {
  const byFolder = new Map(state.folders.map((folder) => [folder.id, [] as T[]]));
  const loose: T[] = [];
  for (const item of items) {
    const bucket = byFolder.get(state.membership[item.id] ?? "");
    if (bucket) bucket.push(item);
    else loose.push(item);
  }
  return {
    folders: state.folders.map((folder) => ({ folder, items: byFolder.get(folder.id) ?? [] })),
    loose,
  };
}

export function addFolder(state: SessionFolderState, name: string, id: string): SessionFolderState {
  const trimmed = name.trim();
  if (!trimmed) return state;
  return { ...state, folders: [...state.folders, { id, name: trimmed, open: true }] };
}

export function renameFolder(state: SessionFolderState, id: string, name: string): SessionFolderState {
  const trimmed = name.trim();
  if (!trimmed) return state;
  return { ...state, folders: state.folders.map((folder) => folder.id === id ? { ...folder, name: trimmed } : folder) };
}

export function toggleFolder(state: SessionFolderState, id: string): SessionFolderState {
  return { ...state, folders: state.folders.map((folder) => folder.id === id ? { ...folder, open: !folder.open } : folder) };
}

export function removeFolder(state: SessionFolderState, id: string): SessionFolderState {
  const membership: Record<string, string> = {};
  for (const [experimentId, folderId] of Object.entries(state.membership)) {
    if (folderId !== id) membership[experimentId] = folderId;
  }
  return { folders: state.folders.filter((folder) => folder.id !== id), membership };
}

export function moveToFolder(state: SessionFolderState, experimentId: string, folderId: string | null): SessionFolderState {
  const membership = { ...state.membership };
  if (!folderId || !state.folders.some((folder) => folder.id === folderId)) delete membership[experimentId];
  else membership[experimentId] = folderId;
  return { ...state, membership };
}
