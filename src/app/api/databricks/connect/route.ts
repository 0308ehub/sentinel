import { currentUserId } from "@/lib/connections/current";
import { connectErrorMessage } from "@/lib/connections/errors";
import { saveConnection } from "@/lib/connections/store";
import { getDatabricksStatus, normalizeDatabricksConfig, type DatabricksSecret } from "@/lib/databricks/client";

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const secret: DatabricksSecret = {
      host: text(body.host),
      token: text(body.token),
      httpPath: text(body.httpPath),
      catalog: text(body.catalog) || undefined,
      schema: text(body.schema) || undefined,
    };
    if (!secret.host || !secret.token || !secret.httpPath) {
      throw new Error("Host, token, and HTTP path are required.");
    }

    // Check the credential works before saving it.
    const config = normalizeDatabricksConfig(secret);
    const status = await getDatabricksStatus(config);
    if (!status.connected) throw new Error(status.error);

    await saveConnection(
      userId,
      "databricks",
      {
        host: config.host,
        token: config.token,
        httpPath: `/sql/1.0/warehouses/${config.warehouseId}`,
        catalog: config.catalog,
        schema: config.schema,
      },
      { host: status.host }
    );
    return Response.json(status);
  } catch (error) {
    return Response.json({ error: connectErrorMessage(error, "Could not connect Databricks.") }, { status: 400 });
  }
}
