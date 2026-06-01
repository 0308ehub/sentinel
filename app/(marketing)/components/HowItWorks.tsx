const steps = [
  {
    num: '01',
    title: 'Connect your stack',
    body: 'Link Gmail, Linear, Slack, or Notion. Sentinel scans hourly with zero manual setup.',
  },
  {
    num: '02',
    title: 'Surface what matters',
    body: 'Sentinel reads signals, scores relevance, and surfaces the insights worth acting on.',
  },
  {
    num: '03',
    title: 'Ship autonomously',
    body: 'Review queued actions in your Inbox. Approve once and Sentinel handles the rest — tickets, PRDs, Linear sync.',
  },
]

export function HowItWorks() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-20 border-t border-border">
      <div className="text-center mb-14">
        <p className="text-xs font-semibold text-brand uppercase tracking-widest mb-3">How it works</p>
        <h2 className="text-3xl md:text-4xl font-semibold text-foreground tracking-tight">
          From signal to shipped — automatically
        </h2>
      </div>

      <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
        {steps.map(step => (
          <div key={step.num} className="relative">
            <span className="text-5xl font-bold text-muted-foreground/20 leading-none select-none block mb-4">
              {step.num}
            </span>
            <h3 className="text-base font-semibold text-foreground mb-2">{step.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
