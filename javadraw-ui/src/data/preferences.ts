import { useEffect, useState } from 'react'

/**
 * A boolean remembered in localStorage. Storage can be blocked (file:// pages, private windows), so both
 * reading and writing are best effort and the app keeps working without it.
 */
export function useStoredFlag(key: string, fallback: () => boolean): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key)
      if (stored !== null) return stored === 'true'
    } catch {
      // storage unavailable
    }
    return fallback()
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, String(value))
    } catch {
      // storage unavailable
    }
  }, [key, value])

  return [value, setValue]
}

export function prefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}
