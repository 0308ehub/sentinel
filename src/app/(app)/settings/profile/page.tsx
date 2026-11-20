import { privatePage } from "@/lib/page-meta";

export const metadata = privatePage("Profile", "Your profile in this workspace.");
import { ProfileSettingsView } from "@/components/settings/profile-settings-view";

export default function ProfileSettingsPage() {
  return (
    <ProfileSettingsView />
  );
}
