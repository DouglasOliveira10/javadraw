import type { GraphIndex } from '../data/graphIndex'
import type { CallEdge, CallKind, MethodInfo, TypeInfo } from '../data/types'
import type { Diagram, DiagramEdge, DiagramNode } from '../layout/diagram'

export interface CallFlowOptions {
  depth: number
  /** Methods whose calls are shown even beyond {@link depth}. */
  expanded: Set<string>
  hideAccessors: boolean
  hideConstructors: boolean
  showExternal: boolean
  maxNodes: number
}

export interface MethodNodeData extends Record<string, unknown> {
  method: MethodInfo
  owner: TypeInfo | undefined
  root: boolean
  /** Number of hidden callees when the node was not expanded. */
  more: number
}

export interface ClassGroupData extends Record<string, unknown> {
  type: TypeInfo | undefined
}

export interface CallEdgeData extends Record<string, unknown> {
  variant: 'CALL'
  kind: CallKind
  step?: number
  back: boolean
  line?: number
}

export interface CallFlow {
  diagram: Diagram
  truncated: boolean
  methodCount: number
}

export const CLASS_PREFIX = 'cls:'

/** Breadth-first walk of the call graph from {@code rootId}. */
export function buildCallFlow(index: GraphIndex, rootId: string, options: CallFlowOptions): CallFlow {
  const depthOf = new Map<string, number>([[rootId, 0]])
  const more = new Map<string, number>()
  const calls: CallEdge[] = []
  const queue = [rootId]
  let truncated = false

  const visibleCallee = (call: CallEdge): boolean => {
    const method = index.methods.get(call.target)
    if (!method) return false
    const owner = index.ownerOf.get(call.target)
    if (owner?.external && !options.showExternal) return false
    if (options.hideAccessors && method.accessor) return false
    if (options.hideConstructors && method.isConstructor) return false
    return true
  }

  while (queue.length) {
    const current = queue.shift()!
    const depth = depthOf.get(current)!
    const outgoing = (index.outgoing.get(current) ?? []).filter(visibleCallee)
    if (outgoing.length === 0) continue
    if (depth >= options.depth && !options.expanded.has(current)) {
      const unseen = outgoing.filter((c) => !depthOf.has(c.target)).length
      if (unseen > 0) more.set(current, unseen)
      continue
    }
    for (const call of outgoing) {
      if (!depthOf.has(call.target)) {
        if (depthOf.size >= options.maxNodes) {
          truncated = true
          more.set(current, (more.get(current) ?? 0) + 1)
          continue
        }
        depthOf.set(call.target, depth + 1)
        queue.push(call.target)
      }
      calls.push(call)
    }
  }

  const owners = new Map<string, TypeInfo | undefined>()
  for (const id of depthOf.keys()) {
    const owner = index.ownerOf.get(id)
    owners.set(owner?.id ?? id.substring(0, id.indexOf('#')), owner)
  }

  const nodes: DiagramNode[] = []
  for (const [ownerId, owner] of owners) {
    nodes.push({
      id: CLASS_PREFIX + ownerId,
      type: 'classGroup',
      group: true,
      minWidth: Math.max(200, (owner?.name.length ?? ownerId.length) * 8 + 110),
      data: { type: owner } satisfies ClassGroupData,
    })
  }
  for (const [id] of depthOf) {
    const method = index.methods.get(id)
    if (!method) continue
    const owner = index.ownerOf.get(id)
    nodes.push({
      id,
      type: 'method',
      parent: CLASS_PREFIX + (owner?.id ?? id.substring(0, id.indexOf('#'))),
      data: { method, owner, root: id === rootId, more: more.get(id) ?? 0 } satisfies MethodNodeData,
    })
  }

  const steps = new Map<string, number>()
  const edges: DiagramEdge[] = calls.map((call) => {
    const isCall = call.kind !== 'OVERRIDE'
    const step = isCall ? (steps.get(call.source) ?? 0) + 1 : undefined
    if (step) steps.set(call.source, step)
    const back = call.source === call.target || depthOf.get(call.target)! <= depthOf.get(call.source)!
    return {
      id: `call:${call.source}->${call.target}`,
      source: call.source,
      target: call.target,
      label: isCall ? undefined : 'impl',
      data: { variant: 'CALL', kind: call.kind, step, back, line: call.line } satisfies CallEdgeData,
    }
  })

  return { diagram: { direction: 'RIGHT', nodes, edges }, truncated, methodCount: depthOf.size }
}
