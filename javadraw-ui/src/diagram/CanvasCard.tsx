import { memo, type CSSProperties, type ReactNode } from 'react'
import { Handle, NodeResizer, Position, type Node, type NodeProps } from '@xyflow/react'
import { EndpointBadge, KindBadge, StereotypePill, VisibilityGlyph } from '../components/Badges'
import { parameterTypes, splitSignature } from '../data/format'
import type { MethodInfo } from '../data/types'
import { accentOf } from '../theme'
import { usePalette } from '../data/palette'
import { useI18n } from '../i18n/I18nProvider'
import { useCardActions } from './CardActions'
import { cardHandle, fieldHandle, methodHandle, type Side } from './handles'
import type { CardData } from './toReactFlow'

const SIDES: { side: Side; position: Position }[] = [
  { side: 'l', position: Position.Left },
  { side: 'r', position: Position.Right },
  { side: 't', position: Position.Top },
  { side: 'b', position: Position.Bottom },
]

/** Invisible connection points; every row can be an arrow endpoint on any side. */
function RowHandles({ id }: { id: (side: Side) => string }) {
  return (
    <>
      {SIDES.map(({ side, position }) => (
        <span key={side}>
          <Handle type="source" id={id(side)} position={position} className="jd-handle" />
          <Handle type="target" id={id(side)} position={position} className="jd-handle" />
        </span>
      ))}
    </>
  )
}

/** One member line: truncated with an ellipsis, with the full text in the tooltip. */
function Row({ children, handleId, title }: { children: ReactNode; handleId: (side: Side) => string; title: string }) {
  return (
    <div className="jd-row relative" title={title}>
      <RowHandles id={handleId} />
      {children}
    </div>
  )
}

/** place(Order order): Receipt → place(): Receipt or place(Order order), depending on the switches. */
function methodLabel(method: MethodInfo, showParameters: boolean, showReturnTypes: boolean): { name: string; params: string; returns?: string } {
  const { returns } = splitSignature(method)
  return {
    name: method.isConstructor ? `new ${method.name}` : method.name,
    params: showParameters ? parameterTypes(method) : '',
    returns: showReturnTypes && returns && returns !== 'void' ? returns : undefined,
  }
}

function CanvasCardComponent({ id, data, selected }: NodeProps<Node<CardData>>) {
  const { type, fields, methods, hiddenCount, showFieldTypes, showParameters, showReturnTypes, sized } = data
  const { resize } = useCardActions()
  const palette = usePalette()
  const { tc } = useI18n()
  const abstract = type.modifiers?.includes('abstract')
  const classes = [
    'jd-card',
    sized && 'jd-card-sized',
    type.external && 'jd-external',
    type.kind === 'INTERFACE' && 'jd-interface',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      <NodeResizer
        isVisible={!!selected}
        minWidth={190}
        minHeight={70}
        lineClassName="jd-resize-line"
        handleClassName="jd-resize-handle"
        onResizeEnd={(_, params) => resize(id, { width: Math.round(params.width), height: Math.round(params.height) })}
      />
      <div className={classes} style={{ '--accent': accentOf(type, palette) } as CSSProperties}>
        <RowHandles id={cardHandle} />

        <div className="flex items-start gap-2 px-3 pb-2 pt-2">
          <KindBadge kind={type.kind} abstract={abstract} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`truncate text-[13.5px] font-semibold ${abstract ? 'italic' : ''}`} title={type.id}>
                {type.name}
              </span>
              {type.stereotypes?.slice(0, 1).map((s) => <StereotypePill key={s} stereotype={s} />)}
            </div>
            {type.packageName && (
              <div className="truncate font-mono text-[10.5px] text-[var(--jd-faint)]">{type.packageName}</div>
            )}
          </div>
        </div>

        {fields.length > 0 && (
          <div className="border-t border-[var(--jd-border)] py-1.5">
            {fields.map((f) => (
              <Row key={f.name} handleId={(side) => fieldHandle(f.name, side)} title={`${f.name}: ${f.type}`}>
                <VisibilityGlyph visibility={f.visibility} />
                <span className="min-w-0 flex-1 truncate">
                  <span className={f.isStatic ? 'underline decoration-dotted underline-offset-2' : ''}>{f.name}</span>
                  {showFieldTypes && <span className="jd-type">: {f.type}</span>}
                </span>
              </Row>
            ))}
          </div>
        )}

        {methods.length > 0 && (
          <div className="border-t border-[var(--jd-border)] py-1.5">
            {methods.map((m) => {
              const label = methodLabel(m, showParameters, showReturnTypes)
              return (
                <Row key={m.id} handleId={(side) => methodHandle(m.id, side)} title={m.signature}>
                  <VisibilityGlyph visibility={m.visibility} />
                  <span className="min-w-0 flex-1 truncate">
                    <span
                      className={`${m.isAbstract ? 'italic' : ''} ${m.isStatic ? 'underline decoration-dotted underline-offset-2' : ''}`}
                    >
                      {label.name}
                    </span>
                    <span className="jd-type">
                      ({label.params}){label.returns ? `: ${label.returns}` : ''}
                    </span>
                  </span>
                  {m.endpoint && (
                    <span className="shrink-0 pl-2">
                      <EndpointBadge endpoint={m.endpoint} compact />
                    </span>
                  )}
                </Row>
              )
            })}
          </div>
        )}

        {fields.length + methods.length === 0 && hiddenCount > 0 && (
          <div className="border-t border-[var(--jd-border)] px-3 py-1 text-[10.5px] text-[var(--jd-faint)]">
            {tc('card.membersHidden', hiddenCount)}
          </div>
        )}
      </div>
    </>
  )
}

export const CanvasCard = memo(CanvasCardComponent)
