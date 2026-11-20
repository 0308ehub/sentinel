import { privatePage } from "@/lib/page-meta";

export const metadata = privatePage("Projects", "Projects in this workspace.");
import { ProjectsSettingsView } from "@/components/settings/projects-settings-view";

export default function ProjectsSettingsPage() {
  return (
    <ProjectsSettingsView />
  );
}
