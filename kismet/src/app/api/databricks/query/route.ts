import { databricksErrorResponse, runDatabricksQuery } from "@/lib/databricks/client";

export async function POST(request: Request) {
  let statement = "";
  try {
    const body = (await request.json()) as { statement?: string };
    statement = typeof body.statement === "string" ? body.statement.slice(0, 8000) : "";
  } catch {
    return Response.json({ error: "Send a JSON body with statement." }, { status: 400 });
  }
  if (!statement.trim()) {
    return Response.json({ error: "Write a query first." }, { status: 400 });
  }

  try {
    return Response.json(await runDatabricksQuery(statement));
  } catch (error) {
    return databricksErrorResponse(error);
  }
}
