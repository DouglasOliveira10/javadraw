export interface PackageTreeNode {
  /** Full package name; for compressed chains, the deepest package. */
  name: string
  label: string
  /** Types declared directly in this package. */
  count: number
  total: number
  /** Every package with types in this subtree (including itself). */
  packages: string[]
  children: PackageTreeNode[]
}

/** Builds a package hierarchy, collapsing chains like {@code com > acme > shop} into {@code com.acme.shop}. */
export function buildPackageTree(counts: Map<string, number>): PackageTreeNode[] {
  interface Mutable {
    name: string
    segment: string
    count: number
    children: Map<string, Mutable>
  }
  const root: Mutable = { name: '', segment: '', count: 0, children: new Map() }
  for (const [pkg, count] of counts) {
    if (pkg === '') {
      root.children.set('', { name: '', segment: '(default)', count, children: new Map() })
      continue
    }
    let node = root
    const parts = pkg.split('.')
    parts.forEach((segment, i) => {
      let child = node.children.get(segment)
      if (!child) {
        child = { name: parts.slice(0, i + 1).join('.'), segment, count: 0, children: new Map() }
        node.children.set(segment, child)
      }
      node = child
    })
    node.count += count
  }

  const convert = (node: Mutable, prefix: string): PackageTreeNode => {
    let label = prefix ? `${prefix}.${node.segment}` : node.segment
    let current = node
    while (current.count === 0 && current.children.size === 1) {
      current = [...current.children.values()][0]
      label = `${label}.${current.segment}`
    }
    const children = [...current.children.values()]
      .sort((a, b) => a.segment.localeCompare(b.segment))
      .map((c) => convert(c, ''))
    const packages = [...(current.count > 0 ? [current.name] : []), ...children.flatMap((c) => c.packages)]
    return {
      name: current.name,
      label,
      count: current.count,
      total: current.count + children.reduce((sum, c) => sum + c.total, 0),
      packages,
      children,
    }
  }

  return [...root.children.values()].sort((a, b) => a.segment.localeCompare(b.segment)).map((c) => convert(c, ''))
}
