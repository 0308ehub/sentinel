import { privatePage } from "@/lib/page-meta";

export const metadata = privatePage("Google", "Google connected to this workspace.");
import { GoogleView } from "@/components/settings/google-view";

export default function GoogleSettingsPage() {
  return (
    <GoogleView />
  );
}
