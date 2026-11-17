import { privatePage } from "@/lib/page-meta";

export const metadata = privatePage("Features", "Features in this workspace.");

export default function FeaturesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
