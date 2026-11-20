import { AIWorkspaceView } from "@/components/ai/ai-workspace-view";
import { privatePage } from "@/lib/page-meta";

export const metadata = privatePage("Chat", "Ask the workspace a question.");

export default function AIPage() {
  return (
    <AIWorkspaceView />
  );
}
