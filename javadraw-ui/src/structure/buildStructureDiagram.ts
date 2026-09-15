import type { GraphIndex } from '../data/graphIndex'
import type { FieldInfo, MethodInfo, RelationKind, TypeInfo } from '../data/types'
import type { Diagram, DiagramEdge, DiagramNode } from '../layout/diagram'

export type MemberDetail = 'none' | 'public' | 'all'

export interface StructureOptions {
  packages: Set<string>
  /** Show only this type and its direct neighbors (ignores the package selection). */
  focus?: string | null
  relationKinds: Set<RelationKind>
  detail: MemberDetail
  showExternal: boolean
  hideAccessors: boolean
  groupByPackage: boolean
  maxMembers: number
  /** Types whose members are shown without the {@link maxMembers} cap. */
  expanded: Set<string>
}

export interface TypeNodeData extends Record<string, unknown> {
  type: TypeInfo
  fields: FieldInfo[]
  methods: MethodInfo[]
  hiddenMembers: number
  showPackage: boolean
  focused: boolean
}

export interface PackageNodeData extends Record<string, unknown> {
  name: string
  count: number
}

export interface UmlEdgeData extends Record<string, unknown> {
  variant: RelationKind
  multiplicity?: string
}

export const PACKAGE_PREFIX = 'pkg:'

export function buildStructureDiagram(index: GraphIndex, options: StructureOptions): Diagram {
  const relations = (index.graph.relations ?? []).filter((r) => options.relationKinds.has(r.kind))
  const visible = new Set<string>()

  if (options.focus && index.types.has(options.focus)) {
    visible.add(options.focus)
    for (const r of relations) {
      if (r.source === options.focus) visible.add(r.target)
      if (r.target === options.focus) visible.add(r.source)
    }
  } else {
    for (const type of index.graph.types) {
      if (!type.external && !type.anonymous && options.packages.has(type.packageName ?? '')) visible.add(type.id)
    }
  }

  const edges: DiagramEdge[] = []
  const withExternal = new Set(visible)
  for (const r of relations) {
    const source = index.types.get(r.source)
    const target = index.types.get(r.target)
    if (!source || !target || r.source === r.target) continue
    const sourceVisible = visible.has(r.source)
    const targetVisible = visible.has(r.target)
    if (!sourceVisible && !targetVisible) continue
    if (!sourceVisible || !targetVisible) {
      if (options.focus) continue
      // Only pull in external library types, not project types from unselected packages.
      const other = sourceVisible ? target : source
      if (!options.showExternal || !other.external) continue
      withExternal.add(other.id)
    }
    const inheritance = r.kind === 'EXTENDS' || r.kind === 'IMPLEMENTS'
    const label = r.kind === 'ASSOCIATION' ? [r.label, r.multiplicity].filter(Boolean).join(' ') : undefined
    edges.push({
      id: `${r.kind}:${r.source}->${r.target}:${r.label ?? ''}`,
      source: r.source,
      target: r.target,
      reversed: inheritance,
      label: label || undefined,
      data: { variant: r.kind, multiplicity: r.multiplicity } satisfies UmlEdgeData,
    })
  }

  const types = [...withExternal].map((id) => index.types.get(id)!).sort(compareTypes)
  const packageCounts = new Map<string, number>()
  for (const type of types) {
    if (!type.external) packageCounts.set(type.packageName ?? '', (packageCounts.get(type.packageName ?? '') ?? 0) + 1)
  }
  const grouped = options.groupByPackage && !options.focus

  const nodes: DiagramNode[] = []
  if (grouped) {
    for (const [name, count] of [...packageCounts].sort()) {
      nodes.push({
        id: PACKAGE_PREFIX + name,
        type: 'package',
        group: true,
        minWidth: Math.max(220, name.length * 7.5 + 90),
        data: { name: name || '(default package)', count } satisfies PackageNodeData,
      })
    }
  }
  for (const type of types) {
    nodes.push({
      id: type.id,
      type: 'type',
      parent: grouped && !type.external ? PACKAGE_PREFIX + (type.packageName ?? '') : undefined,
      data: typeNodeData(type, options, !grouped || type.external),
    })
  }
  return { direction: 'DOWN', nodes, edges }
}

function typeNodeData(type: TypeInfo, options: StructureOptions, showPackage: boolean): TypeNodeData {
  let fields: FieldInfo[] = []
  let methods: MethodInfo[] = []
  if (options.detail !== 'none' && !type.external) {
    const publicOnly = options.detail === 'public'
    // Record components are private fields but part of the public shape.
    const keepPrivateFields = type.kind === 'RECORD'
    fields = (type.fields ?? []).filter((f) => !publicOnly || f.visibility === 'PUBLIC' || (keepPrivateFields && !f.isStatic))
    methods = (type.methods ?? []).filter(
      (m) =>
        !m.inherited &&
        !m.generated &&
        m.name !== 'static {}' &&
        (!publicOnly || m.visibility === 'PUBLIC') &&
        !(options.hideAccessors && m.accessor) &&
        !(publicOnly && m.isConstructor && m.descriptor === '()V'),
    )
  } else if (type.external && options.detail !== 'none') {
    methods = type.methods ?? []
  }
  let hiddenMembers = 0
  if (!options.expanded.has(type.id)) {
    const total = fields.length + methods.length
    if (total > options.maxMembers) {
      const fieldBudget = Math.min(fields.length, Math.ceil(options.maxMembers / 3))
      const methodBudget = options.maxMembers - fieldBudget
      hiddenMembers = total - fieldBudget - Math.min(methods.length, methodBudget)
      fields = fields.slice(0, fieldBudget)
      methods = methods.slice(0, methodBudget)
    }
  }
  return { type, fields, methods, hiddenMembers, showPackage, focused: options.focus === type.id }
}

function compareTypes(a: TypeInfo, b: TypeInfo): number {
  return Number(a.external) - Number(b.external) || a.id.localeCompare(b.id)
}

export function defaultPackages(index: GraphIndex, limit = 60): Set<string> {
  const counts = new Map<string, number>()
  let total = 0
  for (const type of index.graph.types) {
    if (type.external || type.anonymous) continue
    total++
    counts.set(type.packageName ?? '', (counts.get(type.packageName ?? '') ?? 0) + 1)
  }
  if (total <= limit) return new Set(counts.keys())
  const largest = [...counts].sort((a, b) => b[1] - a[1])[0]
  return new Set(largest ? [largest[0]] : [])
}
