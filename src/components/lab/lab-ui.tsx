export function LabSection({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-4">
      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[.08em] text-muted-foreground">{title}</h2>
      <div className="rounded-md border bg-card px-4 py-2">{children}</div>
    </section>
  );
}

export function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      <div className="rounded-md border bg-card p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>;
}
