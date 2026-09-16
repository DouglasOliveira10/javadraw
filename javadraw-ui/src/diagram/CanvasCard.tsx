import { memo, type CSSProperties, type ReactNode } from 'react'
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { EndpointBadge, KindBadge, StereotypePill, VisibilityGlyph } from '../components/Badges'
import { splitSignature } from '../data/format'
import { accentOf } from '../theme'
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

function Row({ children, handleId }: { children: ReactNode; handleId: (side: Side) => string }) {
  return (
    <div className="jd-row relative">
      <RowHandles id={handleId} />
      {children}
    </div>
  )
}

function CanvasCardComponent({ data }: NodeProps<Node<CardData>>) {
  const { type, fields, methods, hiddenCount } = data
  const abstract = type.modifiers?.includes('abstract')
  const classes = ['jd-card', type.external && 'jd-external', type.kind === 'INTERFACE' && 'jd-interface']
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes} style={{ '--accent': accentOf(type) } as CSSProperties}>
      <RowHandles id={cardHandle} />

      <div className="flex items-start gap-2 px-3 pb-2 pt-2">
        <KindBadge kind={type.kind} abstract={abstract} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`truncate text-[13.5px] font-semibold ${abstract ? 'italic' : ''}`}>{type.name}</span>
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
            <Row key={f.name} handleId={(side) => fieldHandle(f.name, side)}>
              <VisibilityGlyph visibility={f.visibility} />
              <span>
                <span className={f.isStatic ? 'underline decoration-dotted underline-offset-2' : ''}>{f.name}</span>
                <span className="jd-type">: {f.type}</span>
              </span>
            </Row>
          ))}
        </div>
      )}

      {methods.length > 0 && (
        <div className="border-t border-[var(--jd-border)] py-1.5">
          {methods.map((m) => {
            const { params, returns } = splitSignature(m)
            return (
              <Row key={m.id} handleId={(side) => methodHandle(m.id, side)}>
                <VisibilityGlyph visibility={m.visibility} />
                <span className={`${m.isAbstract ? 'italic' : ''} ${m.isStatic ? 'underline decoration-dotted underline-offset-2' : ''}`}>
                  {m.name}
                </span>
                <span className="jd-type -ml-1.5">
                  ({params}){returns && returns !== 'void' ? `: ${returns}` : ''}
                </span>
                {m.endpoint && (
                  <span className="ml-auto pl-3">
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
          {hiddenCount} members hidden
        </div>
      )}
    </div>
  )
}

export const CanvasCard = memo(CanvasCardComponent)
