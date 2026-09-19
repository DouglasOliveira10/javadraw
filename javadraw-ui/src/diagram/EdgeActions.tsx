import { createContext, useContext } from 'react'
import type { XY } from './canvasState'

export interface EdgeActions {
  /** Persists the bend points after the user drops one; an empty list straightens the edge again. */
  setWaypoints: (edgeId: string, points: XY[]) => void
}

const EdgeActionsContext = createContext<EdgeActions>({ setWaypoints: () => {} })

export const EdgeActionsProvider = EdgeActionsContext.Provider

export function useEdgeActions(): EdgeActions {
  return useContext(EdgeActionsContext)
}
