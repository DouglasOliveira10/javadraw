import type { CallEdge, Graph, MethodInfo, Relation, TypeInfo } from './types'

/** Lookup tables built once per loaded graph. */
export interface GraphIndex {
  graph: Graph
  types: Map<string, TypeInfo>
  methods: Map<string, MethodInfo>
  ownerOf: Map<string, TypeInfo>
  outgoing: Map<string, CallEdge[]>
  incoming: Map<string, CallEdge[]>
  relationsOf: Map<string, Relation[]>
  packages: string[]
  entryPoints: MethodInfo[]
}

export function indexGraph(graph: Graph): GraphIndex {
  const types = new Map<string, TypeInfo>()
  const methods = new Map<string, MethodInfo>()
  const ownerOf = new Map<string, TypeInfo>()
  const packages = new Set<string>()
  const entryPoints: MethodInfo[] = []

  for (const type of graph.types) {
    types.set(type.id, type)
    if (!type.external) packages.add(type.packageName ?? '')
    for (const method of type.methods ?? []) {
      methods.set(method.id, method)
      ownerOf.set(method.id, type)
      if (method.entryPoint) entryPoints.push(method)
    }
  }

  const outgoing = new Map<string, CallEdge[]>()
  const incoming = new Map<string, CallEdge[]>()
  for (const call of graph.calls ?? []) {
    push(outgoing, call.source, call)
    push(incoming, call.target, call)
  }
  for (const list of outgoing.values()) list.sort(byLine)

  const relationsOf = new Map<string, Relation[]>()
  for (const relation of graph.relations ?? []) {
    push(relationsOf, relation.source, relation)
    if (relation.target !== relation.source) push(relationsOf, relation.target, relation)
  }

  return {
    graph,
    types,
    methods,
    ownerOf,
    outgoing,
    incoming,
    relationsOf,
    packages: [...packages].sort(),
    entryPoints,
  }
}

/** Dispatch edges (OVERRIDE) have no line; keep them after real calls. */
function byLine(a: CallEdge, b: CallEdge): number {
  return (a.line || Number.MAX_SAFE_INTEGER) - (b.line || Number.MAX_SAFE_INTEGER)
}

function push<V>(map: Map<string, V[]>, key: string, value: V) {
  const list = map.get(key)
  if (list) list.push(value)
  else map.set(key, [value])
}

export function methodIdOwner(methodId: string): string {
  return methodId.substring(0, methodId.indexOf('#'))
}
