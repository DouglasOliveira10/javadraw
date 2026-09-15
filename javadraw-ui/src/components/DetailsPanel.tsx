import type { ReactNode } from 'react'
import { ArrowRight, Crosshair, Workflow, X } from 'lucide-react'
import type { GraphIndex } from '../data/graphIndex'
import type { AnnotationInfo, CallEdge, MethodInfo, Relation, TypeInfo } from '../data/types'
import { parameterTypes } from '../data/format'
import { EndpointBadge, KindBadge, StereotypePill, VisibilityGlyph } from './Badges'

interface Props {
  index: GraphIndex
  selectedId: string
  onClose: () => void
  onFocusType: (typeId: string) => void
  onOpenFlow: (methodId: string) => void
}

export function DetailsPanel({ index, selectedId, onClose, onFocusType, onOpenFlow }: Props) {
  const type = index.types.get(selectedId)
  const method = index.methods.get(selectedId)
  if (!type && !method) return null

  return (
    <aside className="jd-panel jd-scroll flex w-[340px] shrink-0 flex-col overflow-y-auto border-l">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--jd-border)] bg-[var(--jd-surface)] px-4 py-2.5">
        <span className="jd-label">{type ? 'Type' : 'Method'}</span>
        <button className="text-[var(--jd-faint)] hover:text-[var(--jd-text)]" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      {type ? (
        <TypeDetails index={index} type={type} onFocusType={onFocusType} onOpenFlow={onOpenFlow} />
      ) : (
        <MethodDetails index={index} method={method!} onFocusType={onFocusType} onOpenFlow={onOpenFlow} />
      )}
    </aside>
  )
}

function TypeDetails({ index, type, onFocusType, onOpenFlow }: { index: GraphIndex; type: TypeInfo; onFocusType: (id: string) => void; onOpenFlow: (id: string) => void }) {
  const relations = index.relationsOf.get(type.id) ?? []
  const outgoing = relations.filter((r) => r.source === type.id)
  const incoming = relations.filter((r) => r.target === type.id)
  const methods = (type.methods ?? []).filter((m) => !m.inherited && !m.generated)

  return (
    <div className="space-y-4 px-4 py-4">
      <div>
        <div className="flex items-center gap-2">
          <KindBadge kind={type.kind} abstract={type.modifiers?.includes('abstract')} size={24} />
          <h2 className="min-w-0 flex-1 truncate text-[16px] font-semibold">{type.name}</h2>
        </div>
        <div className="mt-1 break-all font-mono text-[11px] text-[var(--jd-faint)]">{type.id}</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {type.stereotypes?.map((s) => <StereotypePill key={s} stereotype={s} />)}
          {[...(type.modifiers ?? []), type.visibility.toLowerCase(), type.external ? 'external' : null]
            .filter(Boolean)
            .map((m) => (
              <span key={m} className="rounded-full bg-[var(--jd-surface-2)] px-2 text-[10.5px] leading-[18px] text-[var(--jd-muted)]">
                {m}
              </span>
            ))}
        </div>
        {!type.external && (
          <button className="jd-btn mt-3 w-full justify-center" onClick={() => onFocusType(type.id)}>
            <Crosshair size={14} /> Focus neighborhood
          </button>
        )}
      </div>

      <Annotations annotations={type.annotations} />

      {(type.superType || (type.interfaces?.length ?? 0) > 0) && (
        <Block title="Hierarchy">
          {type.superType && <TypeLink index={index} id={type.superType} prefix="extends" onClick={onFocusType} />}
          {type.interfaces?.map((i) => <TypeLink key={i} index={index} id={i} prefix={type.kind === 'INTERFACE' ? 'extends' : 'implements'} onClick={onFocusType} />)}
        </Block>
      )}

      {(type.fields?.length ?? 0) > 0 && (
        <Block title={`Fields · ${type.fields!.length}`}>
          {type.fields!.map((f) => (
            <div key={f.name} className="flex items-baseline gap-1.5 py-0.5 font-mono text-[11.5px]">
              <VisibilityGlyph visibility={f.visibility} />
              <span className={f.isStatic ? 'underline decoration-dotted' : ''}>{f.name}</span>
              <span className="truncate text-[var(--jd-muted)]">: {f.type}</span>
            </div>
          ))}
        </Block>
      )}

      {methods.length > 0 && (
        <Block title={`Methods · ${methods.length}`}>
          {methods.map((m) => (
            <button
              key={m.id}
              className="group flex w-full items-baseline gap-1.5 rounded px-1 py-0.5 text-left font-mono text-[11.5px] hover:bg-[var(--jd-surface-2)] -mx-1"
              title="Open call flow"
              onClick={() => onOpenFlow(m.id)}
            >
              <VisibilityGlyph visibility={m.visibility} />
              <span className="min-w-0 flex-1 truncate">
                {m.name}
                <span className="text-[var(--jd-muted)]">({parameterTypes(m)})</span>
              </span>
              {m.endpoint && <EndpointBadge endpoint={m.endpoint} compact />}
              <Workflow size={12} className="shrink-0 self-center text-[var(--jd-accent)] opacity-0 group-hover:opacity-100" />
            </button>
          ))}
        </Block>
      )}

      <RelationList title="Uses" relations={outgoing} index={index} side="target" onClick={onFocusType} />
      <RelationList title="Used by" relations={incoming} index={index} side="source" onClick={onFocusType} />
    </div>
  )
}

