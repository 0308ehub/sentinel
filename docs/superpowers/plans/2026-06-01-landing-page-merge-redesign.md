# Landing Page Merge + Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the Sentinel-AI-Website landing page into sentinel-next, replace the static kanban mockup with an animated Linear-style AI demo window, add a dark/light mode toggle, and make the nav auth-aware using Clerk.

**Architecture:** The landing page lives at `app/(marketing)/` as a route group with its own layout (no sidebar). The root `app/page.tsx` is deleted; `app/(marketing)/page.tsx` handles `/`. Auth state is read server-side via Clerk's `auth()` + `currentUser()`. Dark mode uses the existing `.dark` CSS class in globals.css; a `ThemeProvider` client component toggles it on `<html>`.

**Tech Stack:** Next.js 16 App Router, React 19, Clerk v7, Prisma + Neon (PostgreSQL), Tailwind v4 + shadcn/ui, Lucide React

---

## File Map

| Status | Path | Purpose |
|--------|------|---------|
| DELETE | `app/page.tsx` | Old redirect — replaced by (marketing)/page.tsx |
| CREATE | `app/(marketing)/layout.tsx` | Marketing shell: no sidebar, wraps sections |
| CREATE | `app/(marketing)/page.tsx` | Landing page root — assembles all sections |
| CREATE | `app/(marketing)/components/MarketingNav.tsx` | Auth-aware nav + theme toggle |
| CREATE | `app/(marketing)/components/Hero.tsx` | Hero section with animated demo |
| CREATE | `app/(marketing)/components/SentinelDemo.tsx` | Animated Linear-style app window |
| CREATE | `app/(marketing)/components/HowItWorks.tsx` | 3-step feature section |
| CREATE | `app/(marketing)/components/ProductOverview.tsx` | 3 features with mini mockups |
| CREATE | `app/(marketing)/components/CTASection.tsx` | Bottom CTA + waitlist |
| CREATE | `app/(marketing)/components/Footer.tsx` | Footer with links |
| CREATE | `components/theme-provider.tsx` | Client component: localStorage + dark class on html |
| CREATE | `components/theme-toggle.tsx` | Sun/moon toggle button |
| MODIFY | `app/layout.tsx` | Wrap with ThemeProvider |
| MODIFY | `app/globals.css` | Add --brand color token |
| MODIFY | `prisma/schema.prisma` | Add WaitlistEntry model |
| CREATE | `app/api/waitlist/route.ts` | Waitlist signup → Neon via Prisma |

---

## Task 1: ThemeProvider + ThemeToggle

**Files:**
- Create: `components/theme-provider.tsx`
- Create: `components/theme-toggle.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Create ThemeProvider**

```tsx
// components/theme-provider.tsx
'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: 'light',
  toggle: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    const stored = localStorage.getItem('sentinel-theme') as Theme | null
    if (stored === 'dark' || stored === 'light') setTheme(stored)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('sentinel-theme', theme)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, toggle: () => setTheme(t => t === 'light' ? 'dark' : 'light') }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
```

- [ ] **Step 2: Create ThemeToggle**

```tsx
// components/theme-toggle.tsx
'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      className={`p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors ${className ?? ''}`}
      aria-label="Toggle dark mode"
    >
      {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  )
}
```

- [ ] **Step 3: Wrap app/layout.tsx with ThemeProvider**

Current `app/layout.tsx` content:
```tsx
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Sentinel — Cursor for Product Managers",
  description: "Upload customer evidence. Find what to build next. Generate PRDs and engineering tickets.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}>
        <body className="min-h-full bg-background text-foreground">
          {children}
          <Toaster richColors position="top-right" />
        </body>
      </html>
    </ClerkProvider>
  );
}
```

Replace with:
```tsx
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Sentinel — The Autonomous PM",
  description: "Sentinel scans your connectors, surfaces insights, and autonomously manages your product backlog.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`} suppressHydrationWarning>
        <body className="min-h-full bg-background text-foreground">
          <ThemeProvider>
            {children}
          </ThemeProvider>
          <Toaster richColors position="top-right" />
        </body>
      </html>
    </ClerkProvider>
  );
}
```

- [ ] **Step 4: Add brand color token to globals.css**

Add these lines inside `@theme inline { ... }` in `app/globals.css`:
```css
  --color-brand: var(--brand);
  --color-brand-foreground: var(--brand-foreground);
