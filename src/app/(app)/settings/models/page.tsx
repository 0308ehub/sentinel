import { privatePage } from "@/lib/page-meta";

export const metadata = privatePage("Models", "Which models this workspace uses.");
import { ModelsView } from "@/components/settings/models-view";

export default function ModelsSettingsPage() {
  return (
    <ModelsView />
  );
}
