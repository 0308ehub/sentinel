const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG']

const ganttRows = [
  {
    label: 'Onboarding revamp',
    completed: true,
    start: 0,
    width: 3,
    milestone: 2.5,
  },
  {
    label: 'Performance sprint',
    completed: false,
    start: 1,
    width: 2,
    milestone: null,
  },
  {
    label: 'Mobile push',
    completed: false,
    start: 3,
    width: 4,
    milestone: 5.5,
  },
]

export function SynthesizeMockup() {
  const totalMonths = MONTHS.length

  return (
    <div className="flex flex-col h-[320px]">
      {/* Month header bar */}
      <div className="flex border-b border-white/[0.06]">
        <div className="w-[280px] flex-shrink-0 border-r border-white/[0.06]" />
        <div className="flex-1 flex">
          {MONTHS.map((m) => (
            <div
              key={m}
              className="flex-1 text-center text-[10px] font-medium text-[#444] py-2 tracking-wider"
            >
              {m}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left initiative list */}
        <div className="w-[280px] flex-shrink-0 border-r border-white/[0.06] p-4 bg-[#0a0a0a]">
          <p className="text-[12px] font-medium text-white mb-3">Initiatives</p>
          <div className="space-y-1">
            {/* Core Product */}
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <span className="text-[#3b82f6] text-[8px]">●</span>
                <span className="text-[12px] text-white">Core Product</span>
              </div>
              <span className="text-[11px] text-[#444]">58</span>
            </div>
            <div className="flex items-center justify-between py-1 pl-5">
              <span className="text-[11px] text-[#666]">Onboarding revamp</span>
              <span className="text-[10px] text-[#444]">12</span>
            </div>
            <div className="flex items-center justify-between py-1 pl-5">
              <span className="text-[11px] text-[#666]">Performance</span>
              <span className="text-[10px] text-[#444]">8</span>
            </div>
            <div className="flex items-center justify-between py-1 pl-5">
              <span className="text-[11px] text-[#666]">Mobile</span>
              <span className="text-[10px] text-[#444]">6</span>
            </div>
            {/* Growth */}
            <div className="flex items-center justify-between py-1 mt-1">
              <div className="flex items-center gap-2">
                <span className="text-[#a855f7] text-[8px]">●</span>
                <span className="text-[12px] text-white">Growth</span>
              </div>
              <span className="text-[11px] text-[#444]">24</span>
            </div>
            {/* Platform */}
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <span className="text-[#22c55e] text-[8px]">●</span>
                <span className="text-[12px] text-white">Platform</span>
              </div>
              <span className="text-[11px] text-[#444]">15</span>
            </div>
          </div>
        </div>

        {/* Right Gantt area */}
        <div className="flex-1 relative p-4 bg-[#0f0f0f]">
          {/* Today line */}
          <div
            className="absolute top-0 bottom-0 w-px bg-[#3b82f6]/30"
            style={{ left: `${(2.5 / totalMonths) * 100}%` }}
          />

          <div className="space-y-4 pt-1">
            {ganttRows.map((row) => {
              const leftPct = (row.start / totalMonths) * 100
              const widthPct = (row.width / totalMonths) * 100
              const milestonePct = row.milestone !== null
                ? ((row.milestone - row.start) / row.width) * 100
                : null

              return (
                <div key={row.label} className="relative h-7 flex items-center">
                  {/* Label */}
                  <span
                    className="absolute text-[11px] text-[#888] whitespace-nowrap z-10"
                    style={{ left: `${leftPct}%`, transform: 'translateY(-14px)' }}
                  >
                    {row.label}{row.completed ? ' ✓' : ''}
                  </span>

                  {/* Bar */}
                  <div
                    className="absolute h-7 rounded bg-[#1e1e1e] border border-white/[0.08]"
                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                  >
                    {/* Fill for completed portion */}
                    {row.completed && (
                      <div className="absolute inset-0 rounded bg-[#2a2a2a] border border-white/[0.1]" />
                    )}

                    {/* Milestone diamond */}
                    {milestonePct !== null && (
                      <div
                        className="absolute top-1/2 w-3 h-3 rotate-45 bg-[#333] border border-white/[0.2]"
                        style={{
                          left: `${milestonePct}%`,
                          transform: 'translateX(-50%) translateY(-50%) rotate(45deg)',
                        }}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
