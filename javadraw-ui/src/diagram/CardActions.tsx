import { createContext, useContext } from 'react'
import type { Size } from './canvasState'

export interface CardActions {
  /** Persists the size the user dragged the card to. */
  resize: (typeId: string, size: Size) => void
}

const CardActionsContext = createContext<CardActions>({ resize: () => {} })

export const CardActionsProvider = CardActionsContext.Provider

export function useCardActions(): CardActions {
  return useContext(CardActionsContext)
}
