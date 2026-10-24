import { databricksErrorResponse, listDatabricksCatalogs } from "@/lib/databricks/client";

export async function GET() {
  try {
    return Response.json({ catalogs: await listDatabricksCatalogs() });
  } catch (error) {
    return databricksErrorResponse(error);
  }
}
