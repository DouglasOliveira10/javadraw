import type { ReactNode } from 'react'
import { Eye, EyeOff, Maximize2, Plus, Trash2, X } from 'lucide-react'
import type { GraphIndex } from '../data/graphIndex'
import type { MethodInfo, Relation } from '../data/types'
import { parameterTypes, splitSignature } from '../data/format'
import { EndpointBadge, KindBadge, StereotypePill, VisibilityGlyph } from '../components/Badges'
import { useI18n } from '../i18n/I18nProvider'
import { canRemove, edgesOf, relationEdgeId, type CanvasState } from './canvasState'
import { nextSectionValue, visibilityOf, type Visibility } from './members'

interface Props {
  index: GraphIndex
  state: CanvasState
  typeId: string
  onClose: () => void
  onSelect: (typeId: string) => void
  onAddRelation: (relation: Relation, origin: string) => void
  onToggleField: (typeId: string, field: string) => void
  onToggleMethod: (typeId: string, methodId: string) => void
  /** Reveals or hides a whole section of the card at once. */
  onToggleSection: (typeId: string, section: 'fields' | 'methods', visible: boolean) => void
  /** Back to sizing by content, for a card the user resized. */
  onAutoSize: (typeId: string) => void
  showFieldTypes: boolean
  showParameters: boolean
  showReturnTypes: boolean
  onRemove: (typeId: string) => void
}

