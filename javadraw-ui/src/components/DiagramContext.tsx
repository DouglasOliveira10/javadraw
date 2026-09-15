import { createContext, useContext } from 'react'

export interface DiagramActions {
  selectedId: string | null
  expandType: (typeId: string) => void
  expandMethod: (methodId: string) => void
  focusType: (typeId: string) => void
  openFlow: (methodId: string) => void
}

const noop = () => {}

export const DiagramContext = createContext<DiagramActions>({
  selectedId: null,
  expandType: noop,
  expandMethod: noop,
  focusType: noop,
  openFlow: noop,
})

export function useDiagramActions(): DiagramActions {
  return useContext(DiagramContext)
}
