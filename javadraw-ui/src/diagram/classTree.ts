import type { TypeInfo } from '../data/types'

export interface PackageNode {
  /** Full package name. */
  name: string
  /** Label shown in the tree; chains with a single child are collapsed into "com.acme.shop". */
  label: string
  /** Types declared directly in this package, sorted by name. */
  types: TypeInfo[]
  /** Types in this package and below. */
  total: number
  children: PackageNode[]
}

interface Mutable {
  name: string
  segment: string
  types: TypeInfo[]
  children: Map<string, Mutable>
}

/** Builds the IDE-like package tree: packages with their classes, nested packages collapsed when empty. */
export function buildClassTree(types: TypeInfo[]): PackageNode[] {
  const root: Mutable = { name: '', segment: '', types: [] as TypeInfo[], children: new Map<string, Mutable>() }

  for (const type of types) {
    if (type.external || type.anonymous) continue
    const packageName = type.packageName ?? ''
    if (packageName === '') {
      const node: Mutable = root.children.get('') ?? { name: '', segment: '(default)', types: [], children: new Map() }
      node.types.push(type)
      root.children.set('', node)
      continue
    }
    let current = root
    const parts = packageName.split('.')
    parts.forEach((segment, i) => {
      let child = current.children.get(segment)
      if (!child) {
        child = { name: parts.slice(0, i + 1).join('.'), segment, types: [], children: new Map() }
        current.children.set(segment, child)
      }
      current = child
    })
    current.types.push(type)
  }

  const convert = (node: Mutable): PackageNode => {
    let label = node.segment
    let current = node
    while (current.types.length === 0 && current.children.size === 1) {
      current = [...current.children.values()][0]
      label = `${label}.${current.segment}`
    }
    const children = [...current.children.values()].sort(bySegment).map(convert)
    const ownTypes = [...current.types].sort((a, b) => a.name.localeCompare(b.name))
    return {
      name: current.name,
      label,
      types: ownTypes,
      total: ownTypes.length + children.reduce((sum, c) => sum + c.total, 0),
      children,
    }
  }

  return [...root.children.values()].sort(bySegment).map(convert)
}

function bySegment(a: Mutable, b: Mutable): number {
  return a.segment.localeCompare(b.segment)
}
