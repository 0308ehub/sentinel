import { privatePage } from "@/lib/page-meta";

export const metadata = privatePage("Settings", "Workspace settings.");

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
