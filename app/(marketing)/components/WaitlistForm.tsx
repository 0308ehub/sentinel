'use client'

import { useState } from 'react'

export function WaitlistForm({ dark }: { dark?: boolean }) {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    try {
      await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
    } finally {
      setSubmitted(true)
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="flex items-center justify-center gap-2 max-w-sm mx-auto p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl">
        <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span className="text-emerald-700 dark:text-emerald-400 font-medium text-sm">
          You&apos;re on the list — we&apos;ll reach out soon.
        </span>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 max-w-sm mx-auto">
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="you@company.com"
        required
        className={`flex-1 px-4 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 transition-all ${
          dark
            ? 'bg-white/10 border-white/20 text-white placeholder:text-white/40'
            : 'bg-background border-border text-foreground placeholder:text-muted-foreground'
        }`}
      />
      <button
        type="submit"
        disabled={loading}
        className={`px-5 py-2.5 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 whitespace-nowrap ${
          dark ? 'bg-brand text-brand-foreground' : 'bg-foreground text-background'
        }`}
      >
        {loading ? 'Joining…' : 'Get Early Access'}
      </button>
    </form>
  )
}
