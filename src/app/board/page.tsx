import { AppShell } from "@/components/layout/app-shell";
import { BoardView } from "@/components/board/board-view";
import { privatePage } from "@/lib/page-meta";

export const metadata = privatePage("Board", "The work sitting on the board.");

export default function BoardPage() {
  return (
    <AppShell>
      <BoardView />
    </AppShell>
  );
}
