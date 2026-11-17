import { AppShell } from "@/components/layout/app-shell";
import { privatePage } from "@/lib/page-meta";

export const metadata = privatePage("Billing", "How this workspace is billed.");
import { BillingSettingsView } from "@/components/settings/billing-settings-view";

export default function BillingSettingsPage() {
  return (
    <AppShell>
      <BillingSettingsView />
    </AppShell>
  );
}
