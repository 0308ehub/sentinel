import Link from 'next/link'

interface SentinelLogoProps {
  className?: string
}

export function SentinelLogo({ className }: SentinelLogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ''}`}>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        {/* outer arc */}
        <path d="M2 18 C2 9 9 2 18 2" stroke="white" strokeWidth="1.75" strokeLinecap="round" />
        {/* mid arc */}
        <path d="M2 18 C2 12 8 6 14 6" stroke="white" strokeWidth="1.75" strokeLinecap="round" opacity="0.65" />
        {/* inner arc */}
        <path d="M2 18 C2 14.5 5.5 11 9 11" stroke="white" strokeWidth="1.75" strokeLinecap="round" opacity="0.35" />
        {/* dot */}
        <circle cx="2" cy="18" r="2" fill="white" />
      </svg>
      <span className="font-semibold text-[15px] tracking-tight text-white">Sentinel</span>
    </div>
  )
}
