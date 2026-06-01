'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme()
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      aria-pressed={theme === 'dark'}
      className={`p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors ${className ?? ''}`}
    >
      {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  )
}
