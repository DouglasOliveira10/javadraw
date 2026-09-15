import { describe, expect, it } from 'vitest'
import ELK from 'elkjs/lib/elk.bundled.js'
import type { Diagram } from './diagram'
import { fromElkGraph, toElkGraph } from './elkLayout'

const diagram: Diagram = {
  direction: 'DOWN',
  nodes: [
    { id: 'pkg:a', type: 'package', group: true, data: {} },
    { id: 'A', type: 'type', parent: 'pkg:a', data: {} },
    { id: 'B', type: 'type', parent: 'pkg:a', data: {} },
    { id: 'C', type: 'type', data: {} },
  ],
  edges: [
    { id: 'a-b', source: 'A', target: 'B', data: {} },
    { id: 'b-c', source: 'B', target: 'C', reversed: true, label: 'field *', data: {} },
  ],
}

const sizes = new Map([
  ['A', { width: 120, height: 50 }],
  ['B', { width: 140, height: 60 }],
  ['C', { width: 100, height: 40 }],
])

describe('toElkGraph', () => {
  it('nests children and declares edges in their lowest common ancestor', () => {
    const graph = toElkGraph(diagram, sizes)
    const group = graph.children!.find((c) => c.id === 'pkg:a')!
    expect(group.children!.map((c) => [c.id, c.width, c.height])).toEqual([
      ['A', 120, 50],
      ['B', 140, 60],
    ])
    expect(group.edges!.map((e) => e.id)).toEqual(['a-b'])
    expect(graph.edges!.map((e) => e.id)).toEqual(['b-c'])
  })

  it('swaps endpoints of reversed edges and sizes labels', () => {
    const edge = toElkGraph(diagram, sizes).edges![0]
    expect(edge.sources).toEqual(['C'])
    expect(edge.targets).toEqual(['B'])
    expect(edge.labels![0].width).toBeGreaterThan(0)
  })
})

describe('fromElkGraph', () => {
  it('returns relative node positions, group sizes and absolute routes in drawing order', async () => {
    const laidOut = await new ELK().layout(toElkGraph(diagram, sizes))
    const result = fromElkGraph(laidOut, diagram)

    const group = result.positions.get('pkg:a')!
    const a = result.positions.get('A')!
    expect(result.groupSizes.get('pkg:a')!.width).toBeGreaterThan(140)
    expect(a.x).toBeLessThan(result.groupSizes.get('pkg:a')!.width)

    const inner = result.routes.get('a-b')!
    const aTop = group.y + a.y
    // Route starts at A (inside the group) in absolute coordinates.
    expect(inner.points[0].y).toBeGreaterThanOrEqual(aTop)

    const reversed = result.routes.get('b-c')!
    const c = result.positions.get('C')!
    const last = reversed.points[reversed.points.length - 1]
    // Drawn from B to C even though ELK routed it from C to B.
    expect(Math.abs(last.y - c.y) < 1 || Math.abs(last.y - (c.y + 40)) < 1).toBe(true)
    expect(reversed.label).toBeDefined()
  })
})