```

Add after the `:root { ... }` block and before `.dark { ... }`:
```css
:root {
  /* existing variables ... */
  --brand: oklch(0.72 0.14 75);
  --brand-foreground: oklch(0.15 0 0);
}

.dark {
  /* existing variables ... */
  --brand: oklch(0.78 0.14 75);
  --brand-foreground: oklch(0.10 0 0);
}
```

- [ ] **Step 5: Commit**

```bash
git add components/theme-provider.tsx components/theme-toggle.tsx app/layout.tsx app/globals.css
git commit -m "feat: add ThemeProvider, ThemeToggle, and brand color token"
```

---

## Task 2: WaitlistEntry model + API route

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `app/api/waitlist/route.ts`

- [ ] **Step 1: Add WaitlistEntry to schema.prisma**

At the end of `prisma/schema.prisma`, add:
```prisma
model WaitlistEntry {
  id       String   @id @default(cuid())
  email    String   @unique
  joinedAt DateTime @default(now())
}
```

- [ ] **Step 2: Push schema to database**

```bash
cd /Users/alanwei/Desktop/sentinel-next
npx prisma db push
```

Expected output: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Create waitlist API route**

```ts
// app/api/waitlist/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
    }
    await prisma.waitlistEntry.upsert({
      where: { email },
      update: {},
      create: { email },
    })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma app/api/waitlist/route.ts
git commit -m "feat: add WaitlistEntry model and waitlist API route via Prisma"
```

---

## Task 3: Marketing route group + layout

**Files:**
- Delete: `app/page.tsx`
- Create: `app/(marketing)/layout.tsx`

- [ ] **Step 1: Delete the old root page**

```bash
rm /Users/alanwei/Desktop/sentinel-next/app/page.tsx
```

- [ ] **Step 2: Create marketing layout**

```tsx
// app/(marketing)/layout.tsx
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/(marketing)/layout.tsx
git rm app/page.tsx
git commit -m "feat: create (marketing) route group layout, remove old redirect root"
```

---

## Task 4: MarketingNav — auth-aware with theme toggle

**Files:**
- Create: `app/(marketing)/components/MarketingNav.tsx`

- [ ] **Step 1: Create MarketingNav**

This is a **Server Component** — it reads Clerk auth, then renders different nav items.

```tsx
// app/(marketing)/components/MarketingNav.tsx
import { auth, currentUser } from '@clerk/nextjs/server'
import Link from 'next/link'
import Image from 'next/image'
import { ThemeToggle } from '@/components/theme-toggle'

