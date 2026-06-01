export function CTASection() {
  return (
    <section className="py-32 border-t border-white/[0.06] text-center">
      <div className="max-w-[1200px] mx-auto px-6">
        <h2 className="text-[clamp(3rem,8vw,7rem)] font-bold tracking-tight text-white mb-12 leading-[0.95]">
          Available today.
        </h2>
        <div className="flex items-center justify-center gap-4">
          <a
            href="/sign-up"
            className="bg-white text-black text-[15px] font-medium px-8 py-3.5 rounded-full hover:bg-white/90 transition-colors"
          >
            Get started
          </a>
          <a
            href="/contact"
            className="bg-transparent text-white text-[15px] font-medium px-8 py-3.5 rounded-full border border-white/20 hover:border-white/40 transition-colors"
          >
            Contact sales
          </a>
        </div>
      </div>
    </section>
  )
}
