import { WaitlistForm } from './WaitlistForm'

export function CTASection() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-20 border-t border-border">
      <div className="max-w-xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-semibold text-foreground tracking-tight mb-4">
          Ready to ship faster?
        </h2>
        <p className="text-muted-foreground mb-8 text-sm leading-relaxed">
          Join teams using Sentinel to cut PM overhead and ship what users actually want.
        </p>
        <WaitlistForm />
      </div>
    </section>
  )
}
