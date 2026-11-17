import { AgentMark } from "@/components/inbox/agent-mark";
import { cn } from "@/lib/utils";
import type { InboxThread } from "@/lib/inbox/types";

export function ThreadFaces({ thread, size, selected = false }: { thread: InboxThread; size: number; selected?: boolean }) {
  const [first, second] = thread.agents;
  const ring = selected ? "shadow-[0_0_0_2px_var(--sidebar),0_0_0_4px_var(--primary)] rounded-full" : "";
  if (thread.kind === "pod" && second) {
    return (
      <span className={cn("relative block shrink-0", ring)} style={{ width: size, height: size }}>
        <AgentMark name={first?.name ?? thread.title} icon={first?.icon} color={first?.color ?? "#6e8caf"} size={size * 0.68} />
        <span className="absolute bottom-0 right-0">
          <AgentMark name={second.name} icon={second.icon} color={second.color} size={size * 0.55} className="shadow-[0_0_0_2px_var(--sidebar)]" />
        </span>
      </span>
    );
  }
  const agent = first;
  return <AgentMark name={agent?.name ?? thread.title} icon={agent?.icon} color={agent?.color ?? "#6e8caf"} size={size} className={ring} />;
}
