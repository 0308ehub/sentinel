import { AppShell } from "@/components/layout/app-shell";
import { privatePage } from "@/lib/page-meta";

export const metadata = privatePage("Google", "Google connected to this workspace.");
import { GoogleView } from "@/components/settings/google-view";

export default function GoogleSettingsPage() {
  return (
    <AppShell>
      <GoogleView />
    </AppShell>
  );
}
