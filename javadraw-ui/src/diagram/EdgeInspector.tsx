import { ArrowDown, Trash2, X } from 'lucide-react'
import type { GraphIndex } from '../data/graphIndex'
import { KindBadge } from '../components/Badges'
import { useI18n } from '../i18n/I18nProvider'
import type { MessageKey } from '../i18n/messages'
import type { CanvasEdge, CanvasState } from './canvasState'

interface Props {
  index: GraphIndex
  state: CanvasState
  edgeId: string
  onClose: () => void
  onSelectNode: (typeId: string) => void
  onRemove: (edgeId: string) => void
}

/** The right panel while a single edge is selected. */
export function EdgeInspector({ index, state, edgeId, onClose, onSelectNode, onRemove }: Props) {
  const { t } = useI18n()
  const edge = state.edges.find((e) => e.id === edgeId)
  if (!edge) return null

  return (
    <aside className="jd-panel jd-scroll flex w-[360px] shrink-0 flex-col overflow-y-auto border-l">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--jd-border)] bg-[var(--jd-surface)] px-4 py-2.5">
        <span className="jd-label">{t('edge.title')}</span>
        <button className="text-[var(--jd-faint)] hover:text-[var(--jd-text)]" onClick={onClose} title={t('inspector.close')}>
          <X size={16} />
        </button>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div>
          <div className="-mx-1 text-[13px]">
            <End index={index} typeId={edge.source} onSelect={onSelectNode} />
            <div className="flex items-center gap-1.5 px-1 py-0.5 text-[11px] text-[var(--jd-faint)]">
              <ArrowDown size={13} />
              {describe(edge, t)}
            </div>
            <End index={index} typeId={edge.target} onSelect={onSelectNode} />
          </div>
        </div>

        <button className="jd-btn w-full justify-center" onClick={() => onRemove(edgeId)} title={t('edge.removeHint')}>
          <Trash2 size={14} /> {t('edge.remove')}
        </button>
      </div>
    </aside>
  )
}

function End({ index, typeId, onSelect }: { index: GraphIndex; typeId: string; onSelect: (typeId: string) => void }) {
  const type = index.types.get(typeId)
  return (
    <button
      className="flex w-full min-w-0 items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-[var(--jd-surface-2)] hover:text-[var(--jd-accent)]"
      onClick={() => onSelect(typeId)}
      title={typeId}
    >
      {type && <KindBadge kind={type.kind} size={16} />}
      <span className="min-w-0 truncate">{type?.name ?? typeId.substring(typeId.lastIndexOf('.') + 1)}</span>
    </button>
  )
}

/** "Field · pessoa", "Call · L42", "Inheritance" — what the line stands for. */
function describe(edge: CanvasEdge, t: (key: MessageKey) => string): string {
  const kind = t(`edgeKind.${edge.kind}`)
  if (edge.kind === 'ASSOCIATION' && edge.label) return `${kind} · ${edge.label}`
  if (edge.kind === 'CALL' && edge.line) return `${kind} · L${edge.line}`
  return kind
}
