import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { DEFAULT_PALETTE, type Palette } from '../theme'

const STORAGE_KEY = 'javadraw.colors'

const PaletteContext = createContext<Palette>(DEFAULT_PALETTE)

/** The colours the cards and badges paint themselves with; chosen by the user and remembered. */
export function usePalette(): Palette {
  return useContext(PaletteContext)
}

export interface PaletteControls {
  palette: Palette
  setKindColor: (kind: string, color: string) => void
  setStereotypeColor: (stereotype: string, color: string) => void
  reset: () => void
}

export function usePaletteState(): PaletteControls {
  const [palette, setPalette] = useState<Palette>(() => restore() ?? DEFAULT_PALETTE)

  useEffect(() => {
    try {
      if (palette === DEFAULT_PALETTE) localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, JSON.stringify(palette))
    } catch {
      // storage unavailable
    }
  }, [palette])

  const setKindColor = useCallback((kind: string, color: string) => {
    setPalette((current) => ({ ...current, kinds: { ...current.kinds, [kind]: color } }))
  }, [])

  const setStereotypeColor = useCallback((stereotype: string, color: string) => {
    setPalette((current) => ({ ...current, stereotypes: { ...current.stereotypes, [stereotype]: color } }))
  }, [])

  const reset = useCallback(() => setPalette(DEFAULT_PALETTE), [])

  return { palette, setKindColor, setStereotypeColor, reset }
}

export function PaletteProvider({ palette, children }: { palette: Palette; children: ReactNode }) {
  return <PaletteContext.Provider value={palette}>{children}</PaletteContext.Provider>
}

/** Merges whatever was stored over the defaults, so colours added later still have a value. */
function restore(): Palette | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    const parsed = JSON.parse(stored) as Partial<Palette>
    return {
      kinds: { ...DEFAULT_PALETTE.kinds, ...(parsed.kinds ?? {}) },
      stereotypes: { ...DEFAULT_PALETTE.stereotypes, ...(parsed.stereotypes ?? {}) },
    }
  } catch {
    return null
  }
}
