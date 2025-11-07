'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

type Theme = 'light' | 'dark'

type ThemeContextType = {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  mounted: boolean
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const THEME_STORAGE_KEY = 'theme'

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'

  // First check what the blocking script set on the DOM (source of truth)
  const root = document.documentElement
  if (root.classList.contains('dark')) return 'dark'

  // If no class, check localStorage (same logic as blocking script)
  const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null
  if (stored === 'light' || stored === 'dark') {
    return stored
  }

  // Fall back to system preference (same logic as blocking script)
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

type Props = {
  children: ReactNode
}

export function ThemeProvider({ children }: Props) {
  const [theme, setThemeState] = useState<Theme>(() => getInitialTheme())
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Defer all setState calls to avoid synchronous state updates in effect
    queueMicrotask(() => {
      setMounted(true)
      // Sync with DOM first (what blocking script set), then localStorage
      const root = document.documentElement
      if (root.classList.contains('dark')) {
        setThemeState('dark')
        return
      }

      // Check localStorage
      const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null
      if (stored === 'light' || stored === 'dark') {
        setThemeState(stored)
      } else {
        // If no stored value, check system preference
        const systemPrefersDark = window.matchMedia(
          '(prefers-color-scheme: dark)'
        ).matches
        const systemTheme: Theme = systemPrefersDark ? 'dark' : 'light'
        setThemeState(systemTheme)
      }
    })
  }, [])

  useEffect(() => {
    if (!mounted) return

    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(theme)
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme, mounted])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
  }

  const toggleTheme = () => {
    setThemeState(prev => (prev === 'light' ? 'dark' : 'light'))
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, mounted }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
