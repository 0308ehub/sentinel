import { SERVER_SDK_FILE, SERVER_SDK_SOURCE, SERVER_SDK_TYPES, SERVER_SDK_TYPES_FILE } from "@/lib/sdk/kismet-server";

const FILES: Record<string, { body: string; type: string }> = {
  [SERVER_SDK_FILE]: { body: SERVER_SDK_SOURCE, type: "text/javascript; charset=utf-8" },
  [SERVER_SDK_TYPES_FILE]: { body: SERVER_SDK_TYPES, type: "text/plain; charset=utf-8" },
};

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const found = FILES[file];
  if (!found) return new Response("Not found", { status: 404 });
  return new Response(found.body, {
    headers: {
      "Content-Type": found.type,
      "Content-Disposition": `inline; filename="${file}"`,
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
