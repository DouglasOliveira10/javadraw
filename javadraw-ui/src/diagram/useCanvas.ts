import { useCallback, useEffect, useReducer } from 'react'
import { CANVAS_VERSION, canvasReducer, emptyCanvas, type CanvasAction, type CanvasState } from './canvasState'

function storageKey(project: string): string {
  return `javadraw.diagram.${project}`
}

/** Canvas state with autosave; storage is best effort (it can be blocked on file:// or in private windows). */
export function useCanvas(project: string) {
  const [state, dispatch] = useReducer(canvasReducer, project, (p) => restore(p) ?? emptyCanvas(p))

  useEffect(() => {
    try {
      if (state.nodes.length === 0) localStorage.removeItem(storageKey(project))
      else localStorage.setItem(storageKey(project), JSON.stringify(state))
    } catch {
      // storage unavailable
    }
  }, [state, project])

  const exportJson = useCallback(() => JSON.stringify(state, null, 2), [state])

  const importJson = useCallback((text: string) => {
    const parsed = parseCanvas(text)
    dispatch({ type: 'replace', state: parsed })
  }, [])

  return { state, dispatch: dispatch as (action: CanvasAction) => void, exportJson, importJson }
}

export function parseCanvas(text: string): CanvasState {
  const parsed: unknown = JSON.parse(text)
  if (!isCanvasState(parsed)) throw new Error('Not a JavaDraw diagram file')
  if (parsed.version !== CANVAS_VERSION) throw new Error(`Unsupported diagram version: ${String(parsed.version)}`)
  return parsed
}

function restore(project: string): CanvasState | null {
  try {
    const stored = localStorage.getItem(storageKey(project))
    if (!stored) return null
    const parsed = parseCanvas(stored)
    return parsed.project === project ? parsed : null
  } catch {
    return null
  }
}

function isCanvasState(value: unknown): value is CanvasState {
  const candidate = value as CanvasState | null
  return (
    !!candidate &&
    typeof candidate === 'object' &&
    typeof candidate.project === 'string' &&
    Array.isArray(candidate.nodes) &&
    Array.isArray(candidate.edges)
  )
}
