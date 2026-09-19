import { describe, expect, it } from 'vitest'
import { indexGraph } from '../data/graphIndex'
import type { Graph, MethodInfo, TypeInfo } from '../data/types'
import { CANVAS_VERSION, type CanvasState } from './canvasState'
import { toReactFlowEdges, toReactFlowNodes } from './toReactFlow'

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
}
const index = indexGraph(graph)

const state = (overrides: Partial<CanvasState> = {}): CanvasState => ({
  version: CANVAS_VERSION,
  project: 'test',
  nodes: [
    { id: 'app.Service', position: { x: 0, y: 0 }, visibleFields: ['repo'], visibleMethods: [place.id] },
    { id: 'app.Repo', position: { x: 400, y: 0 }, visibleFields: [], visibleMethods: [save.id] },
  ],
  edges: [],
  ...overrides,
})

describe('toReactFlowNodes', () => {
  it('shows only the revealed members and counts the hidden ones', () => {
    const [service, repo] = toReactFlowNodes(state(), index, { showFieldTypes: true, showParameters: true, showReturnTypes: true })
    expect(service.data.fields.map((f) => f.name)).toEqual(['repo'])
    expect(service.data.methods.map((m) => m.name)).toEqual(['place'])
    expect(repo.data.fields).toEqual([])
    expect(repo.data.hiddenCount).toBe(1)
    expect(service.position).toEqual({ x: 0, y: 0 })
  })
})

describe('toReactFlowEdges', () => {
  const call = { id: 'c', kind: 'CALL' as const, origin: 'graph' as const, source: 'app.Service', target: 'app.Repo', sourceMember: place.id, targetMember: save.id, line: 12 }

  it('anchors a call on both method rows, facing each other', () => {
    const [edge] = toReactFlowEdges(state({ edges: [call] }))
    expect(edge.sourceHandle).toBe(`m:${place.id}-r`)
    expect(edge.targetHandle).toBe(`m:${save.id}-l`)
    expect(edge.data?.label).toBe('L12')
  })

  it('flips the sides when the target card sits on the left', () => {
    const moved = state({ edges: [call] })
    moved.nodes[1].position = { x: -400, y: 0 }
    const [edge] = toReactFlowEdges(moved)
    expect(edge.sourceHandle).toBe(`m:${place.id}-l`)
    expect(edge.targetHandle).toBe(`m:${save.id}-r`)
  })

  it('uses top and bottom for cards stacked vertically', () => {
    const stacked = state({ edges: [call] })
    stacked.nodes[1].position = { x: 20, y: 400 }
    const [edge] = toReactFlowEdges(stacked)
    expect(edge.sourceHandle).toBe(`m:${place.id}-b`)
    expect(edge.targetHandle).toBe(`m:${save.id}-t`)
  })

  it('falls back to the card when the method is hidden', () => {
    const hidden = state({ edges: [call] })
    hidden.nodes[0].visibleMethods = []
    const [edge] = toReactFlowEdges(hidden)
    expect(edge.sourceHandle).toBe('card-r')
  })

  it('anchors an association on the field row and keeps the multiplicity label', () => {
    const [edge] = toReactFlowEdges(
      state({ edges: [{ id: 'a', kind: 'ASSOCIATION', origin: 'graph' as const, source: 'app.Service', target: 'app.Repo', label: 'repo', multiplicity: '*' }] }),
    )
    expect(edge.sourceHandle).toBe('f:repo-r')
    expect(edge.data?.label).toBe('*')
  })

  it('draws inheritance vertically, from subtype to supertype', () => {
    const inheritance = state({ edges: [{ id: 'e', kind: 'EXTENDS', origin: 'graph' as const, source: 'app.Service', target: 'app.Repo' }] })
    inheritance.nodes[1].position = { x: 0, y: -300 }
    const [edge] = toReactFlowEdges(inheritance)
    expect(edge.sourceHandle).toBe('card-t')
    expect(edge.targetHandle).toBe('card-b')
  })
})
