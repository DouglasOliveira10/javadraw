import { createContext, useContext } from 'react'
import type { EdgeAnchor, EdgeEnd, XY } from './canvasState'

export interface EdgeActions {
  /** Persists the bend points after the user drops one; an empty list straightens the edge again. */
  setWaypoints: (edgeId: string, points: XY[]) => void
  /** Pins one end of an edge to a point on a card's border, on the same card or another one. */
  moveEnd: (edgeId: string, end: EdgeEnd, typeId: string, anchor: EdgeAnchor) => void
}

const EdgeActionsContext = createContext<EdgeActions>({ setWaypoints: () => {}, moveEnd: () => {} })

export const EdgeActionsProvider = EdgeActionsContext.Provider

export function useEdgeActions(): EdgeActions {
  return useContext(EdgeActionsContext)
}
