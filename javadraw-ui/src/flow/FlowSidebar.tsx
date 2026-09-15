import { useMemo, useState } from 'react'
import type { GraphIndex } from '../data/graphIndex'
import type { MethodInfo } from '../data/types'
import { Section, SearchInput, Toggle } from '../components/Controls'
import { EndpointBadge, VisibilityGlyph } from '../components/Badges'
import { httpVerb, parameterTypes } from '../data/format'
import type { CallFlowOptions } from './buildCallFlow'

interface Props {
  index: GraphIndex
  root: string | null
  options: CallFlowOptions
  onRoot: (methodId: string) => void
  onChange: (patch: Partial<CallFlowOptions>) => void
}

export function FlowSidebar({ index, root, options, onRoot, onChange }: Props) {
  const [query, setQuery] = useState('')

  const entryGroups = useMemo(() => {
    const groups = new Map<string, MethodInfo[]>()
    for (const m of index.entryPoints) {
      const owner = index.ownerOf.get(m.id)
      if (!owner || owner.external) continue
      const list = groups.get(owner.id) ?? []
      list.push(m)
      groups.set(owner.id, list)
    }
    return [...groups]
      .map(([id, methods]) => ({ type: index.types.get(id)!, methods: methods.sort(compareEndpoints) }))
      .sort((a, b) => a.type.name.localeCompare(b.type.name))
  }, [index])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const result: MethodInfo[] = []
    for (const type of index.graph.types) {
      if (type.external) continue
      for (const m of type.methods ?? []) {
        if (m.inherited || m.accessor) continue
        const label = `${type.name}.${m.name}`.toLowerCase()
        if (label.includes(q) || (m.endpoint?.toLowerCase().includes(q) ?? false)) result.push(m)
        if (result.length >= 80) return result
      }
    }
    return result
  }, [index, query])

  return (
    <>
      <div className="px-4 pb-3 pt-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Find a method or endpoint…" />
      </div>

      {query ? (
        <Section title={`${matches.length} matches`}>
          <div className="-mx-2">
            {matches.map((m) => (
              <MethodItem key={m.id} index={index} method={m} active={m.id === root} onClick={() => onRoot(m.id)} showOwner />
            ))}
          </div>
        </Section>
      ) : (
        <Section title={`Entry points · ${index.entryPoints.length}`}>
          {entryGroups.length === 0 && (
            <p className="text-[12px] leading-relaxed text-[var(--jd-muted)]">
              No HTTP handlers, listeners, schedulers or <code>main</code> methods were detected. Search for any method above to start a flow.
            </p>
          )}
          <div className="-mx-2 space-y-2">
            {entryGroups.map(({ type, methods }) => (
              <div key={type.id}>
                <div className="px-2 pb-0.5 text-[11.5px] font-semibold text-[var(--jd-muted)]">{type.name}</div>
                {methods.map((m) => (
                  <MethodItem key={m.id} index={index} method={m} active={m.id === root} onClick={() => onRoot(m.id)} />
                ))}
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Flow">
        <label className="flex items-center gap-3 py-1 text-[12.5px]">
          <span className="w-12">Depth</span>
          <input
            type="range"
            min={1}
            max={10}
            value={options.depth}
            onChange={(e) => onChange({ depth: Number(e.target.value), expanded: new Set() })}
            className="flex-1 accent-[var(--jd-accent)]"
          />
          <span className="w-5 text-right font-mono font-semibold">{options.depth}</span>
        </label>
        <Toggle label="Show library calls" checked={options.showExternal} onChange={(showExternal) => onChange({ showExternal })} />
        <Toggle label="Show getters & setters" checked={!options.hideAccessors} onChange={(show) => onChange({ hideAccessors: !show })} />
        <Toggle label="Hide constructors" checked={options.hideConstructors} onChange={(hideConstructors) => onChange({ hideConstructors })} />
      </Section>
    </>
  )
}

function MethodItem({
  index,
  method,
  active,
  onClick,
  showOwner,
}: {
  index: GraphIndex
  method: MethodInfo
  active: boolean
  onClick: () => void
  showOwner?: boolean
}) {
  const owner = index.ownerOf.get(method.id)
  return (
    <button className={`jd-list-item items-start ${active ? 'jd-selected' : ''}`} onClick={onClick} title={method.signature}>
      <span className="min-w-0 flex-1">
        {method.endpoint && (
          <span className="mb-0.5 flex">
            <EndpointBadge endpoint={method.endpoint} />
          </span>
        )}
        <span className="flex items-baseline gap-1 font-mono text-[11.5px]">
          {!method.endpoint && <VisibilityGlyph visibility={method.visibility} />}
          <span className="truncate">
            {showOwner && <span className="text-[var(--jd-muted)]">{owner?.name}.</span>}
            {method.name}
            <span className="text-[var(--jd-faint)]">({parameterTypes(method)})</span>
          </span>
        </span>
      </span>
    </button>
  )
}

function compareEndpoints(a: MethodInfo, b: MethodInfo): number {
  const pa = httpVerb(a.endpoint) ? a.endpoint!.split(' ').slice(1).join(' ') : a.endpoint ?? ''
  const pb = httpVerb(b.endpoint) ? b.endpoint!.split(' ').slice(1).join(' ') : b.endpoint ?? ''
  return pa.localeCompare(pb) || (a.endpoint ?? '').localeCompare(b.endpoint ?? '')
}