export function Inspector({
  index,
  state,
  typeId,
  onClose,
  onSelect,
  onAddRelation,
  onToggleField,
  onToggleMethod,
  onToggleSection,
  onAutoSize,
  showFieldTypes,
  showParameters,
  showReturnTypes,
  onRemove,
}: Props) {
  const { t } = useI18n()
  const type = index.types.get(typeId)
  const node = state.nodes.find((n) => n.id === typeId)
  if (!type || !node) return null

  const relations = index.relationsOf.get(typeId) ?? []
  const hierarchy = relations.filter((r) => r.kind === 'EXTENDS' || r.kind === 'IMPLEMENTS')
  const uses = relations.filter((r) => r.source === typeId && r.kind !== 'EXTENDS' && r.kind !== 'IMPLEMENTS')
  const usedBy = relations.filter((r) => r.target === typeId && r.kind !== 'EXTENDS' && r.kind !== 'IMPLEMENTS')
  const members = (type.methods ?? []).filter((m) => !m.generated)
  const fieldsVisibility = visibilityOf(node.visibleFields, (type.fields ?? []).map((f) => f.name))
  const methodsVisibility = visibilityOf(node.visibleMethods, members.map((m) => m.id))
  const relationCount = edgesOf(state, typeId).length
  const removable = canRemove(state, typeId)

  return (
    <aside className="jd-panel jd-scroll flex w-[360px] shrink-0 flex-col overflow-y-auto border-l">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--jd-border)] bg-[var(--jd-surface)] px-4 py-2.5">
        <span className="jd-label">{t('inspector.selected')}</span>
        <button className="text-[var(--jd-faint)] hover:text-[var(--jd-text)]" onClick={onClose} title={t('inspector.close')}>
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
            {[...(type.modifiers ?? []), type.external ? t('inspector.library') : null].filter(Boolean).map((m) => (
              <span key={m} className="rounded-full bg-[var(--jd-surface-2)] px-2 text-[10.5px] leading-[18px] text-[var(--jd-muted)]">
                {m}
              </span>
            ))}
          </div>
          {node.size && (
            <button
              className="jd-btn mt-3 w-full justify-center"
              onClick={() => onAutoSize(typeId)}
              title={t('inspector.resetSizeHint')}
            >
              <Maximize2 size={14} /> {t('inspector.resetSize')}
            </button>
          )}
          <button
            className="jd-btn mt-3 w-full justify-center"
            disabled={!removable}
            onClick={() => onRemove(typeId)}
            title={removable ? t('inspector.removeHint') : t('inspector.lockedHint', { count: relationCount })}
          >
            <Trash2 size={14} />
            {removable ? t('inspector.removeFromDiagram') : t('inspector.locked', { count: relationCount })}
          </button>
        </div>

        {hierarchy.length > 0 && (
          <Section title={`${t('inspector.hierarchy')} · ${hierarchy.length}`}>
            {hierarchy.map((r) => (
              <RelationRow
                key={relationEdgeId(r)}
                index={index}
                state={state}
                relation={r}
                otherId={r.source === typeId ? r.target : r.source}
                caption={
                  r.source === typeId
                    ? t(r.kind === 'EXTENDS' ? 'inspector.extends' : 'inspector.implements')
                    : t(r.kind === 'EXTENDS' ? 'inspector.extendedBy' : 'inspector.implementedBy')
                }
                onAdd={() => onAddRelation(r, typeId)}
                onSelect={onSelect}
              />
            ))}
          </Section>
        )}

        {(type.fields?.length ?? 0) > 0 && (
          <Section
            title={t('inspector.fields')}
            action={
              <SectionEye
                visibility={fieldsVisibility}
                shown={node.visibleFields.filter((f) => type.fields!.some((field) => field.name === f)).length}
                total={type.fields!.length}
                onClick={() => onToggleSection(typeId, 'fields', nextSectionValue(fieldsVisibility))}
              />
            }
          >
            {type.fields!.map((f) => {
              const relation = uses.find((r) => r.kind === 'ASSOCIATION' && r.label === f.name)
              return (
                <MemberRow
                  key={f.name}
                  visible={node.visibleFields.includes(f.name)}
                  onToggle={() => onToggleField(typeId, f.name)}
                  onAdd={relation && !onCanvas(state, relationEdgeId(relation)) ? () => onAddRelation(relation, typeId) : undefined}
                  addTitle={relation ? t('inspector.addAndLink', { name: shortName(relation.target) }) : undefined}
                  title={`${f.name}: ${f.type}`}
                >
                  <VisibilityGlyph visibility={f.visibility} />
                  <span className="min-w-0 truncate">
                    {f.name}
                    {showFieldTypes && <span className="text-[var(--jd-muted)]">: {f.type}</span>}
                  </span>
                </MemberRow>
              )
            })}
          </Section>
        )}

        {members.length > 0 && (
          <Section
            title={t('inspector.methods')}
            action={
              <SectionEye
                visibility={methodsVisibility}
                shown={members.filter((m) => node.visibleMethods.includes(m.id)).length}
                total={members.length}
                onClick={() => onToggleSection(typeId, 'methods', nextSectionValue(methodsVisibility))}
              />
            }
          >
            {members.map((m) => (
              <MemberRow key={m.id} visible={node.visibleMethods.includes(m.id)} onToggle={() => onToggleMethod(typeId, m.id)} title={m.signature}>
                <VisibilityGlyph visibility={m.visibility} />
                <span className="min-w-0 flex-1 truncate">
                  {m.name}
                  <span className="text-[var(--jd-muted)]">
                    ({showParameters ? parameterTypes(m) : ''}){showReturnTypes && returnTypeOf(m) ? `: ${returnTypeOf(m)}` : ''}
                  </span>
                </span>
                {m.endpoint && <EndpointBadge endpoint={m.endpoint} compact />}
              </MemberRow>
            ))}
          </Section>
        )}

        {uses.length > 0 && (
          <Section title={`${t('inspector.uses')} · ${uses.length}`}>
            {uses.map((r) => (
              <RelationRow
                key={relationEdgeId(r)}
                index={index}
                state={state}
                relation={r}
                otherId={r.target}
                caption={r.kind === 'ASSOCIATION' ? (r.label ?? t('inspector.fieldCaption')) : t('inspector.usesCaption')}
                onAdd={() => onAddRelation(r, typeId)}
                onSelect={onSelect}
              />
            ))}
          </Section>
        )}

        {usedBy.length > 0 && (
          <Section title={`${t('inspector.usedBy')} · ${usedBy.length}`}>
            {usedBy.map((r) => (
              <RelationRow
                key={relationEdgeId(r)}
                index={index}
                state={state}
                relation={r}
                otherId={r.source}
                caption={r.kind === 'ASSOCIATION' ? (r.label ?? t('inspector.fieldCaption')) : t('inspector.usesCaption')}
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

function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h3 className="jd-label">{title}</h3>
        {action}
      </div>
      <div className="-mx-1">{children}</div>
    </div>
  )
}

/** Section level eye: reveals everything, or hides everything when the section is fully revealed. */
function SectionEye({
  visibility,
  shown,
  total,
  onClick,
}: {
  visibility: Visibility
  shown: number
  total: number
  onClick: () => void
}) {
  const { t } = useI18n()
  return (
    <button
      className={`flex items-center gap-1.5 rounded px-1 text-[10.5px] ${
        visibility === 'none' ? 'text-[var(--jd-faint)]' : 'text-[var(--jd-accent)]'
      } hover:bg-[var(--jd-surface-2)]`}
      onClick={onClick}
      title={t(visibility === 'all' ? 'inspector.hideAllOnCard' : 'inspector.showAllOnCard')}
    >
      <span className="font-mono">
        {shown}/{total}
      </span>
      {visibility === 'none' ? <EyeOff size={13} /> : <Eye size={13} className={visibility === 'partial' ? 'opacity-60' : ''} />}
    </button>
  )
}

function returnTypeOf(method: MethodInfo): string | undefined {
  const { returns } = splitSignature(method)
  return returns && returns !== 'void' ? returns : undefined
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
  title,
  children,
}: {
  visible: boolean
  onToggle: () => void
  onAdd?: () => void
  addTitle?: string
  title?: string
  children: ReactNode
}) {
  const { t } = useI18n()
  return (
    <div className="flex items-center gap-1.5 rounded px-1 py-0.5 font-mono text-[11.5px] hover:bg-[var(--jd-surface-2)]" title={title}>
      <button
        className={visible ? 'text-[var(--jd-accent)]' : 'text-[var(--jd-faint)] hover:text-[var(--jd-text)]'}
        onClick={onToggle}
        title={t(visible ? 'inspector.hideOnCard' : 'inspector.showOnCard')}
      >
        {visible ? <Eye size={13} /> : <EyeOff size={13} />}
      </button>
      <span className="flex min-w-0 flex-1 items-baseline gap-1.5">{children}</span>
      {onAdd && <AddButton onClick={onAdd} title={addTitle} />}
    </div>
  )
}

function AddButton({ onClick, title }: { onClick: () => void; title?: string }) {
  const { t } = useI18n()
  return (
    <button
      className="shrink-0 rounded p-0.5 text-[var(--jd-faint)] hover:bg-[var(--jd-accent)] hover:text-white"
      onClick={onClick}
      title={title ?? t('inspector.addToDiagram')}
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
  const { t } = useI18n()
  const other = index.types.get(otherId)
  const linked = onCanvas(state, relationEdgeId(relation))
  return (
    <div className={`flex items-center gap-1.5 rounded px-1 py-0.5 text-[12px] hover:bg-[var(--jd-surface-2)] ${linked ? 'opacity-60' : ''}`}>
      {other && <KindBadge kind={other.kind} size={16} />}
      <button className="min-w-0 flex-1 truncate text-left hover:text-[var(--jd-accent)]" onClick={() => onSelect(otherId)}>
        {other?.name ?? shortName(otherId)}
        <span className="ml-1.5 text-[10.5px] text-[var(--jd-faint)]">{caption}</span>
      </button>
      {linked ? (
        <span className="pr-1 text-[10px] text-[var(--jd-faint)]">{t('inspector.onCanvas')}</span>
      ) : (
        <AddButton onClick={onAdd} />
      )}
    </div>
  )
}
