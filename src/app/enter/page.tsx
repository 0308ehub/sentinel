import { EnterGate } from "@/components/auth/enter-gate";
import { privatePage } from "@/lib/page-meta";

export const metadata = privatePage("Kismet", "Opening your workspace.");

export default function EnterPage() {
  return <EnterGate />;
}
