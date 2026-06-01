'use client'

import { useEffect, useState } from 'react'

const OPPORTUNITIES = [
  {
    score: 94,
    label: 'iOS app performance',
    tag: 'Mobile',
    signals: 12,
    scoreColor: 'text-green-400',
    scoreBg: 'bg-green-900/40',
  },
  {
    score: 87,
    label: 'Onboarding friction',
    tag: 'Growth',
    signals: 8,
    scoreColor: 'text-yellow-400',
    scoreBg: 'bg-yellow-900/40',
  },
  {
    score: 73,
    label: 'Missing bulk actions',
    tag: 'UX',
    signals: 5,
    scoreColor: 'text-orange-400',
    scoreBg: 'bg-orange-900/40',
  },
]

type Phase = 'analyzing' | 'revealing' | 'complete'

export function HeroDemo() {
  const [phase, setPhase] = useState<Phase>('analyzing')
  const [visibleCount, setVisibleCount] = useState(0)
  const [dots, setDots] = useState('.')

  useEffect(() => {
    if (phase !== 'analyzing') return
    const id = setInterval(() => {
      setDots(d => (d.length >= 3 ? '.' : d + '.'))
    }, 380)
    return () => clearInterval(id)
  }, [phase])

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []

    const runCycle = () => {
      timers.forEach(clearTimeout)
      timers.length = 0
      setPhase('analyzing')
      setVisibleCount(0)

      timers.push(
        setTimeout(() => {
          setPhase('revealing')
          timers.push(setTimeout(() => setVisibleCount(1), 350))
          timers.push(setTimeout(() => setVisibleCount(2), 1000))
          timers.push(setTimeout(() => setVisibleCount(3), 1650))
          timers.push(setTimeout(() => setPhase('complete'), 2600))
        }, 2000),
      )
    }

    runCycle()
    const intervalId = setInterval(runCycle, 9000)
    return () => {
      timers.forEach(clearTimeout)
      clearInterval(intervalId)
    }
  }, [])

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#161b22] overflow-hidden shadow-2xl">
      {/* Browser chrome */}
      <div className="bg-[#0d1117] border-b border-white/[0.06] px-4 py-2.5 flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#2d333b]" />
          <span className="w-3 h-3 rounded-full bg-[#2d333b]" />
          <span className="w-3 h-3 rounded-full bg-[#2d333b]" />
        </div>
        <div className="bg-[#1c2128] rounded-md px-3 py-1 text-[11px] text-[#556] flex-1 max-w-xs">
          app.sentinel.ai/workspaces/acme
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 motion-safe:animate-pulse" />
          <span className="text-[10px] text-[#556]">live</span>
        </div>
      </div>

      <div className="p-5">
        {/* Agent status bar */}
        <div className="flex items-center gap-3 mb-5 p-3 rounded-lg bg-[#0d1117] border border-white/[0.06]">
          <div className="w-7 h-7 rounded-full bg-[#5b6af9]/20 border border-[#5b6af9]/30 flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-[#5b6af9]" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M5.5 8.5L7 10l3.5-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-medium text-white">Sentinel Agent</div>
            <div className="text-[11px] text-[#556] truncate">
              {phase === 'analyzing'
                ? `Scanning 247 signals${dots}`
                : phase === 'revealing'
                ? 'Ranking by impact score'
                : '3 opportunities · 2 tickets ready'}
            </div>
          </div>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 transition-colors duration-300 ${
              phase === 'complete'
                ? 'bg-green-900/40 text-green-400'
                : 'bg-[#5b6af9]/20 text-[#5b6af9]'
            }`}
          >
            {phase === 'complete' ? 'Done' : 'Running'}
          </span>
        </div>

        {/* Section label */}
        <div className="text-[10px] text-[#444] uppercase tracking-widest mb-2.5 px-0.5">Top Opportunities</div>

        {/* Opportunity cards */}
        <div className="space-y-2">
          {OPPORTUNITIES.map((opp, i) => (
            <div
              key={opp.label}
              className={[
                'bg-[#0d1117] rounded-lg p-3 flex items-center justify-between gap-3 border',
                'motion-safe:transition-all motion-safe:duration-500',
                'motion-reduce:opacity-100 motion-reduce:translate-y-0',
                i < visibleCount
                  ? 'opacity-100 translate-y-0 border-white/[0.08]'
                  : 'opacity-0 translate-y-2 border-transparent',
              ].join(' ')}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`text-[11px] font-bold tabular-nums w-8 text-center rounded px-1.5 py-0.5 flex-shrink-0 ${opp.scoreBg} ${opp.scoreColor}`}
                >
                  {opp.score}
                </span>
                <span className="text-[12px] text-white truncate">{opp.label}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[10px] text-[#556] border border-white/[0.08] rounded px-1.5 py-0.5">
                  {opp.tag}
                </span>
                <span className="text-[10px] text-[#444]">{opp.signals} signals</span>
              </div>
            </div>
          ))}
        </div>

        {/* Connector status */}
        <div className="mt-5 pt-4 border-t border-white/[0.06] flex items-center gap-4">
          {[
            { name: 'Slack', color: 'bg-green-500', delay: '0s' },
            { name: 'Linear', color: 'bg-purple-500', delay: '0.25s' },
            { name: 'GitHub', color: 'bg-blue-500', delay: '0.5s' },
          ].map(c => (
            <div key={c.name} className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${c.color} flex-shrink-0 motion-safe:animate-pulse`}
                style={{ animationDelay: c.delay }}
              />
              <span className="text-[11px] text-[#556]">{c.name}</span>
            </div>
          ))}
          <span className="ml-auto text-[10px] text-[#333]">3 active</span>
        </div>
      </div>
    </div>
  )
}
