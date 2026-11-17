import { figmaStatus } from "@/lib/figma/client";

export const maxDuration = 20;

export async function GET() {
  try {
    return Response.json(await figmaStatus());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not check Figma.";
    return Response.json({ connected: false, handle: "", error: message }, { status: 200 });
  }
}
