import { FadeUp } from './FadeUp'

const steps = [
  {
    num: '01',
    title: 'Connect your stack',
    body: 'Link Gmail, Linear, Slack, or Notion. Sentinel scans hourly with zero manual setup. Uploads, PDFs, CRM exports — all ingested automatically.',
  },
  {
    num: '02',
    title: 'Surface what matters',
    body: 'Sentinel reads signals across your connectors, scores relevance, and surfaces the pain points and opportunities worth acting on.',
  },
  {
    num: '03',
    title: 'Ship autonomously',
    body: 'Review queued actions in your Inbox. Approve once and Sentinel handles the rest — tickets, PRDs, Linear sync, and stakeholder updates.',
  },
]

export function HowItWorks() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-20 border-t border-border">
      <FadeUp>
        <div className="text-center mb-14">
          <p className="text-xs font-semibold text-brand uppercase tracking-widest mb-3">How it works</p>
          <h2 className="text-3xl md:text-4xl font-semibold text-foreground tracking-tight">
            From signal to shipped — automatically
          </h2>
        </div>
      </FadeUp>

      <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
        {steps.map((step, i) => (
          <FadeUp key={step.num} delay={i * 100}>
            <div className="relative group">
              <span className="text-5xl font-bold text-brand/15 leading-none select-none block mb-4">
                {step.num}
              </span>
              <h3 className="text-base font-semibold text-foreground mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>
              {/* connector line between steps */}
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-8 left-full w-full h-px bg-border -translate-y-1/2 translate-x-4 pointer-events-none" />
              )}
            </div>
          </FadeUp>
        ))}
      </div>
    </section>
  )
}
