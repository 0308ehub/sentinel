import { AppShell } from "@/components/layout/app-shell";
import { SlackChannelView } from "@/components/settings/slack-channel-view";

export default function SlackSettingsPage() {
  return (
    <AppShell>
      <SlackChannelView />
    </AppShell>
  );
}
