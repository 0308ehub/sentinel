import { privatePage } from "@/lib/page-meta";

export const metadata = privatePage("Board", "The work sitting on the board.");

export default function BoardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
