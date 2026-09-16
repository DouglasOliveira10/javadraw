import type { Node } from '@xyflow/react'
import type { CanvasEdge, XY } from '../diagram/canvasState'
import type { Diagram, Size } from './diagram'
import { fromElkGraph, toElkGraph } from './elkLayout'
import { runElk } from './elkEngine'

/**
 * Runs ELK over the cards currently on the canvas and returns new positions. Only used by the
 * "Auto-arrange" button: the canvas is manual otherwise.
 */
export async function arrangePositions(nodes: Node[], edges: CanvasEdge[]): Promise<Record<string, XY>> {
  const sizes = new Map<string, Size>()
  for (const node of nodes) {
    if (node.measured?.width && node.measured?.height) {
      sizes.set(node.id, { width: node.measured.width, height: node.measured.height })
    }
  }
  const ids = new Set(nodes.map((n) => n.id))
  const diagram: Diagram = {
    direction: 'DOWN',
    nodes: nodes.map((n) => ({ id: n.id, type: 'card', data: {} })),
    edges: edges
      .filter((e) => ids.has(e.source) && ids.has(e.target))
      .map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        // Supertypes are laid out above their subtypes.
        reversed: e.kind === 'EXTENDS' || e.kind === 'IMPLEMENTS',
        data: {},
      })),
  }

  const result = fromElkGraph(await runElk(toElkGraph(diagram, sizes)), diagram)
  const positions: Record<string, XY> = {}
  for (const [id, position] of result.positions) positions[id] = position
  return positions
}
