'use client'

import { useEffect, useRef, useState } from 'react'

const SIDEBAR_ITEMS = [
  { label: 'Inbox', icon: '◉', active: false },
  { label: 'Documents', icon: '▤', active: false },
  { label: 'Opportunities', icon: '◈', active: false },
  { label: 'Tickets', icon: '◫', active: true },
]

type StepType = 'action' | 'discovery' | 'thinking' | 'success'

interface Step {
  text: string
  type: StepType
}

const STEPS: Step[] = [
  { text: 'Scanning Gmail connector...', type: 'action' },
  { text: 'Found 3 customer pain points', type: 'discovery' },
  { text: 'Analyzing: onboarding complexity', type: 'thinking' },
  { text: 'Generating ticket ENG-042...', type: 'action' },
  { text: 'ENG-042 created ✓', type: 'success' },
  { text: 'Syncing to Linear...', type: 'action' },
  { text: 'Done — 3 actions completed ✓', type: 'success' },
]

const STEP_COLORS: Record<StepType, string> = {
  action: 'text-blue-400',
  discovery: 'text-amber-400',
  thinking: 'text-zinc-400',
  success: 'text-emerald-400',
}

export function SentinelDemo() {
  const [visibleSteps, setVisibleSteps] = useState<Step[]>([])
  const [currentText, setCurrentText] = useState('')
  const [currentStepIdx, setCurrentStepIdx] = useState(0)
  const [charIdx, setCharIdx] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isComplete) {
      timeoutRef.current = setTimeout(() => {
        setVisibleSteps([])
        setCurrentText('')
        setCurrentStepIdx(0)
        setCharIdx(0)
        setIsComplete(false)
      }, 2500)
      return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
    }

    const step = STEPS[currentStepIdx]
    if (!step) return

    if (charIdx < step.text.length) {
      timeoutRef.current = setTimeout(() => {
        setCurrentText(step.text.slice(0, charIdx + 1))
        setCharIdx(c => c + 1)
      }, 35)
    } else {
      timeoutRef.current = setTimeout(() => {
        setVisibleSteps(prev => [...prev, step])
        setCurrentText('')
        const nextIdx = currentStepIdx + 1
        if (nextIdx >= STEPS.length) {
          setIsComplete(true)
        } else {
          setCurrentStepIdx(nextIdx)
          setCharIdx(0)
        }
      }, 500)
    }

    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
  }, [charIdx, currentStepIdx, isComplete])

  return (
    <div className="w-full rounded-xl overflow-hidden border border-white/8 shadow-2xl bg-zinc-900 text-sm font-mono select-none">
      {/* Window chrome */}
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/8 bg-zinc-950">
        <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
        <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
        <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
        <span className="ml-3 text-xs text-zinc-500 font-sans">sentinel — Acme Corp</span>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-emerald-400 font-sans">
          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse inline-block" />
          AI Active
        </span>
      </div>

      {/* Three-panel body */}
      <div className="grid grid-cols-[140px_1fr_220px] h-64">
        {/* Sidebar */}
        <div className="border-r border-white/8 py-3 px-2 flex flex-col gap-0.5">
          {SIDEBAR_ITEMS.map((item) => (
            <div
              key={item.label}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-sans ${
                item.active
                  ? 'bg-white/10 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <span className="text-[10px]">{item.icon}</span>
              {item.label}
            </div>
          ))}
        </div>

        {/* Main panel */}
        <div className="border-r border-white/8 p-4 flex flex-col gap-3">
          <div>
            <p className="text-[10px] text-zinc-500 font-sans uppercase tracking-wider mb-1">Active Ticket</p>
            <p className="text-xs text-zinc-100 font-sans font-medium">ENG-041 · Auth system redesign</p>
          </div>
          <div className="flex flex-col gap-1.5">
            {[
              { label: 'Status', value: 'In Progress', color: 'text-amber-400' },
              { label: 'Priority', value: 'High', color: 'text-red-400' },
              { label: 'Sprint', value: 'Q3 Sprint 2', color: 'text-zinc-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center gap-2 text-[11px] font-sans">
                <span className="text-zinc-600 w-14">{label}</span>
                <span className={color}>{value}</span>
              </div>
            ))}
          </div>
          <div className="mt-auto pt-2 border-t border-white/8">
            <p className="text-[10px] text-zinc-600 font-sans">Last scan: just now</p>
          </div>
        </div>

        {/* AI activity panel */}
        <div className="p-3 flex flex-col gap-2 overflow-hidden">
          <p className="text-[10px] text-zinc-500 font-sans uppercase tracking-wider">Sentinel</p>
          <div className="flex flex-col gap-1.5 overflow-y-auto flex-1">
            {visibleSteps.map((step, i) => (
              <div key={i} className={`text-[11px] leading-relaxed ${STEP_COLORS[step.type]}`}>
                {step.text}
              </div>
            ))}
            {currentText && (
              <div className={`text-[11px] leading-relaxed ${STEP_COLORS[STEPS[currentStepIdx]?.type ?? 'action']}`}>
                {currentText}
                <span className="animate-pulse">▌</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
