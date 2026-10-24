import { databricksErrorResponse } from "@/lib/databricks/client";
import { loadExploreOptions, runExplore } from "@/lib/analytics/explore";
import type { ExploreOptions, ExploreSpec } from "@/lib/analytics/explore-types";

export const maxDuration = 60;

const store = globalThis as unknown as { kismetExploreOptions?: { at: number; body: ExploreOptions } };

export async function GET() {
  const cached = store.kismetExploreOptions;
  if (cached && Date.now() - cached.at < 5 * 60_000) {
    return Response.json(cached.body);
  }
  try {
    const body = await loadExploreOptions();
    store.kismetExploreOptions = { at: Date.now(), body };
    return Response.json(body);
  } catch (error) {
    return databricksErrorResponse(error);
  }
}

export async function POST(request: Request) {
  let spec: ExploreSpec;
  try {
    spec = (await request.json()) as ExploreSpec;
  } catch {
    return Response.json({ error: "Send a chart definition." }, { status: 400 });
  }
  try {
    const options = store.kismetExploreOptions?.body ?? (await loadExploreOptions());
    if (!store.kismetExploreOptions) store.kismetExploreOptions = { at: Date.now(), body: options };
    return Response.json(await runExplore(spec, options));
  } catch (error) {
    return databricksErrorResponse(error);
  }
}
