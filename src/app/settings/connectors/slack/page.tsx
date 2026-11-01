import { AppShell } from "@/components/layout/app-shell";
import { SlackChannelView } from "@/components/settings/slack-channel-view";

export default async function SlackSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const rawError = (await searchParams).error;
  const error = Array.isArray(rawError) ? rawError[0] : rawError;
  return (
    <AppShell>
      <SlackChannelView oauthError={error} />
    </AppShell>
  );
}
