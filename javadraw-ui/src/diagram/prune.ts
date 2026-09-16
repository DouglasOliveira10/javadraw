import type { GraphIndex } from '../data/graphIndex'
import { callEdgeId, relationEdgeId, type CanvasState } from './canvasState'

export interface PruneResult {
  state: CanvasState
  /** Display names of the cards whose class is gone from the analyzed project. */
  droppedTypes: string[]
  /** Edges whose relation or call no longer exists in the bytecode. */
  droppedEdges: number
}

/**
 * A stored diagram can outlive the code it describes: classes get renamed, fields removed, calls dropped.
 * Everything that no longer exists in the freshly analyzed graph is discarded on load.
 */
export function pruneCanvas(state: CanvasState, index: GraphIndex): PruneResult {
  const known = edgeIds(index)
  const droppedTypes: string[] = []

  const nodes = state.nodes
    .filter((node) => {
      if (index.types.has(node.id)) return true
      droppedTypes.push(node.id.substring(node.id.lastIndexOf('.') + 1))
      return false
    })
    .map((node) => {
      const type = index.types.get(node.id)!
      const fields = node.visibleFields.filter((name) => (type.fields ?? []).some((f) => f.name === name))
      const methods = node.visibleMethods.filter((id) => (type.methods ?? []).some((m) => m.id === id))
      return fields.length === node.visibleFields.length && methods.length === node.visibleMethods.length
        ? node
        : { ...node, visibleFields: fields, visibleMethods: methods }
    })

  const ids = new Set(nodes.map((n) => n.id))
  const edges = state.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target) && known.has(edge.id))

  if (droppedTypes.length === 0 && edges.length === state.edges.length && nodes.every((n, i) => n === state.nodes[i])) {
    return { state, droppedTypes, droppedEdges: 0 }
  }
  return { state: { ...state, nodes, edges }, droppedTypes, droppedEdges: state.edges.length - edges.length }
}

/** Every edge the analyzed project can justify, by the same ids the reducer assigns. */
function edgeIds(index: GraphIndex): Set<string> {
  const ids = new Set<string>()
  for (const relation of index.graph.relations ?? []) ids.add(relationEdgeId(relation))
  for (const call of index.graph.calls ?? []) ids.add(callEdgeId(call))
  return ids
}
