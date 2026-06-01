import { FadeUp } from './FadeUp'

const integrations = [
  'Gmail', 'GitHub', 'Linear', 'Jira', 'Slack', 'Notion', 'Confluence', 'Intercom',
]

const trust = [
  {
    title: 'You stay in control',
    body: 'Sentinel proposes — you approve. Every action is a suggestion until you say go.',
    icon: '🛡️',
  },
  {
    title: 'Works with your stack',
    body: 'No migration, no disruption. Sentinel sits on top of the tools your team already uses.',
    icon: '⚡',
  },
  {
    title: 'Built for PMs',
    body: 'Designed around real product workflows: discovery, synthesis, PRDs, and tickets.',
    icon: '✦',
  },
]

export function IntegrationsSection() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-20 border-t border-border">
      <FadeUp>
        <p className="text-center text-sm text-muted-foreground mb-6">
          Connects to the tools your team already uses
        </p>
        <div className="flex flex-wrap justify-center gap-2.5 mb-16">
          {integrations.map((name) => (
            <span
              key={name}
              className="px-4 py-2 rounded-lg border border-border bg-card text-sm font-medium text-muted-foreground hover:border-brand/40 hover:text-foreground transition-colors"
            >
              {name}
            </span>
          ))}
          <span className="px-4 py-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground">
            + more
          </span>
        </div>
      </FadeUp>

      <div className="grid md:grid-cols-3 gap-5">
        {trust.map((item, i) => (
          <FadeUp key={item.title} delay={i * 80}>
            <div className="p-6 rounded-xl border border-border bg-card hover:border-brand/30 transition-colors">
              <span className="text-xl mb-4 block">{item.icon}</span>
              <h3 className="font-semibold text-foreground mb-2 text-sm">{item.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.body}</p>
            </div>
          </FadeUp>
        ))}
      </div>
    </section>
  )
}
