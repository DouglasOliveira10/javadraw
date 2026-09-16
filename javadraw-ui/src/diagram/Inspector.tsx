import { useMemo, useState, type ReactNode } from 'react'
import { ArrowRight, ChevronRight, Eye, EyeOff, Plus, Trash2, X } from 'lucide-react'
import type { GraphIndex } from '../data/graphIndex'
import type { CallEdge, MethodInfo, Relation } from '../data/types'
import { parameterTypes } from '../data/format'
import { EndpointBadge, KindBadge, StereotypePill, VisibilityGlyph } from '../components/Badges'
import { canRemove, edgesOf, relationEdgeId, callEdgeId, type CanvasState } from './canvasState'

interface Props {
  index: GraphIndex
  state: CanvasState
  typeId: string
  onClose: () => void
  onSelect: (typeId: string) => void
  onAddRelation: (relation: Relation, origin: string) => void
  onAddCall: (call: CallEdge, origin: string) => void
  onToggleField: (typeId: string, field: string) => void
  onToggleMethod: (typeId: string, methodId: string) => void
  onRemove: (typeId: string) => void
}

export function Inspector({
  index,
  state,
  typeId,
  onClose,
  onSelect,
  onAddRelation,
  onAddCall,
  onToggleField,
  onToggleMethod,
  onRemove,
}: Props) {
  const type = index.types.get(typeId)
  const node = state.nodes.find((n) => n.id === typeId)
  if (!type || !node) return null

  const relations = index.relationsOf.get(typeId) ?? []
  const hierarchy = relations.filter((r) => r.kind === 'EXTENDS' || r.kind === 'IMPLEMENTS')
  const uses = relations.filter((r) => r.source === typeId && r.kind !== 'EXTENDS' && r.kind !== 'IMPLEMENTS')
  const usedBy = relations.filter((r) => r.target === typeId && r.kind !== 'EXTENDS' && r.kind !== 'IMPLEMENTS')
  const members = (type.methods ?? []).filter((m) => !m.generated)
  const relationCount = edgesOf(state, typeId).length
  const removable = canRemove(state, typeId)

  return (
    <aside className="jd-panel jd-scroll flex w-[360px] shrink-0 flex-col overflow-y-auto border-l">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--jd-border)] bg-[var(--jd-surface)] px-4 py-2.5">
        <span className="jd-label">Selected</span>
        <button className="text-[var(--jd-faint)] hover:text-[var(--jd-text)]" onClick={onClose} title="Close">
          <X size={16} />
        </button>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div>
          <div className="flex items-center gap-2">
            <KindBadge kind={type.kind} abstract={type.modifiers?.includes('abstract')} size={24} />
            <h2 className="min-w-0 flex-1 truncate text-[16px] font-semibold">{type.name}</h2>
          </div>
          <div className="mt-1 break-all font-mono text-[11px] text-[var(--jd-faint)]">{type.id}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {type.stereotypes?.map((s) => <StereotypePill key={s} stereotype={s} />)}
            {[...(type.modifiers ?? []), type.external ? 'library' : null].filter(Boolean).map((m) => (
              <span key={m} className="rounded-full bg-[var(--jd-surface-2)] px-2 text-[10.5px] leading-[18px] text-[var(--jd-muted)]">
                {m}
              </span>
            ))}
          </div>
          <button
            className="jd-btn mt-3 w-full justify-center"
            disabled={!removable}
            onClick={() => onRemove(typeId)}
            title={
              removable
                ? 'Remove this card from the diagram'
                : `Holds ${relationCount} relations; remove the other ones first`
            }
          >
            <Trash2 size={14} />
            {removable ? 'Remove from diagram' : `Locked by ${relationCount} relations`}
          </button>
        </div>

        {hierarchy.length > 0 && (
          <Section title={`Hierarchy · ${hierarchy.length}`}>
            {hierarchy.map((r) => (
              <RelationRow
                key={relationEdgeId(r)}
                index={index}
                state={state}
                relation={r}
                otherId={r.source === typeId ? r.target : r.source}
                caption={r.source === typeId ? r.kind.toLowerCase() : r.kind === 'EXTENDS' ? 'extended by' : 'implemented by'}
                onAdd={() => onAddRelation(r, typeId)}
                onSelect={onSelect}
              />
            ))}
          </Section>
        )}

        {(type.fields?.length ?? 0) > 0 && (
          <Section title={`Fields · ${type.fields!.length}`}>
            {type.fields!.map((f) => {
              const relation = uses.find((r) => r.kind === 'ASSOCIATION' && r.label === f.name)
              return (
                <MemberRow
                  key={f.name}
                  visible={node.visibleFields.includes(f.name)}
                  onToggle={() => onToggleField(typeId, f.name)}
                  onAdd={relation && !onCanvas(state, relationEdgeId(relation)) ? () => onAddRelation(relation, typeId) : undefined}
                  addTitle={relation ? `Add ${shortName(relation.target)} and link it` : undefined}
                >
                  <VisibilityGlyph visibility={f.visibility} />
                  <span className="min-w-0 truncate">
                    {f.name}
                    <span className="text-[var(--jd-muted)]">: {f.type}</span>
                  </span>
                </MemberRow>
              )
            })}
          </Section>
        )}

        {members.length > 0 && (
          <Section title={`Methods · ${members.length}`}>
            {members.map((m) => (
              <MethodRow
                key={m.id}
                index={index}
                state={state}
                method={m}
                visible={node.visibleMethods.includes(m.id)}
                onToggle={() => onToggleMethod(typeId, m.id)}
                onAddCall={(call) => onAddCall(call, typeId)}
                onSelect={onSelect}
              />
            ))}
          </Section>
        )}

        {uses.length > 0 && (
          <Section title={`Uses · ${uses.length}`}>
            {uses.map((r) => (
              <RelationRow
                key={relationEdgeId(r)}
                index={index}
                state={state}
                relation={r}
                otherId={r.target}
                caption={r.kind === 'ASSOCIATION' ? (r.label ?? 'field') : 'uses'}
                onAdd={() => onAddRelation(r, typeId)}
                onSelect={onSelect}
              />
            ))}
          </Section>
        )}

        {usedBy.length > 0 && (
          <Section title={`Used by · ${usedBy.length}`}>
            {usedBy.map((r) => (
              <RelationRow
                key={relationEdgeId(r)}
                index={index}
                state={state}
                relation={r}
                otherId={r.source}
                caption={r.kind === 'ASSOCIATION' ? (r.label ?? 'field') : 'uses'}
                onAdd={() => onAddRelation(r, typeId)}
                onSelect={onSelect}
              />
            ))}
          </Section>
        )}
      </div>
    </aside>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="jd-label mb-1.5">{title}</h3>
      <div className="-mx-1">{children}</div>
    </div>
  )
}

