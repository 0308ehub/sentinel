import { modelTitle, previewRoutes } from "@/lib/ai/policy";
import { providerConfig } from "@/lib/ai/providers";

export async function GET() {
  const config = providerConfig();
  const routes = previewRoutes({
    claudeReady: config.claudeReady,
    openaiReady: config.openaiReady,
    policy: config.policy,
    claudeModel: config.claudeModel,
    openaiModel: config.openaiModel,
  }).map((route) => ({
    label: route.label,
    provider: route.provider,
    model: route.model,
    title: modelTitle(route.provider, route.model),
    reason: route.reason,
  }));
  return Response.json({
    policy: config.policy,
    claude: { configured: config.claudeReady, model: config.claudeModel },
    openai: { configured: config.openaiReady, model: config.openaiModel },
    routes,
  });
}
