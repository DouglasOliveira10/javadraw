import { ArrowDown, Trash2, X } from 'lucide-react'
import type { ReactNode } from 'react'
import type { GraphIndex } from '../data/graphIndex'
import { KindBadge } from '../components/Badges'
import { useI18n } from '../i18n/I18nProvider'
import type { MessageKey } from '../i18n/messages'
import type { CanvasEdge, CanvasState, EdgeLine, EdgeMarker, EdgeStyle } from './canvasState'
import { EDGE_LINES, EDGE_MARKERS, edgeLook } from './edgeLook'
import { useEdgeTheme } from './EdgeTheme'

interface Props {
  index: GraphIndex
  state: CanvasState
  edgeId: string
  onClose: () => void
  onSelectNode: (typeId: string) => void
  onStyle: (edgeId: string, style: EdgeStyle) => void
  /** Throws away the bend points, back to the automatic route. */
  onResetRoute: (edgeId: string) => void
  onRemove: (edgeId: string) => void
}

/** The right panel while a single edge is selected: what it means, how it looks, and the way out. */
export function EdgeInspector({ index, state, edgeId, onClose, onSelectNode, onStyle, onResetRoute, onRemove }: Props) {
  const { t } = useI18n()
  const palette = useEdgeTheme()
  const edge = state.edges.find((e) => e.id === edgeId)
  if (!edge) return null

  const style = edge.style ?? {}
  const look = edgeLook(edge.kind, style, palette, false)
  const set = (change: EdgeStyle) => onStyle(edgeId, change)

  return (
    <aside className="jd-panel jd-scroll flex w-[360px] shrink-0 flex-col overflow-y-auto border-l">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--jd-border)] bg-[var(--jd-surface)] px-4 py-2.5">
        <span className="jd-label">{t('edge.title')}</span>
        <button className="text-[var(--jd-faint)] hover:text-[var(--jd-text)]" onClick={onClose} title={t('inspector.close')}>
          <X size={16} />
        </button>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div className="-mx-1 text-[13px]">
          <End index={index} typeId={edge.source} onSelect={onSelectNode} />
          <div className="flex items-center gap-1.5 px-1 py-0.5 text-[11px] text-[var(--jd-faint)]">
            <ArrowDown size={13} />
            {describe(edge, t)}
          </div>
          <End index={index} typeId={edge.target} onSelect={onSelectNode} />
        </div>

        <Section title={t('edge.line')}>
          <div className="grid grid-cols-3 gap-1.5">
            {EDGE_LINES.map((line) => (
              <button
                key={line}
                className={`jd-btn justify-center ${(style.line ?? defaultLine(look.dash)) === line ? 'jd-btn-active' : ''}`}
                onClick={() => set({ line })}
                title={t(`edge.line.${line}`)}
              >
                <LinePreview line={line} />
              </button>
            ))}
          </div>
        </Section>

        <Section title={t('edge.markers')}>
          <MarkerRow
            label={t('edge.startMarker')}
            value={look.startMarker}
            flip
            onChange={(startMarker) => set({ startMarker })}
          />
          <MarkerRow label={t('edge.endMarker')} value={look.endMarker} onChange={(endMarker) => set({ endMarker })} />
        </Section>

        <Section title={t('edge.color')}>
          <div className="flex items-center gap-2">
            <input
              type="color"
              className="jd-color-input"
              value={style.color ?? look.stroke}
              onChange={(event) => set({ color: event.target.value })}
              aria-label={t('edge.color')}
            />
            <span className="flex-1 font-mono text-[11px] text-[var(--jd-faint)]">{style.color ?? look.stroke}</span>
            {style.color && (
              <button className="jd-btn px-2 text-[11px]" onClick={() => set({ color: undefined })}>
                {t('edge.colorDefault')}
              </button>
            )}
          </div>
        </Section>

        <Section title={t('edge.label')}>
          <input
            className="jd-input"
            value={style.text ?? ''}
            placeholder={t('edge.labelPlaceholder')}
            spellCheck={false}
            onChange={(event) => set({ text: event.target.value })}
          />
        </Section>

        <div className="space-y-1.5">
          {(edge.anchors || edge.waypoints) && (
            <button className="jd-btn w-full justify-center" onClick={() => onResetRoute(edgeId)} title={t('edge.resetRouteHint')}>
              {t('edge.resetRoute')}
            </button>
          )}
          {edge.style && (
            <button
              className="jd-btn w-full justify-center"
              onClick={() => set({ line: undefined, startMarker: undefined, endMarker: undefined, color: undefined, text: undefined })}
            >
              {t('edge.resetStyle')}
            </button>
          )}
          <button className="jd-btn w-full justify-center" onClick={() => onRemove(edgeId)} title={t('edge.removeHint')}>
            <Trash2 size={14} /> {t('edge.remove')}
          </button>
        </div>
      </div>
    </aside>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="jd-label mb-1.5">{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </section>
  )
}

function MarkerRow({
  label,
  value,
  flip,
  onChange,
}: {
  label: string
  value: EdgeMarker
  flip?: boolean
  onChange: (marker: EdgeMarker) => void
}) {
  const { t } = useI18n()
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 shrink-0 text-[11px] text-[var(--jd-muted)]">{label}</span>
      <div className="grid flex-1 grid-cols-5 gap-1.5">
        {EDGE_MARKERS.map((marker) => (
          <button
            key={marker}
            className={`jd-btn justify-center ${value === marker ? 'jd-btn-active' : ''}`}
            onClick={() => onChange(marker)}
            title={t(`edge.marker.${marker}`)}
          >
            <MarkerPreview marker={marker} flip={flip} />
          </button>
        ))}
      </div>
    </div>
  )
}

function LinePreview({ line }: { line: EdgeLine }) {
  const dash = line === 'dashed' ? '6 4' : line === 'dotted' ? '1.5 4' : undefined
  return (
    <svg width="34" height="10" aria-hidden>
      <path d="M 1 5 H 33" stroke="currentColor" strokeWidth={1.6} strokeDasharray={dash} fill="none" />
    </svg>
  )
}

/** Small drawing of the arrow head, pointing the way it will point on the line. */
function MarkerPreview({ marker, flip }: { marker: EdgeMarker; flip?: boolean }) {
  return (
    <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      <path d="M 1 6 H 11" stroke="currentColor" strokeWidth={1.4} fill="none" />
      {marker === 'open' && <path d="M 10 2 L 16 6 L 10 10" stroke="currentColor" strokeWidth={1.4} fill="none" strokeLinecap="round" />}
      {marker === 'arrow' && <path d="M 9 2 L 17 6 L 9 10 L 11 6 z" fill="currentColor" />}
      {marker === 'triangle' && <path d="M 9 2 L 17 6 L 9 10 z" fill="none" stroke="currentColor" strokeWidth={1.4} />}
      {marker === 'diamond' && <path d="M 8 6 L 12 3 L 16 6 L 12 9 z" fill="currentColor" />}
    </svg>
  )
}

function defaultLine(dash?: string): EdgeLine {
  if (!dash) return 'solid'
  return dash.startsWith('6') ? 'dashed' : 'dotted'
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
