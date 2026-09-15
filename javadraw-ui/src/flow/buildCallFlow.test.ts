import { describe, expect, it } from 'vitest'
import { indexGraph } from '../data/graphIndex'
import type { CallEdge, Graph, MethodInfo, TypeInfo } from '../data/types'
import { buildCallFlow, CLASS_PREFIX, type CallFlowOptions } from './buildCallFlow'

function method(owner: string, name: string, extra: Partial<MethodInfo> = {}): MethodInfo {
  return {
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
    ...extra,
  }
}

function type(id: string, methods: MethodInfo[], extra: Partial<TypeInfo> = {}): TypeInfo {
  return { id, name: id.split('.').pop()!, packageName: 'app', kind: 'CLASS', visibility: 'PUBLIC', methods, anonymous: false, external: false, ...extra }
}

const call = (source: MethodInfo, target: MethodInfo, line: number, kind: CallEdge['kind'] = 'VIRTUAL'): CallEdge => ({
  source: source.id,
  target: target.id,
  kind,
  line,
  polymorphic: kind === 'OVERRIDE',
})

const controller = method('app.Controller', 'handle', { entryPoint: true, endpoint: 'GET /x' })
const service = method('app.Service', 'run')
const helper = method('app.Service', 'helper')
const getter = method('app.Repo', 'getName', { accessor: true })
const repo = method('app.Repo', 'load')
const deep = method('app.Repo', 'deep')
const library = method('lib.Client', 'send')

const graph: Graph = {
  meta: { name: 'test', generatedAt: '', version: '' },
  types: [
    type('app.Controller', [controller]),
    type('app.Service', [service, helper]),
    type('app.Repo', [getter, repo, deep]),
    type('lib.Client', [library], { external: true }),
  ],
  calls: [
    call(controller, service, 10),
    call(service, repo, 21),
    call(service, helper, 20),
    call(service, getter, 22),
    call(service, library, 23),
    call(repo, deep, 30),
    call(deep, service, 31),
  ],
}

const defaults: CallFlowOptions = {
  depth: 5,
  expanded: new Set(),
  hideAccessors: true,
  hideConstructors: false,
  showExternal: false,
  maxNodes: 100,
}

describe('buildCallFlow', () => {
  const index = indexGraph(graph)

  it('walks calls and groups methods by class', () => {
    const { diagram } = buildCallFlow(index, controller.id, defaults)
    const methodIds = diagram.nodes.filter((n) => n.type === 'method').map((n) => n.id)
    expect(methodIds).toEqual([controller.id, service.id, helper.id, repo.id, deep.id])
    expect(diagram.nodes.find((n) => n.id === repo.id)?.parent).toBe(`${CLASS_PREFIX}app.Repo`)
    expect(diagram.direction).toBe('RIGHT')
  })

  it('numbers calls by source line and hides accessors and library calls', () => {
    const { diagram } = buildCallFlow(index, controller.id, defaults)
    const fromService = diagram.edges.filter((e) => e.source === service.id)
    expect(fromService.map((e) => [e.target, e.data.step])).toEqual([
      [helper.id, 1],
      [repo.id, 2],
    ])
  })

  it('shows library calls on demand', () => {
    const { diagram } = buildCallFlow(index, controller.id, { ...defaults, showExternal: true, hideAccessors: false })
    expect(diagram.nodes.map((n) => n.id)).toContain(library.id)
    expect(diagram.nodes.map((n) => n.id)).toContain(getter.id)
  })

  it('marks cycles as back edges without revisiting nodes', () => {
    const { diagram } = buildCallFlow(index, controller.id, defaults)
    const cycle = diagram.edges.find((e) => e.source === deep.id && e.target === service.id)
    expect(cycle?.data.back).toBe(true)
    expect(diagram.nodes.filter((n) => n.id === service.id)).toHaveLength(1)
  })

  it('stops at the depth limit and reports hidden callees', () => {
    const { diagram } = buildCallFlow(index, controller.id, { ...defaults, depth: 1 })
    expect(diagram.nodes.filter((n) => n.type === 'method').map((n) => n.id)).toEqual([controller.id, service.id])
    expect(diagram.nodes.find((n) => n.id === service.id)?.data.more).toBe(2)
  })

  it('expands a node beyond the depth limit', () => {
    const { diagram } = buildCallFlow(index, controller.id, { ...defaults, depth: 1, expanded: new Set([service.id]) })
    expect(diagram.nodes.map((n) => n.id)).toContain(repo.id)
    expect(diagram.nodes.map((n) => n.id)).not.toContain(deep.id)
  })

  it('truncates large flows', () => {
    const flow = buildCallFlow(index, controller.id, { ...defaults, maxNodes: 2 })
    expect(flow.truncated).toBe(true)
    expect(flow.methodCount).toBe(2)
  })
})