function onCanvas(state: CanvasState, edgeId: string): boolean {
  return state.edges.some((e) => e.id === edgeId)
}

function shortName(typeId: string): string {
  return typeId.substring(typeId.lastIndexOf('.') + 1)
}

function MemberRow({
  visible,
  onToggle,
  onAdd,
  addTitle,
  children,
}: {
  visible: boolean
  onToggle: () => void
  onAdd?: () => void
  addTitle?: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center gap-1.5 rounded px-1 py-0.5 font-mono text-[11.5px] hover:bg-[var(--jd-surface-2)]">
      <button
        className={visible ? 'text-[var(--jd-accent)]' : 'text-[var(--jd-faint)] hover:text-[var(--jd-text)]'}
        onClick={onToggle}
        title={visible ? 'Hide on the card' : 'Show on the card'}
      >
        {visible ? <Eye size={13} /> : <EyeOff size={13} />}
      </button>
      <span className="flex min-w-0 flex-1 items-baseline gap-1.5">{children}</span>
      {onAdd && <AddButton onClick={onAdd} title={addTitle} />}
    </div>
  )
}

function AddButton({ onClick, title }: { onClick: () => void; title?: string }) {
  return (
    <button
      className="shrink-0 rounded p-0.5 text-[var(--jd-faint)] hover:bg-[var(--jd-accent)] hover:text-white"
      onClick={onClick}
      title={title ?? 'Add to the diagram'}
    >
      <Plus size={13} strokeWidth={3} />
    </button>
  )
}

