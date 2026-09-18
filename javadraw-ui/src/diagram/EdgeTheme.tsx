import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { edgePalette, type EdgePalette } from '../theme'

const EdgeThemeContext = createContext<EdgePalette>(edgePalette(false))

/** Edges and markers paint themselves with concrete colours so the PNG export keeps them. */
export function EdgeThemeProvider({ dark, children }: { dark: boolean; children: ReactNode }) {
  const palette = useMemo(() => edgePalette(dark), [dark])
  return <EdgeThemeContext.Provider value={palette}>{children}</EdgeThemeContext.Provider>
}

export function useEdgeTheme(): EdgePalette {
  return useContext(EdgeThemeContext)
}
