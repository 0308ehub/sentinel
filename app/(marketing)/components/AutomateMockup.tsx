const actions = [
  {
    status: 'COMPLETED',
    dotColor: 'bg-green-500/70',
    borderColor: 'border-l-green-500/50',
    textColor: 'text-green-400/80',
    bgColor: 'bg-green-500/5',
    title: 'Created 3 tickets from Slack #feedback',
    time: '10:42 AM',
    source: 'Slack connector',
    progress: null,
    detail: null,
  },
  {
    status: 'IN PROGRESS',
    dotColor: 'bg-blue-500/70',
    borderColor: 'border-l-blue-500/50',
    textColor: 'text-blue-400/80',
    bgColor: 'bg-blue-500/5',
    title: 'Drafting PRD: Mobile performance initiative',
    time: '11:05 AM',
    source: 'Internal',
    progress: 60,
    detail: null,
  },
  {
    status: 'PENDING',
    dotColor: 'bg-yellow-500/70',
    borderColor: 'border-l-yellow-500/50',
    textColor: 'text-yellow-400/80',
    bgColor: 'bg-yellow-500/5',
    title: 'Weekly synthesis report ready for review',
    time: '11:30 AM',
    source: 'Scheduled',
    progress: null,
    detail: '8 new insights, 2 priority shifts',
  },
]

export function AutomateMockup() {
  return (
    <div className="p-6 bg-[#0a0a0a]">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-5 pb-4 border-b border-white/[0.06]">
        <span className="text-[12px] text-[#888] font-medium">
          Sentinel Digest — Mon Jun 2, 2025
        </span>
        <span className="text-[11px] text-[#444]">Last scan: 2 min ago</span>
      </div>

      {/* Action cards */}
      <div className="space-y-3 mb-4">
        {actions.map((action) => (
          <div
            key={action.title}
            className={`bg-[#111] border border-white/[0.06] border-l-2 ${action.borderColor} rounded-lg p-4`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${action.dotColor}`} />
                <span className={`text-[10px] uppercase tracking-wider font-medium ${action.textColor}`}>
                  {action.status}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-[#444]">
                <span>{action.time}</span>
                <span className="bg-[#1a1a1a] border border-white/[0.06] px-1.5 py-0.5 rounded text-[10px]">
                  {action.source}
                </span>
              </div>
            </div>

            <p className="text-[13px] text-[#ccc] mb-2">{action.title}</p>

            {action.progress !== null && (
              <div className="h-1 bg-[#1e1e1e] rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-blue-500/40 rounded-full"
                  style={{ width: `${action.progress}%` }}
                />
              </div>
            )}

            {action.detail && (
              <p className="text-[11px] text-[#555] mt-1">{action.detail}</p>
            )}
          </div>
        ))}
      </div>

      {/* Footer link */}
      <button className="text-[12px] text-[#444] hover:text-[#888] transition-colors cursor-pointer">
        View all 14 actions →
      </button>
    </div>
  )
}
