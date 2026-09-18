import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { MESSAGES, detectLocale, format, type Locale, type MessageKey } from './messages'

const STORAGE_KEY = 'javadraw.locale'

export type Values = Record<string, string | number>

export interface I18n {
  locale: Locale
  setLocale: (locale: Locale) => void
  /** Looks a string up and fills its `{placeholders}`. */
  t: (key: MessageKey, values?: Values) => string
  /** Counted strings: reads `key_one` or `key_other` and passes `count` along. */
  tc: (key: string, count: number, values?: Values) => string
}

const I18nContext = createContext<I18n | null>(null)

export function useI18n(): I18n {
  const context = useContext(I18nContext)
  if (!context) throw new Error('useI18n must be used inside an I18nProvider')
  return context
}

/** Remembers the chosen language; the first visit follows the browser and falls back to English. */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(initialLocale)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, locale)
    } catch {
      // storage unavailable
    }
    document.documentElement.lang = locale
  }, [locale])

  const t = useCallback(
    (key: MessageKey, values?: Values) => format(MESSAGES[locale][key] ?? MESSAGES.en[key] ?? key, values),
    [locale],
  )

  const tc = useCallback(
    (key: string, count: number, values?: Values) => {
      const plural = `${key}_${count === 1 ? 'one' : 'other'}` as MessageKey
      return t(plural, { count, ...values })
    },
    [t],
  )

  const value = useMemo<I18n>(() => ({ locale, setLocale, t, tc }), [locale, t, tc])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

function initialLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && stored in MESSAGES) return stored as Locale
  } catch {
    // storage unavailable
  }
  return detectLocale(navigator.languages?.length ? navigator.languages : [navigator.language ?? 'en'])
}
