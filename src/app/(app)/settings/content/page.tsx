import { privatePage } from "@/lib/page-meta";

export const metadata = privatePage("Content access", "Who can read content in this workspace.");
import { ContentAccessView } from "@/components/settings/content-access-view";

export default function ContentAccessPage() {
  return (
    <ContentAccessView />
  );
}
