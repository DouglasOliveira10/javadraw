import { useMemo, useState } from 'react'
import { Check, ChevronRight, Folder, Zap } from 'lucide-react'
import type { GraphIndex } from '../data/graphIndex'
import type { TypeInfo } from '../data/types'
import { SearchInput } from '../components/Controls'
import { EndpointBadge, KindBadge, StereotypePill } from '../components/Badges'
import { buildClassTree, type PackageNode } from './classTree'

interface Props {
  index: GraphIndex
  /** Types already on the canvas, marked in the list. */
  onCanvas: Set<string>
  onPick: (typeId: string) => void
  title: string
  hint: string
}

type Tab = 'classes' | 'entryPoints'

export function ClassPicker({ index, onCanvas, onPick, title, hint }: Props) {
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<Tab>('classes')

  const tree = useMemo(() => buildClassTree(index.graph.types), [index])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return index.graph.types
      .filter((t) => !t.external && !t.anonymous && t.id.toLowerCase().includes(q))
      .sort((a, b) => Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q)) || a.name.localeCompare(b.name))
      .slice(0, 80)
  }, [index, query])

  const entryPoints = useMemo(
    () =>
      index.entryPoints
        .map((m) => ({ method: m, owner: index.ownerOf.get(m.id) }))
        .filter((e) => e.owner && !e.owner.external)
        .sort((a, b) => (a.owner!.name + a.method.name).localeCompare(b.owner!.name + b.method.name)),
    [index],
  )

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--jd-border)] px-4 pb-3 pt-3">
        <h2 className="text-[13.5px] font-semibold">{title}</h2>
        <p className="mb-2.5 mt-0.5 text-[11.5px] leading-snug text-[var(--jd-muted)]">{hint}</p>
        <SearchInput value={query} onChange={setQuery} placeholder="Find a class…" />
        {!query && (
          <div className="mt-2 flex rounded-lg border border-[var(--jd-border)] bg-[var(--jd-surface-2)] p-0.5">
            <TabButton active={tab === 'classes'} onClick={() => setTab('classes')} icon={<Folder size={13} />} label="Packages" />
            <TabButton active={tab === 'entryPoints'} onClick={() => setTab('entryPoints')} icon={<Zap size={13} />} label={`Entry points · ${entryPoints.length}`} />
          </div>
        )}
      </div>

      <div className="jd-scroll min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {query ? (
          matches.length === 0 ? (
            <Empty>No class matches “{query}”.</Empty>
          ) : (
            matches.map((t) => <ClassRow key={t.id} type={t} depth={0} onCanvas={onCanvas.has(t.id)} onPick={onPick} showPackage />)
          )
        ) : tab === 'classes' ? (
          tree.map((node) => <PackageRow key={node.name + node.label} node={node} depth={0} onCanvas={onCanvas} onPick={onPick} />)
        ) : entryPoints.length === 0 ? (
          <Empty>No HTTP handlers, listeners, schedulers or main methods were detected.</Empty>
        ) : (
          entryPoints.map(({ method, owner }) => (
            <button key={method.id} className="jd-list-item items-start" onClick={() => onPick(owner!.id)} title={`${owner!.id}\n${method.signature}`}>
              <KindBadge kind={owner!.kind} size={18} />
              <span className="min-w-0 flex-1">
                {method.endpoint && (
                  <span className="mb-0.5 flex">
                    <EndpointBadge endpoint={method.endpoint} />
                  </span>
                )}
                <span className="block truncate font-mono text-[11.5px]">
                  <span className="text-[var(--jd-muted)]">{owner!.name}.</span>
                  {method.name}()
                </span>
              </span>
              {onCanvas.has(owner!.id) && <Check size={13} className="shrink-0 text-[var(--jd-accent)]" />}
            </button>
          ))
        )}
      </div>
    </div>
  )
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] font-medium transition"
      style={active ? { background: 'var(--jd-surface)', color: 'var(--jd-text)', boxShadow: 'var(--jd-shadow)' } : { color: 'var(--jd-muted)' }}
    >
      {icon}
      {label}
    </button>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-2 py-3 text-[12px] leading-relaxed text-[var(--jd-muted)]">{children}</p>
}

function PackageRow({
  node,
  depth,
  onCanvas,
  onPick,
}: {
  node: PackageNode
  depth: number
  onCanvas: Set<string>
  onPick: (id: string) => void
}) {
  const [open, setOpen] = useState(depth < 1)
  return (
    <div>
      <div className="jd-list-item py-1" style={{ paddingLeft: 8 + depth * 12 }} onClick={() => setOpen(!open)}>
        <ChevronRight
          size={13}
          className="shrink-0 text-[var(--jd-faint)] transition-transform"
          style={{ transform: open ? 'rotate(90deg)' : undefined }}
        />
        <Folder size={13} className="shrink-0 text-[var(--jd-faint)]" />
        <span className="min-w-0 flex-1 truncate font-mono text-[11.5px]" title={node.name}>
          {node.label}
        </span>
        <span className="text-[10.5px] text-[var(--jd-faint)]">{node.total}</span>
      </div>
      {open && (
        <>
          {node.children.map((child) => (
            <PackageRow key={child.name + child.label} node={child} depth={depth + 1} onCanvas={onCanvas} onPick={onPick} />
          ))}
          {node.types.map((type) => (
            <ClassRow key={type.id} type={type} depth={depth + 1} onCanvas={onCanvas.has(type.id)} onPick={onPick} />
          ))}
        </>
      )}
    </div>
  )
}

function ClassRow({
  type,
  depth,
  onCanvas,
  onPick,
  showPackage,
}: {
  type: TypeInfo
  depth: number
  onCanvas: boolean
  onPick: (id: string) => void
  showPackage?: boolean
}) {
  return (
    <button
      className="jd-list-item py-1"
      style={{ paddingLeft: 8 + depth * 12 + 13 }}
      onClick={() => onPick(type.id)}
      title={type.id}
    >
      <KindBadge kind={type.kind} abstract={type.modifiers?.includes('abstract')} size={18} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px]">{type.name}</span>
        {showPackage && <span className="block truncate font-mono text-[10px] text-[var(--jd-faint)]">{type.packageName}</span>}
      </span>
      {type.stereotypes?.[0] && <StereotypePill stereotype={type.stereotypes[0]} />}
      {onCanvas && <Check size={13} className="shrink-0 text-[var(--jd-accent)]" />}
    </button>
  )
}
