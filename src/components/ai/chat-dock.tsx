"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { ChatPane } from "@/components/ai/chat-pane";
import { activeThread, threadPending, useChatState } from "@/lib/chat/session";
import { useUIStore } from "@/stores/ui-store";

function isChatPath(pathname: string) {
  return pathname === "/ai" || pathname.startsWith("/ai/");
}

let lastPath = "";

export function ChatDock() {
  const pathname = usePathname();
  const state = useChatState();
  const pending = threadPending(state.activeId);
  const open = useUIStore((store) => store.chatDockOpen);
  const setOpen = useUIStore((store) => store.setChatDockOpen);

  useEffect(() => {
    const leftChat = isChatPath(lastPath) && !isChatPath(pathname);
    lastPath = pathname;
    if (!leftChat) return;
    const thread = activeThread(state);
    if (pending || (thread && thread.messages.length > 0)) setOpen(true);
  }, [pathname, pending, setOpen, state]);

  if (isChatPath(pathname) || !open) return null;

  return (
    <aside className="flex h-full w-[min(400px,40vw)] shrink-0 flex-col border-l border-border bg-background">
      <ChatPane variant="dock" onClose={() => setOpen(false)} />
    </aside>
  );
}
