export function ListenMockup() {
  return (
    <div className="flex h-[380px]">
      {/* Left panel — Slack thread */}
      <div className="w-[380px] border-r border-white/[0.06] p-6 bg-[#0d1117] flex flex-col">
        {/* Channel header */}
        <div className="flex items-center gap-2 mb-5 pb-4 border-b border-white/[0.06]">
          <span className="text-[#888] text-[16px] font-semibold">#</span>
          <span className="text-[13px] font-medium text-white">feedback</span>
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-4 overflow-hidden">
          {/* Message 1 */}
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-[#1e1e1e] text-[11px] font-medium text-[#888] flex items-center justify-center flex-shrink-0">
              S
            </div>
            <div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-[12px] font-medium text-white">sarah</span>
                <span className="text-[11px] text-[#444]">10:42 AM</span>
              </div>
              <p className="text-[13px] text-[#ccc] leading-relaxed">
                The onboarding flow is confusing — 3 users dropped off at step 2 this week
              </p>
            </div>
          </div>

          {/* Message 2 */}
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-[#1e1e1e] text-[11px] font-medium text-[#888] flex items-center justify-center flex-shrink-0">
              M
            </div>
            <div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-[12px] font-medium text-white">marcus</span>
                <span className="text-[11px] text-[#444]">10:43 AM</span>
              </div>
              <p className="text-[13px] text-[#ccc] leading-relaxed">
                Yeah, step 2 has the most rage clicks in FullStory
              </p>
            </div>
          </div>

          {/* Message 3 */}
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-[#1e1e1e] text-[11px] font-medium text-[#888] flex items-center justify-center flex-shrink-0">
              D
            </div>
            <div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-[12px] font-medium text-white">diana</span>
                <span className="text-[11px] text-[#444]">10:44 AM</span>
              </div>
              <p className="text-[13px] text-[#ccc] leading-relaxed">
                We&apos;re losing ~15% of signups there, worth prioritizing
              </p>
            </div>
          </div>
        </div>

        {/* Input */}
        <div className="mt-4 border border-white/[0.06] rounded-lg px-3 py-2.5 bg-[#111]">
          <span className="text-[12px] text-[#444]">
            <span className="text-[#666]">@Sentinel</span>
            {' '}create issue from this conversation
          </span>
        </div>
      </div>

      {/* Right panel — Issue cards */}
      <div className="flex-1 p-6 bg-[#161b22]">
        {/* Column headers */}
        <div className="flex gap-8 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-medium text-white">Todo</span>
            <span className="text-[11px] text-[#444] bg-[#1a1a1a] px-1.5 py-0.5 rounded">43</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-medium text-white">In Progress</span>
            <span className="text-[11px] text-[#444] bg-[#1a1a1a] px-1.5 py-0.5 rounded">2</span>
          </div>
        </div>

        {/* Cards */}
        <div className="space-y-2">
          {/* Card 1 */}
          <div className="bg-[#111] border border-white/[0.06] rounded-lg p-3">
            <div className="flex items-start justify-between mb-2">
              <span className="text-[12px] text-[#555]">SEN-241</span>
              <span className="text-[10px] bg-red-500/10 text-red-400/80 border border-red-500/20 px-1.5 py-0.5 rounded">High</span>
            </div>
            <p className="text-[13px] text-[#ccc] mb-2">Onboarding step 2 redesign</p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-[#1a1a1a] border border-white/[0.06] text-[#666] px-1.5 py-0.5 rounded">UX</span>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-[#111] border border-white/[0.06] rounded-lg p-3">
            <div className="flex items-start justify-between mb-2">
              <span className="text-[12px] text-[#555]">SEN-242</span>
            </div>
            <p className="text-[13px] text-[#ccc] mb-2">Add progress indicator to onboarding</p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-[#1a1a1a] border border-white/[0.06] text-[#666] px-1.5 py-0.5 rounded">UX</span>
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-[#111] border border-white/[0.06] rounded-lg p-3">
            <div className="flex items-start justify-between mb-2">
              <span className="text-[12px] text-[#555]">SEN-243</span>
            </div>
            <p className="text-[13px] text-[#ccc] mb-2">A/B test simplified flow</p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-[#1a1a1a] border border-white/[0.06] text-[#666] px-1.5 py-0.5 rounded">Growth</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
