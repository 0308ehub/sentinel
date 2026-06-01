const logLines = [
  { text: 'Analyzing 24 customer conversations...', color: '#666' },
  { text: 'Identified 3 high-confidence opportunities', color: '#666' },
  { text: "Drafting PRD for: Onboarding revamp", color: '#666' },
  { text: 'Cross-referencing with existing tickets...', color: '#666' },
  { text: '', color: '#666' },
  { text: 'onboarding/step-2.md    [created]', color: '#22c55e', mono: true },
  { text: 'tickets/SEN-244.json    [created]', color: '#22c55e', mono: true },
  { text: 'tickets/SEN-245.json    [created]', color: '#22c55e', mono: true },
]

const assignees = [
  { name: 'Sentinel Agent', initials: 'SA', isAgent: true, selected: true },
  { name: 'Alex Kim', initials: 'AK', isAgent: false, selected: false },
  { name: 'Priya Shah', initials: 'PS', isAgent: false, selected: false },
  { name: 'GPT-4o', initials: 'G4', isAgent: true, selected: false },
  { name: 'Codex', initials: 'CX', isAgent: true, selected: false },
]

export function ActMockup() {
  return (
    <div className="flex h-[360px]">
      {/* Left — terminal log */}
      <div className="flex-1 p-6 bg-[#0d1117] border-r border-white/[0.06] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 mb-5 pb-4 border-b border-white/[0.06]">
          <div className="w-6 h-6 rounded bg-[#1a1a1a] border border-white/[0.08] flex items-center justify-center text-[10px] text-[#888] font-medium">
            SA
          </div>
          <span className="text-[12px] font-medium text-white">Sentinel Agent</span>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500/70 motion-safe:animate-pulse" />
            <span className="text-[10px] text-[#444]">running</span>
          </div>
        </div>

        {/* Log lines */}
        <div className="flex-1 space-y-1.5">
          {logLines.map((line, i) => (
            <div key={i} className={`text-[12px] ${line.mono ? 'font-mono' : ''}`} style={{ color: line.color }}>
              {line.text || ' '}
            </div>
          ))}
          {/* Thinking + cursor */}
          <div className="flex items-center gap-1.5 mt-2">
            <span className="text-[12px] text-[#888]">Thinking...</span>
            <span className="text-[14px] text-[#888] motion-safe:animate-pulse">▍</span>
          </div>
        </div>
      </div>

      {/* Right — assign panel */}
      <div className="w-[280px] flex-shrink-0 p-6 bg-[#161b22] flex flex-col">
        {/* Search input */}
        <div className="border border-white/[0.06] rounded-lg px-3 py-2 mb-4 bg-[#111]">
          <span className="text-[13px] text-[#444]">Assign to...</span>
        </div>

        {/* Assignee list */}
        <div className="space-y-1">
          {assignees.map((a) => (
            <div
              key={a.name}
              className={`flex items-center gap-3 px-2 py-2 rounded-lg ${
                a.selected ? 'bg-[#1a1a1a]' : 'hover:bg-[#141414]'
              } cursor-pointer group`}
            >
              <div className="w-7 h-7 rounded-full bg-[#1e1e1e] border border-white/[0.06] text-[11px] font-medium text-[#888] flex items-center justify-center flex-shrink-0">
                {a.initials}
              </div>
              <span className={`text-[13px] flex-1 ${a.selected ? 'text-white' : 'text-[#888]'}`}>
                {a.name}
              </span>
              {a.isAgent && (
                <span className="bg-[#1a1a1a] border border-white/[0.08] text-[10px] text-[#666] px-1.5 py-0.5 rounded">
                  Agent
                </span>
              )}
              {a.selected && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