function MethodDetails({ index, method, onFocusType, onOpenFlow }: { index: GraphIndex; method: MethodInfo; onFocusType: (id: string) => void; onOpenFlow: (id: string) => void }) {
  const owner = index.ownerOf.get(method.id)
  const callers = index.incoming.get(method.id) ?? []
  const callees = index.outgoing.get(method.id) ?? []
  return (
    <div className="space-y-4 px-4 py-4">
      <div>
        {method.endpoint && (
          <div className="mb-2">
            <EndpointBadge endpoint={method.endpoint} />
          </div>
        )}
        <h2 className="break-words font-mono text-[13.5px] font-semibold">{method.signature}</h2>
        {owner && (
          <button className="mt-1.5 flex items-center gap-1.5 text-[12px] text-[var(--jd-muted)] hover:text-[var(--jd-accent)]" onClick={() => onFocusType(owner.id)}>
            <KindBadge kind={owner.kind} size={16} />
            {owner.name}
            {method.line ? <span className="text-[var(--jd-faint)]">· line {method.line}</span> : null}
          </button>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[method.visibility.toLowerCase(), method.isStatic && 'static', method.isAbstract && 'abstract', method.accessor && 'accessor', method.inherited && 'inherited']
            .filter(Boolean)
            .map((m) => (
              <span key={m as string} className="rounded-full bg-[var(--jd-surface-2)] px-2 text-[10.5px] leading-[18px] text-[var(--jd-muted)]">
                {m}
              </span>
            ))}
        </div>
        <button className="jd-btn mt-3 w-full justify-center" onClick={() => onOpenFlow(method.id)}>
          <Workflow size={14} /> Open call flow from here
        </button>
      </div>
      <Annotations annotations={method.annotations} />
      <CallList title={`Called by · ${callers.length}`} calls={callers} index={index} side="source" onClick={onOpenFlow} />
      <CallList title={`Calls · ${callees.length}`} calls={callees} index={index} side="target" onClick={onOpenFlow} />
    </div>
  )
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="jd-label mb-1.5">{title}</h3>
      {children}
    </div>
  )
}

