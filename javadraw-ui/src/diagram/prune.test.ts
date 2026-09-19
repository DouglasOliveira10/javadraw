import { describe, expect, it } from 'vitest'
import { indexGraph } from '../data/graphIndex'
import type { Graph, MethodInfo, TypeInfo } from '../data/types'
import { CANVAS_VERSION, type CanvasState } from './canvasState'
import { pruneCanvas } from './prune'
import { migrate } from './useCanvas'

const method = (owner: string, name: string): MethodInfo => ({
  id: `${owner}#${name}()V`,
  name,
  descriptor: '()V',
  signature: `${name}(): void`,
  visibility: 'PUBLIC',
  isStatic: false,
  isAbstract: false,
  isConstructor: false,
  accessor: false,
  generated: false,
  inherited: false,
  entryPoint: false,
})

const place = method('app.Service', 'place')
const save = method('app.Repo', 'save')

const type = (id: string, methods: MethodInfo[]): TypeInfo => ({
  id,
  name: id.split('.').pop()!,
  packageName: 'app',
  kind: 'CLASS',
  visibility: 'PUBLIC',
  fields: [{ name: 'repo', type: 'Repo', visibility: 'PRIVATE', isStatic: false, isFinal: true }],
  methods,
  anonymous: false,
  external: false,
})

const graph: Graph = {
  meta: { name: 'test', generatedAt: '', version: '' },
  types: [type('app.Service', [place]), type('app.Repo', [save])],
  relations: [{ source: 'app.Service', target: 'app.Repo', kind: 'ASSOCIATION', label: 'repo' }],
  calls: [{ source: place.id, target: save.id, kind: 'VIRTUAL', line: 12, polymorphic: false }],
}
const index = indexGraph(graph)

const association = {
  id: 'ASSOCIATION:app.Service->app.Repo:repo',
  kind: 'ASSOCIATION' as const, origin: 'graph' as const,
  source: 'app.Service',
  target: 'app.Repo',
  label: 'repo',
}

const saved = (overrides: Partial<CanvasState> = {}): CanvasState => ({
  version: CANVAS_VERSION,
  project: 'test',
  nodes: [
    { id: 'app.Service', position: { x: 0, y: 0 }, visibleFields: ['repo'], visibleMethods: [place.id] },
    { id: 'app.Repo', position: { x: 400, y: 0 }, visibleFields: [], visibleMethods: [save.id] },
  ],
  edges: [association],
  ...overrides,
})

describe('pruneCanvas', () => {
  it('keeps a diagram that still matches the code untouched', () => {
    const state = saved()
    const result = pruneCanvas(state, index)
    expect(result.state).toBe(state)
    expect(result.droppedTypes).toEqual([])
    expect(result.droppedEdges).toBe(0)
  })

  it('drops cards whose class is gone, along with their edges', () => {
    const state = saved({
      nodes: [...saved().nodes, { id: 'app.Removed', position: { x: 0, y: 0 }, visibleFields: [], visibleMethods: [] }],
      edges: [association, { id: 'x', kind: 'DEPENDENCY', origin: 'graph' as const, source: 'app.Service', target: 'app.Removed' }],
    })
    const result = pruneCanvas(state, index)
    expect(result.state.nodes.map((n) => n.id)).toEqual(['app.Service', 'app.Repo'])
    expect(result.state.edges).toEqual([association])
    expect(result.droppedTypes).toEqual(['Removed'])
    expect(result.droppedEdges).toBe(1)
  })

  it('drops edges whose relation no longer exists in the bytecode', () => {
    const state = saved({
      edges: [association, { id: 'CALL:app.Service#gone()V->app.Repo#save()V', kind: 'CALL', origin: 'graph' as const, source: 'app.Service', target: 'app.Repo' }],
    })
    const result = pruneCanvas(state, index)
    expect(result.state.edges).toEqual([association])
    expect(result.droppedEdges).toBe(1)
  })

  it('forgets members that the class no longer declares', () => {
    const state = saved({
      nodes: [{ id: 'app.Service', position: { x: 0, y: 0 }, visibleFields: ['repo', 'gone'], visibleMethods: ['app.Service#gone()V'] }],
      edges: [],
    })
    const result = pruneCanvas(state, index)
    expect(result.state.nodes[0]).toMatchObject({ visibleFields: ['repo'], visibleMethods: [] })
    expect(result.droppedTypes).toEqual([])
  })

  it('keeps a hand-drawn edge: no relation backs it, so none can go missing', () => {
    const manual = {
      id: 'M:0',
      kind: 'MANUAL' as const,
      origin: 'manual' as const,
      source: 'app.Service',
      target: 'app.Repo',
    }
    const result = pruneCanvas(saved({ edges: [association, manual] }), index)
    expect(result.state.edges).toEqual([association, manual])
    expect(result.droppedEdges).toBe(0)
  })

  it('drops a hand-drawn edge whose card is gone', () => {
    const state = saved({
      edges: [{ id: 'M:0', kind: 'MANUAL', origin: 'manual', source: 'app.Service', target: 'app.Removed' }],
    })
    expect(pruneCanvas(state, index).state.edges).toEqual([])
  })
})

describe('migrate', () => {
  it('reads a version 1 diagram, where every edge came from the bytecode', () => {
    const { origin, ...edgeWithoutOrigin } = association
    const old = { ...saved(), version: 1, edges: [edgeWithoutOrigin] } as unknown as CanvasState
    const migrated = migrate(old)
    expect(migrated.version).toBe(CANVAS_VERSION)
    expect(migrated.edges.every((e) => e.origin === 'graph')).toBe(true)
  })

  it('turns a version 2 pinned side into a point halfway along it', () => {
    const old = {
      ...saved(),
      version: 2,
      edges: [{ ...association, anchors: { source: 'r', target: 'l' } }],
    } as unknown as CanvasState
    expect(migrate(old).edges[0].anchors).toEqual({ source: { side: 'r', offset: 0.5 }, target: { side: 'l', offset: 0.5 } })
  })

  it('leaves a current diagram alone and refuses one from the future', () => {
    const current = saved()
    expect(migrate(current)).toBe(current)
    expect(() => migrate({ ...current, version: 99 as unknown as typeof CANVAS_VERSION })).toThrow(/version/)
  })
})
