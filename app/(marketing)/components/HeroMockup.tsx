export function HeroMockup() {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#111111] overflow-hidden shadow-2xl" style={{ height: '340px' }}>
      {/* Browser chrome bar */}
      <div className="bg-[#0f0f0f] border-b border-white/[0.06] px-4 py-2.5 flex items-center gap-3">
        {/* Traffic light dots */}
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#333]" />
          <span className="w-3 h-3 rounded-full bg-[#333]" />
          <span className="w-3 h-3 rounded-full bg-[#333]" />
        </div>
        {/* URL bar */}
        <div className="bg-[#1a1a1a] rounded-md px-3 py-1 text-[11px] text-[#555] flex-1 max-w-xs">
          app.sentinel.ai/workspaces/acme
        </div>
      </div>

      {/* Browser body */}
      <div className="flex h-full">
        {/* Left sidebar */}
        <div className="w-[200px] border-r border-white/[0.06] bg-[#0f0f0f] p-3 flex-shrink-0">
          {/* Workspace header */}
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded bg-[#5b6af9]/20 border border-[#5b6af9]/30 flex items-center justify-center">
              <span className="text-[9px] text-[#5b6af9] font-bold">A</span>
            </div>
            <span className="text-[12px] font-medium text-white">Acme Corp</span>
          </div>

          {/* Nav items */}
          <nav className="space-y-0.5">
            <div className="flex items-center justify-between text-[12px] text-[#666] py-1.5 px-2 rounded">
              <span>Inbox</span>
              <span className="text-[10px] bg-[#5b6af9]/20 text-[#5b6af9] rounded px-1.5 py-0.5 font-medium">3</span>
            </div>
            <div className="text-[12px] text-[#666] py-1.5 px-2 rounded">Opportunities</div>
            <div className="text-[12px] text-[#5b6af9] bg-[#5b6af9]/10 py-1.5 px-2 rounded">Insights</div>
            <div className="text-[12px] text-[#666] py-1.5 px-2 rounded">Documents</div>
            <div className="text-[12px] text-[#666] py-1.5 px-2 rounded">Tickets</div>
          </nav>

          {/* Connectors section */}
          <div className="mt-4">
            <div className="text-[10px] text-[#444] mb-1 px-2 tracking-wider uppercase">Connectors</div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 text-[12px] text-[#666] py-1 px-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                <span>Slack</span>
              </div>
              <div className="flex items-center gap-2 text-[12px] text-[#666] py-1 px-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0" />
                <span>Linear</span>
              </div>
              <div className="flex items-center gap-2 text-[12px] text-[#666] py-1 px-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                <span>GitHub</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right main panel */}
        <div className="flex-1 p-5 bg-[#111111] overflow-hidden">
          <div className="text-[13px] font-medium text-white mb-4">Top Opportunities</div>

          {/* Opportunity cards */}
          <div className="space-y-2">
            {/* Card 1 */}
            <div className="bg-[#0f0f0f] border border-white/[0.06] rounded-lg p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[11px] font-bold bg-green-900/40 text-green-400 rounded px-1.5 py-0.5 flex-shrink-0">94</span>
                <span className="text-[12px] text-white truncate">iOS app performance</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[10px] text-[#555] border border-white/[0.08] rounded px-1.5 py-0.5">Mobile</span>
                <span className="text-[10px] text-[#444]">12 signals</span>
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-[#0f0f0f] border border-white/[0.06] rounded-lg p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[11px] font-bold bg-yellow-900/40 text-yellow-400 rounded px-1.5 py-0.5 flex-shrink-0">87</span>
                <span className="text-[12px] text-white truncate">Onboarding friction</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[10px] text-[#555] border border-white/[0.08] rounded px-1.5 py-0.5">Growth</span>
                <span className="text-[10px] text-[#444]">8 signals</span>
              </div>
            </div>

            {/* Card 3 */}
            <div className="bg-[#0f0f0f] border border-white/[0.06] rounded-lg p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[11px] font-bold bg-orange-900/40 text-orange-400 rounded px-1.5 py-0.5 flex-shrink-0">73</span>
                <span className="text-[12px] text-white truncate">Missing bulk actions</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[10px] text-[#555] border border-white/[0.08] rounded px-1.5 py-0.5">UX</span>
                <span className="text-[10px] text-[#444]">5 signals</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