function RelationRow({
  index,
  state,
  relation,
  otherId,
  caption,
  onAdd,
  onSelect,
}: {
  index: GraphIndex
  state: CanvasState
  relation: Relation
  otherId: string
  caption: string
  onAdd: () => void
  onSelect: (id: string) => void
}) {
  const other = index.types.get(otherId)
  const linked = onCanvas(state, relationEdgeId(relation))
  return (
    <div className={`flex items-center gap-1.5 rounded px-1 py-0.5 text-[12px] hover:bg-[var(--jd-surface-2)] ${linked ? 'opacity-60' : ''}`}>
      {other && <KindBadge kind={other.kind} size={16} />}
      <button className="min-w-0 flex-1 truncate text-left hover:text-[var(--jd-accent)]" onClick={() => onSelect(otherId)}>
        {other?.name ?? shortName(otherId)}
        <span className="ml-1.5 text-[10.5px] text-[var(--jd-faint)]">{caption}</span>
      </button>
      {linked ? <span className="pr-1 text-[10px] text-[var(--jd-faint)]">on canvas</span> : <AddButton onClick={onAdd} />}
    </div>
  )
}

function MethodRow({
  index,
  state,
  method,
  visible,
  onToggle,
  onAddCall,
  onSelect,
}: {
  index: GraphIndex
  state: CanvasState
  method: MethodInfo
  visible: boolean
  onToggle: () => void
  onAddCall: (call: CallEdge) => void
  onSelect: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const calls = useMemo(
    () => ({ out: index.outgoing.get(method.id) ?? [], in: index.incoming.get(method.id) ?? [] }),
    [index, method.id],
  )
  const total = calls.out.length + calls.in.length

  return (
    <div>
      <MemberRow visible={visible} onToggle={onToggle}>
        <VisibilityGlyph visibility={method.visibility} />
        <span className="min-w-0 flex-1 truncate">
          {method.name}
          <span className="text-[var(--jd-muted)]">({parameterTypes(method)})</span>
        </span>
        {method.endpoint && <EndpointBadge endpoint={method.endpoint} compact />}
        {total > 0 && (
          <button
            className="flex shrink-0 items-center text-[10px] text-[var(--jd-faint)] hover:text-[var(--jd-accent)]"
            onClick={() => setOpen(!open)}
            title="Calls of this method"
          >
            <ChevronRight size={11} className="transition-transform" style={{ transform: open ? 'rotate(90deg)' : undefined }} />
            {total}
          </button>
        )}
      </MemberRow>

      {open && (
        <div className="mb-1 ml-5 border-l border-[var(--jd-border)] pl-2">
          <CallList title="calls" calls={calls.out} side="target" index={index} state={state} onAdd={onAddCall} onSelect={onSelect} />
          <CallList title="called by" calls={calls.in} side="source" index={index} state={state} onAdd={onAddCall} onSelect={onSelect} />
        </div>
      )}
    </div>
  )
}

function CallList({
  title,
  calls,
  side,
  index,
  state,
  onAdd,
  onSelect,
}: {
  title: string
  calls: CallEdge[]
  side: 'source' | 'target'
  index: GraphIndex
  state: CanvasState
  onAdd: (call: CallEdge) => void
  onSelect: (id: string) => void
}) {
  if (calls.length === 0) return null
  return (
    <>
      <div className="mt-1 text-[10px] uppercase tracking-wide text-[var(--jd-faint)]">{title}</div>
      {calls.map((call) => {
        const other = index.methods.get(call[side])
        const owner = index.ownerOf.get(call[side])
        const linked = onCanvas(state, callEdgeId(call))
        return (
          <div
            key={call.source + call.target}
            className={`flex items-center gap-1.5 rounded px-1 py-0.5 font-mono text-[11px] hover:bg-[var(--jd-surface-2)] ${linked ? 'opacity-60' : ''}`}
          >
            <ArrowRight size={11} className={`shrink-0 text-[var(--jd-faint)] ${side === 'source' ? 'rotate-180' : ''}`} />
            <button className="min-w-0 flex-1 truncate text-left hover:text-[var(--jd-accent)]" onClick={() => owner && onSelect(owner.id)}>
              <span className="text-[var(--jd-muted)]">{owner?.name}.</span>
              {other?.name}
            </button>
            {linked ? <span className="pr-1 text-[10px] text-[var(--jd-faint)]">on canvas</span> : <AddButton onClick={() => onAdd(call)} />}
          </div>
        )
      })}
    </>
  )
}
