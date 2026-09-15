import { useMemo, useState } from 'react'
import { ChevronRight, Crosshair, X } from 'lucide-react'
import type { GraphIndex } from '../data/graphIndex'
import type { RelationKind } from '../data/types'
import { Checkbox, Section, SearchInput, Segmented, Toggle } from '../components/Controls'
import { KindBadge, StereotypePill } from '../components/Badges'
import type { MemberDetail, StructureOptions } from './buildStructureDiagram'
import { buildPackageTree, type PackageTreeNode } from './packageTree'

interface Props {
  index: GraphIndex
  options: StructureOptions
  onChange: (patch: Partial<StructureOptions>) => void
  onSelect: (id: string) => void
}

const RELATIONS: { kind: RelationKind; label: string; glyph: 'solid' | 'dashed'; head: '▷' | '›' }[] = [
  { kind: 'EXTENDS', label: 'Extends', glyph: 'solid', head: '▷' },
  { kind: 'IMPLEMENTS', label: 'Implements', glyph: 'dashed', head: '▷' },
  { kind: 'ASSOCIATION', label: 'Association (fields)', glyph: 'solid', head: '›' },
  { kind: 'DEPENDENCY', label: 'Dependency (usage)', glyph: 'dashed', head: '›' },
]

export function StructureSidebar({ index, options, onChange, onSelect }: Props) {
  const [query, setQuery] = useState('')

  const tree = useMemo(() => {
    const counts = new Map<string, number>()
    for (const t of index.graph.types) {
      if (!t.external && !t.anonymous) counts.set(t.packageName ?? '', (counts.get(t.packageName ?? '') ?? 0) + 1)
    }
    return buildPackageTree(counts)
  }, [index])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return index.graph.types
      .filter((t) => !t.external && !t.anonymous && t.id.toLowerCase().includes(q))
      .sort((a, b) => Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q)) || a.name.localeCompare(b.name))
      .slice(0, 60)
  }, [index, query])

  const togglePackages = (packages: string[], on: boolean) => {
    const next = new Set(options.packages)
    for (const p of packages) {
      if (on) next.add(p)
      else next.delete(p)
    }
    onChange({ packages: next, focus: null })
  }

  const focusType = options.focus ? index.types.get(options.focus) : undefined

  return (
    <>
      <div className="px-4 pb-3 pt-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Find a class…" />
      </div>

      {focusType && (
        <div className="mx-4 mb-3 flex items-center gap-2 rounded-lg border border-[var(--jd-accent)] bg-[color-mix(in_srgb,var(--jd-accent)_8%,transparent)] px-2.5 py-2 text-[12px]">
          <Crosshair size={14} className="text-[var(--jd-accent)]" />
          <span className="min-w-0 flex-1 truncate">
            Focused on <b>{focusType.name}</b>
          </span>
          <button className="text-[var(--jd-muted)] hover:text-[var(--jd-text)]" onClick={() => onChange({ focus: null })} title="Clear focus">
            <X size={14} />
          </button>
        </div>
      )}

      {query ? (
        <Section title={`${matches.length} matches`}>
          <div className="-mx-2">
            {matches.map((t) => (
              <button
                key={t.id}
                className={`jd-list-item ${options.focus === t.id ? 'jd-selected' : ''}`}
                onClick={() => {
                  onChange({ focus: t.id })
                  onSelect(t.id)
                }}
              >
                <KindBadge kind={t.kind} size={18} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{t.name}</span>
                  <span className="block truncate font-mono text-[10.5px] text-[var(--jd-faint)]">{t.packageName}</span>
                </span>
                {t.stereotypes?.[0] && <StereotypePill stereotype={t.stereotypes[0]} />}
              </button>
            ))}
          </div>
        </Section>
      ) : (
        <Section
          title="Packages"
          action={
            <span className="flex gap-2 text-[11px]">
              <button className="text-[var(--jd-accent)] hover:underline" onClick={() => onChange({ packages: new Set(index.packages), focus: null })}>
                All
              </button>
              <button className="text-[var(--jd-muted)] hover:underline" onClick={() => onChange({ packages: new Set(), focus: null })}>
                None
              </button>
            </span>
          }
        >
          <div className="-mx-2">
            {tree.map((node) => (
              <PackageRow key={node.name + node.label} node={node} depth={0} selected={options.packages} onToggle={togglePackages} />
            ))}
          </div>
        </Section>
      )}

      <Section title="Members">
        <Segmented<MemberDetail>
          value={options.detail}
          onChange={(detail) => onChange({ detail })}
          options={[
            { value: 'none', label: 'Hidden' },
            { value: 'public', label: 'Public' },
            { value: 'all', label: 'All' },
          ]}
        />
        <div className="mt-2">
          <Toggle label="Show getters & setters" checked={!options.hideAccessors} onChange={(show) => onChange({ hideAccessors: !show })} />
          <Toggle label="Group by package" checked={options.groupByPackage} onChange={(groupByPackage) => onChange({ groupByPackage })} />
          <Toggle label="Show library types" checked={options.showExternal} onChange={(showExternal) => onChange({ showExternal })} />
        </div>
      </Section>

      <Section title="Relations">
        {RELATIONS.map((r) => (
          <Toggle
            key={r.kind}
            label={r.label}
            checked={options.relationKinds.has(r.kind)}
            onChange={(on) => {
              const next = new Set(options.relationKinds)
              if (on) next.add(r.kind)
              else next.delete(r.kind)
              onChange({ relationKinds: next })
            }}
            hint={
              <span className="flex items-center font-mono text-[var(--jd-faint)]">
                <span className="inline-block w-5" style={{ borderTop: `1.5px ${r.glyph} currentColor` }} />
                <span className="-ml-0.5 text-[11px] leading-none">{r.head}</span>
              </span>
            }
          />
        ))}
      </Section>
    </>
  )
}

function PackageRow({
  node,
  depth,
  selected,
  onToggle,
}: {
  node: PackageTreeNode
  depth: number
  selected: Set<string>
  onToggle: (packages: string[], on: boolean) => void
}) {
  const [open, setOpen] = useState(depth < 2)
  const selectedCount = node.packages.filter((p) => selected.has(p)).length
  const checked = selectedCount === node.packages.length && selectedCount > 0
  const indeterminate = selectedCount > 0 && !checked
  return (
    <div>
      <div className="jd-list-item py-1" style={{ paddingLeft: 8 + depth * 14 }} onClick={() => setOpen(!open)}>
        <ChevronRight
          size={13}
          className="shrink-0 text-[var(--jd-faint)] transition-transform"
          style={{ transform: open ? 'rotate(90deg)' : undefined, visibility: node.children.length ? 'visible' : 'hidden' }}
        />
        <Checkbox checked={checked} indeterminate={indeterminate} onChange={(on) => onToggle(node.packages, on)} />
        <span className="min-w-0 flex-1 truncate font-mono text-[11.5px]" title={node.name}>
          {node.label}
        </span>
        <span className="text-[10.5px] text-[var(--jd-faint)]">{node.total}</span>
      </div>
      {open && node.children.map((child) => <PackageRow key={child.name + child.label} node={child} depth={depth + 1} selected={selected} onToggle={onToggle} />)}
    </div>
  )
}
