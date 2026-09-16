import { useCallback, useEffect, useReducer, useState } from 'react'
import type { GraphIndex } from '../data/graphIndex'
import { CANVAS_VERSION, canvasReducer, emptyCanvas, type CanvasAction, type CanvasState } from './canvasState'
import { pruneCanvas, type PruneResult } from './prune'

function storageKey(project: string): string {
  return `javadraw.diagram.${project}`
}

/** Canvas state with autosave; storage is best effort (it can be blocked on file:// or in private windows). */
export function useCanvas(index: GraphIndex) {
  const project = index.graph.meta.name
  // A stored diagram may describe code that changed since; whatever is gone is dropped on load.
  const [restored] = useState(() => {
    const stored = restore(project)
    return stored ? pruneCanvas(stored, index) : null
  })
  const [state, dispatch] = useReducer(canvasReducer, restored?.state ?? emptyCanvas(project))

  useEffect(() => {
    try {
      if (state.nodes.length === 0) localStorage.removeItem(storageKey(project))
      else localStorage.setItem(storageKey(project), JSON.stringify(state))
    } catch {
      // storage unavailable
    }
  }, [state, project])

  const exportJson = useCallback(() => JSON.stringify(state, null, 2), [state])

  const importJson = useCallback(
    (text: string): PruneResult => {
      const pruned = pruneCanvas(parseCanvas(text), index)
      dispatch({ type: 'replace', state: pruned.state })
      return pruned
    },
    [index],
  )

  return { state, dispatch: dispatch as (action: CanvasAction) => void, exportJson, importJson, restored }
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
