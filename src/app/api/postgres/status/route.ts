import { getPostgresStatus } from "@/lib/postgres/client";

export async function GET() {
  return Response.json(await getPostgresStatus());
}
