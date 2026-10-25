import { autopilotState } from "@/lib/autopilot/loop";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await autopilotState());
}
