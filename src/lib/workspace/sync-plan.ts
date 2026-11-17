export type InitialAction = "adopt-server" | "push-local" | "reset-local" | "none";

export function initialAction(input: {
  serverHasData: boolean;
  localEmpty: boolean;
  localOwner: string | null;
  userId: string;
}): InitialAction {
  if (input.serverHasData) return "adopt-server";
  if (input.localEmpty) return "none";
  if (input.localOwner === null || input.localOwner === input.userId) return "push-local";
  return "reset-local";
}

export function trimForUpload(
  json: unknown,
  maxBytes: number,
  slim: (value: unknown) => unknown,
): unknown {
  const bytes = new TextEncoder().encode(JSON.stringify(json)).byteLength;
  return bytes > maxBytes ? slim(json) : json;
}