function Annotations({ annotations }: { annotations?: AnnotationInfo[] }) {
  if (!annotations?.length) return null
  return (
    <Block title="Annotations">
      <div className="flex flex-wrap gap-1.5">
        {annotations.map((a, i) => (
          <span key={i} className="rounded-md border border-[var(--jd-border)] px-1.5 font-mono text-[11px] leading-[20px] text-[var(--jd-muted)]" title={a.type}>
            @{a.type.substring(a.type.lastIndexOf('.') + 1)}
            {a.values && Object.keys(a.values).length > 0 && (
              <span className="text-[var(--jd-faint)]">({formatValues(a.values)})</span>
            )}
          </span>
        ))}
      </div>
    </Block>
  )
}

function formatValues(values: Record<string, unknown>): string {
  const entries = Object.entries(values)
  const format = (v: unknown) => (Array.isArray(v) ? (v.length === 1 ? JSON.stringify(v[0]) : JSON.stringify(v)) : JSON.stringify(v))
  if (entries.length === 1 && entries[0][0] === 'value') return format(entries[0][1])
  return entries.map(([k, v]) => `${k}=${format(v)}`).join(', ')
}

function TypeLink({ index, id, prefix, onClick }: { index: GraphIndex; id: string; prefix: string; onClick: (id: string) => void }) {
  const type = index.types.get(id)
  const name = type?.name ?? id.substring(id.lastIndexOf('.') + 1)
  return (
    <button
      className="flex w-full items-center gap-1.5 py-0.5 text-left text-[12px] hover:text-[var(--jd-accent)] disabled:hover:text-inherit"
      disabled={!type || type.external}
      onClick={() => onClick(id)}
    >
      <span className="w-[70px] text-[11px] text-[var(--jd-faint)]">{prefix}</span>
      {type && <KindBadge kind={type.kind} size={16} />}
      <span className="truncate">{name}</span>
    </button>
  )
}

function RelationList({ title, relations, index, side, onClick }: { title: string; relations: Relation[]; index: GraphIndex; side: 'source' | 'target'; onClick: (id: string) => void }) {
  if (!relations.length) return null
  return (
    <Block title={`${title} · ${relations.length}`}>
      {relations.map((r, i) => {
        const other = index.types.get(r[side])
        return (
          <button
            key={i}
            className="flex w-full items-center gap-1.5 py-0.5 text-left text-[12px] hover:text-[var(--jd-accent)]"
            disabled={!other || other.external}
            onClick={() => onClick(r[side])}
          >
            {other && <KindBadge kind={other.kind} size={16} />}
            <span className="min-w-0 flex-1 truncate">{other?.name ?? r[side]}</span>
            <span className="text-[10.5px] text-[var(--jd-faint)]">
              {r.kind.toLowerCase()}
              {r.label ? ` · ${r.label}` : ''}
            </span>
          </button>
        )
      })}
    </Block>
  )
}

function CallList({ title, calls, index, side, onClick }: { title: string; calls: CallEdge[]; index: GraphIndex; side: 'source' | 'target'; onClick: (id: string) => void }) {
  if (!calls.length) return null
  return (
    <Block title={title}>
      {calls.map((c, i) => {
        const id = c[side]
        const method = index.methods.get(id)
        const owner = index.ownerOf.get(id)
        return (
          <button
            key={i}
            className="flex w-full items-baseline gap-1.5 py-0.5 text-left font-mono text-[11.5px] hover:text-[var(--jd-accent)]"
            onClick={() => onClick(id)}
          >
            <ArrowRight size={11} className={`shrink-0 self-center text-[var(--jd-faint)] ${side === 'source' ? 'rotate-180' : ''}`} />
            <span className="min-w-0 flex-1 truncate">
              <span className="text-[var(--jd-muted)]">{owner?.name}.</span>
              {method?.name}
            </span>
            <span className="text-[10px] text-[var(--jd-faint)]">{c.kind === 'OVERRIDE' ? 'impl' : c.line ? `L${c.line}` : ''}</span>
          </button>
        )
      })}
    </Block>
  )
}
