import { EmptyState } from "./lab-ui";
import { AGENT_LABELS } from "./labels";
import type { Update } from "@/lib/lab/types";

export function UpdateFeed({ feed }: { feed: Update[] }) {
  return (
    <aside className="xl:sticky xl:top-5 xl:self-start">
      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[.08em] text-muted-foreground">
        Kismet&apos;s updates
      </h2>
      <div className="max-h-[720px] overflow-auto rounded-md border bg-card">
        <div className="divide-y">
          {feed.length ? (
            feed.map((update) => (
              <div key={update.id} className="flex gap-3 p-3">
                <span
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
                  style={{ backgroundColor: AGENT_LABELS[update.agent].color }}
                >
                  {AGENT_LABELS[update.agent].initials}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="text-xs">{update.title}</b>
                    <span className="text-[11px] text-muted-foreground">Day {update.day}</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{update.body}</p>
                </div>
              </div>
            ))
          ) : (
            <EmptyState>Updates from the four agents appear here.</EmptyState>
          )}
        </div>
      </div>
    </aside>
  );
}