export async function MarketingNav() {
  const { userId } = await auth()
  const user = userId ? await currentUser() : null

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <nav className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-brand flex items-center justify-center">
            <span className="text-brand-foreground text-xs font-bold">S</span>
          </div>
          <span className="font-semibold text-sm tracking-tight text-foreground">Sentinel</span>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5"
              >
                Dashboard
              </Link>
              <Link
                href="/dashboard"
                className="flex items-center gap-2 text-sm font-medium bg-foreground text-background px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
              >
                {user.imageUrl ? (
                  <Image
                    src={user.imageUrl}
                    alt={user.firstName ?? 'User'}
                    width={20}
                    height={20}
                    className="rounded-full"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-brand flex items-center justify-center">
                    <span className="text-brand-foreground text-[10px] font-bold">
                      {(user.firstName?.[0] ?? user.emailAddresses[0]?.emailAddress?.[0] ?? 'U').toUpperCase()}
                    </span>
                  </div>
                )}
                {user.firstName ?? 'Account'}
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5"
              >
                Sign in
              </Link>
              <a
                href="#waitlist"
                className="text-sm font-medium bg-foreground text-background px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
              >
                Get early access
              </a>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(marketing)/components/MarketingNav.tsx"
git commit -m "feat: auth-aware MarketingNav with Clerk session and theme toggle"
```

---

## Task 5: SentinelDemo animated component

**Files:**
- Create: `app/(marketing)/components/SentinelDemo.tsx`

This is the animated Linear-style dark app window shown in the hero. It auto-plays a loop of Sentinel working through a task.

- [ ] **Step 1: Create SentinelDemo**

```tsx
// app/(marketing)/components/SentinelDemo.tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add "app/(marketing)/components/SentinelDemo.tsx"
git commit -m "feat: SentinelDemo animated Linear-style app window with typewriter loop"
```

---

## Task 6: Hero section

**Files:**
- Create: `app/(marketing)/components/Hero.tsx`

The hero is a Server Component that checks auth to conditionally show the waitlist form (logged-out) or a "Go to Dashboard" CTA (logged-in). SentinelDemo is imported as a client component.

- [ ] **Step 1: Create Hero**

```tsx
// app/(marketing)/components/Hero.tsx
import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'
import { SentinelDemo } from './SentinelDemo'
import { WaitlistForm } from './WaitlistForm'

export async function Hero() {
  const { userId } = await auth()

  return (
    <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 md:pt-28 md:pb-20">
      <div className="max-w-3xl mx-auto text-center mb-12">
        {/* Eyebrow */}
        <div className="inline-flex items-center gap-2 border border-border px-3 py-1 rounded-full mb-7">
          <span className="w-1.5 h-1.5 bg-brand rounded-full animate-pulse" />
          <span className="text-xs font-medium text-muted-foreground">Early Access — Limited Spots</span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-semibold text-foreground leading-[1.05] tracking-tight mb-5">
          The first AI that{' '}
          <span className="text-brand">runs your projects</span>
        </h1>

        {/* Subheadline */}
        <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-10">
          Sentinel scans your connectors hourly, surfaces insights, and autonomously generates tickets — so your team ships instead of manages.
        </p>

        {/* CTA */}
        {userId ? (
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/dashboard"
              className="bg-foreground text-background px-5 py-2.5 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity"
            >
              Go to Dashboard →
            </Link>
          </div>
        ) : (
          <div id="waitlist">
            <WaitlistForm />
            <p className="text-xs text-muted-foreground mt-3">
              No credit card required.
            </p>
          </div>
        )}
      </div>

      {/* Demo window */}
      <div className="relative max-w-4xl mx-auto">
        <SentinelDemo />
        {/* Floating badge */}
        <div className="absolute -right-3 -top-3 bg-background border border-border rounded-xl px-3 py-2 shadow-lg text-left hidden md:block">
          <p className="text-xs font-semibold text-foreground">4.2 hrs saved</p>
          <p className="text-xs text-muted-foreground">this sprint</p>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Create WaitlistForm client component**

The form needs to be a client component for `useState`.

```tsx
// app/(marketing)/components/WaitlistForm.tsx
'use client'

import { useState } from 'react'

export function WaitlistForm() {
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
          You're on the list — we'll reach out soon.
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
        className="flex-1 px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 transition-all"
      />
      <button
        type="submit"
        disabled={loading}
        className="bg-foreground text-background px-5 py-2.5 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 whitespace-nowrap"
      >
        {loading ? 'Joining…' : 'Get Early Access'}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add "app/(marketing)/components/Hero.tsx" "app/(marketing)/components/WaitlistForm.tsx"
git commit -m "feat: Hero section with auth-aware CTA and SentinelDemo integration"
```

---

## Task 7: HowItWorks + ProductOverview sections

**Files:**
- Create: `app/(marketing)/components/HowItWorks.tsx`
- Create: `app/(marketing)/components/ProductOverview.tsx`

- [ ] **Step 1: Create HowItWorks**

```tsx
// app/(marketing)/components/HowItWorks.tsx
const steps = [
  {
    num: '01',
    title: 'Connect your stack',
    body: 'Link Gmail, Linear, Slack, or Notion. Sentinel scans hourly with zero manual setup.',
  },
  {
    num: '02',
    title: 'Surface what matters',
    body: 'Sentinel reads signals, scores relevance, and surfaces the insights worth acting on.',
  },
  {
    num: '03',
    title: 'Ship autonomously',
    body: 'Review queued actions in your Inbox. Approve once and Sentinel handles the rest — tickets, PRDs, Linear sync.',
  },
]

export function HowItWorks() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-20 border-t border-border">
      <div className="text-center mb-14">
        <p className="text-xs font-semibold text-brand uppercase tracking-widest mb-3">How it works</p>
        <h2 className="text-3xl md:text-4xl font-semibold text-foreground tracking-tight">
          From signal to shipped — automatically
        </h2>
      </div>

      <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
        {steps.map(step => (
          <div key={step.num} className="relative">
            <span className="text-5xl font-bold text-muted/30 leading-none select-none block mb-4">
              {step.num}
            </span>
            <h3 className="text-base font-semibold text-foreground mb-2">{step.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Create ProductOverview**

```tsx
// app/(marketing)/components/ProductOverview.tsx
const features = [
  {
    title: 'Autonomous inbox',
    body: 'Sentinel queues actions for your review. One click to approve — it handles the execution.',
    visual: (
      <div className="space-y-2">
        {[
          { label: 'Create ENG-042 from insight', badge: 'Pending' },
          { label: 'Sync opportunity to Linear', badge: 'Pending' },
          { label: 'Draft PRD: Onboarding v2', badge: 'Approved' },
        ].map(item => (
          <div key={item.label} className="flex items-center justify-between px-3 py-2 rounded-lg bg-background border border-border">
            <span className="text-xs text-foreground truncate">{item.label}</span>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
              item.badge === 'Approved'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
            }`}>
              {item.badge}
            </span>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: 'Semantic search',
    body: 'Ask anything across all your ingested documents. pgvector-powered similarity search.',
    visual: (
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background border border-border">
          <span className="text-muted-foreground text-xs">⌕</span>
          <span className="text-xs text-muted-foreground">What are users saying about onboarding?</span>
        </div>
        {['User interview — Jul 2024', 'Support ticket #1482', 'NPS survey Q2'].map(r => (
          <div key={r} className="px-3 py-2 rounded-lg bg-muted/50 border border-border">
            <p className="text-xs text-foreground">{r}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: 'Linear sync',
    body: 'Tickets generated by Sentinel push directly to your Linear workspace — with proper priority, labels, and estimates.',
    visual: (
      <div className="space-y-2">
        {[
          { id: 'ENG-041', title: 'Auth system redesign', status: 'In Progress' },
          { id: 'ENG-042', title: 'Streamline onboarding', status: 'Backlog' },
          { id: 'ENG-043', title: 'API rate limiting', status: 'Backlog' },
        ].map(t => (
          <div key={t.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background border border-border">
            <span className="text-[10px] text-muted-foreground font-mono">{t.id}</span>
            <span className="text-xs text-foreground flex-1 truncate">{t.title}</span>
            <span className={`text-[10px] ${t.status === 'In Progress' ? 'text-brand' : 'text-muted-foreground'}`}>
              {t.status}
            </span>
          </div>
        ))}
      </div>
    ),
  },
]

export function ProductOverview() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-20 border-t border-border">
      <div className="text-center mb-14">
        <p className="text-xs font-semibold text-brand uppercase tracking-widest mb-3">Product</p>
        <h2 className="text-3xl md:text-4xl font-semibold text-foreground tracking-tight">
          Everything your PM wishes existed
        </h2>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {features.map(f => (
          <div key={f.title} className="rounded-xl border border-border p-5 bg-card flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1.5">{f.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{f.body}</p>
            </div>
            <div className="mt-auto">{f.visual}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add "app/(marketing)/components/HowItWorks.tsx" "app/(marketing)/components/ProductOverview.tsx"
git commit -m "feat: HowItWorks and ProductOverview sections with live mini mockups"
```

---

## Task 8: CTASection + Footer

**Files:**
- Create: `app/(marketing)/components/CTASection.tsx`
- Create: `app/(marketing)/components/Footer.tsx`

- [ ] **Step 1: Create CTASection**

```tsx
// app/(marketing)/components/CTASection.tsx
import { WaitlistForm } from './WaitlistForm'

export function CTASection() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-20 border-t border-border">
      <div className="max-w-xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-semibold text-foreground tracking-tight mb-4">
          Ready to ship faster?
        </h2>
        <p className="text-muted-foreground mb-8 text-sm leading-relaxed">
          Join teams using Sentinel to cut PM overhead and ship what users actually want.
        </p>
        <WaitlistForm />
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Create Footer**

```tsx
// app/(marketing)/components/Footer.tsx
import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-brand flex items-center justify-center">
            <span className="text-brand-foreground text-[10px] font-bold">S</span>
          </div>
          <span className="text-sm font-semibold text-foreground">Sentinel</span>
        </div>
        <div className="flex items-center gap-6 text-xs text-muted-foreground">
          <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          <span>© 2025 Sentinel AI</span>
        </div>
      </div>
    </footer>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add "app/(marketing)/components/CTASection.tsx" "app/(marketing)/components/Footer.tsx"
git commit -m "feat: CTASection and Footer components"
```

---

## Task 9: Assemble landing page root

**Files:**
- Create: `app/(marketing)/page.tsx`

- [ ] **Step 1: Create the landing page**

```tsx
// app/(marketing)/page.tsx
import { MarketingNav } from './components/MarketingNav'
import { Hero } from './components/Hero'
import { HowItWorks } from './components/HowItWorks'
import { ProductOverview } from './components/ProductOverview'
import { CTASection } from './components/CTASection'
import { Footer } from './components/Footer'

export default function LandingPage() {
  return (
    <>
      <MarketingNav />
      <main>
        <Hero />
        <HowItWorks />
        <ProductOverview />
        <CTASection />
      </main>
      <Footer />
    </>
  )
}
```

- [ ] **Step 2: Build and verify**

```bash
cd /Users/alanwei/Desktop/sentinel-next
npm run build
```

Expected: clean build with no TypeScript or import errors. Fix any errors before committing.

- [ ] **Step 3: Commit**

```bash
git add "app/(marketing)/page.tsx"
git commit -m "feat: assemble landing page with all sections"
```

---

## Task 10: Push + deploy

- [ ] **Step 1: Push to main**

```bash
git push origin main
```

- [ ] **Step 2: Verify Vercel deployment**

Watch build logs at the Vercel dashboard. Confirm landing page loads at the deployment URL.

- [ ] **Step 3: Domain migration (manual — do after deploy confirms green)**

In the Vercel dashboard:
1. Open the `sentinel-next` project → Settings → Domains
2. Add your current `Sentinel-AI-Website` production domain
3. Follow Vercel's DNS instructions to point the domain to `sentinel-next`
4. Archive or delete the `Sentinel-AI-Website` Vercel project

---

## Stream 3 Preview (next plan)

After stream 1+2 are deployed, the product dark mode plan covers:
- Dashboard layout + sidebar
- Workspace overview, documents, opportunities, tickets
- Inbox, search, connectors
- All shadcn/ui component dark variants (most work automatically via the CSS variables already set in globals.css)

The `.dark {}` CSS block is already defined — most shadcn components just work. The main work is auditing any hardcoded colors (e.g., `bg-gray-50`, `text-gray-600`) in custom components and replacing them with semantic tokens (`bg-muted`, `text-muted-foreground`).
