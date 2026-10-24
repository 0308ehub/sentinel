import { databricksErrorResponse } from "@/lib/databricks/client";
import { loadWarehouseCharts, type WarehouseCharts } from "@/lib/analytics/warehouse-charts";

export const maxDuration = 60;

const store = globalThis as unknown as { kismetChartsV2?: { at: number; body: WarehouseCharts } };

export async function GET() {
  const cached = store.kismetChartsV2;
  if (cached && Date.now() - cached.at < 5 * 60_000) {
    return Response.json(cached.body);
  }
  try {
    const body = await loadWarehouseCharts();
    store.kismetChartsV2 = { at: Date.now(), body };
    return Response.json(body);
  } catch (error) {
    return databricksErrorResponse(error);
  }
}
