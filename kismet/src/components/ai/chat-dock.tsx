"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Loader2, MessageSquare } from "lucide-react";
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

  if (isChatPath(pathname)) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-40 flex flex-col items-end">
      {open && (
        <div className="pointer-events-auto mb-3 flex h-[min(640px,72vh)] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-xl">
          <ChatPane variant="dock" onClose={() => setOpen(false)} />
        </div>
      )}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={pending ? "Chat is still running. Open it." : "Open chat"}
          suppressHydrationWarning
          className="pointer-events-auto relative flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-background shadow-lg"
        >
          {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <MessageSquare className="h-5 w-5" />}
        </button>
      )}
    </div>
  );
}
