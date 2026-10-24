import { databricksErrorResponse, getDatabricksStatus } from "@/lib/databricks/client";

export async function GET() {
  try {
    return Response.json(await getDatabricksStatus());
  } catch (error) {
    return databricksErrorResponse(error);
  }
}
