import { memo, type CSSProperties } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { Crosshair } from 'lucide-react'
import type { TypeNodeData } from './buildStructureDiagram'
import { EndpointBadge, KindBadge, StereotypePill, VisibilityGlyph } from '../components/Badges'
import { useDiagramActions } from '../components/DiagramContext'
import { splitSignature } from '../data/format'
import { accentOf } from '../theme'

function TypeNodeComponent({ data }: NodeProps<Node<TypeNodeData>>) {
  const { type, fields, methods, hiddenMembers, showPackage, focused } = data
  const { expandType, focusType } = useDiagramActions()
  const abstract = type.modifiers?.includes('abstract')
  const classes = ['jd-card', type.external && 'jd-external', type.kind === 'INTERFACE' && 'jd-interface', focused && 'jd-highlight']
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes} style={{ '--accent': accentOf(type) } as CSSProperties}>
      <Handle type="target" position={Position.Top} className="jd-handle" />
      <div className="group flex items-start gap-2 px-3 pb-2 pt-2">
        <KindBadge kind={type.kind} abstract={abstract} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`truncate text-[13.5px] font-semibold ${abstract ? 'italic' : ''}`}>{type.name}</span>
            {type.stereotypes?.slice(0, 1).map((s) => <StereotypePill key={s} stereotype={s} />)}
          </div>
          {(showPackage || type.external) && type.packageName && (
            <div className="truncate font-mono text-[10.5px] text-[var(--jd-faint)]">{type.packageName}</div>
          )}
        </div>
        {!type.external && (
          <button
            className="nodrag -mr-1 rounded p-0.5 text-[var(--jd-faint)] opacity-0 transition group-hover:opacity-100 hover:text-[var(--jd-accent)]"
            title="Focus on this type and its neighbors"
            onClick={(e) => {
              e.stopPropagation()
              focusType(type.id)
            }}
          >
            <Crosshair size={14} />
          </button>
        )}
      </div>

      {fields.length > 0 && (
        <div className="jd-section border-t border-[var(--jd-border)] py-1.5">
          {fields.map((f) => (
            <div key={f.name} className="jd-row">
              <VisibilityGlyph visibility={f.visibility} />
              <span>
                <span className={f.isStatic ? 'underline decoration-dotted underline-offset-2' : ''}>{f.name}</span>
                <span className="jd-type">: {f.type}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {methods.length > 0 && (
        <div className="jd-section border-t border-[var(--jd-border)] py-1.5">
          {methods.map((m) => {
            const { params, returns } = splitSignature(m)
            return (
              <div key={m.id} className="jd-row">
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
              </div>
            )
          })}
        </div>
      )}

      {hiddenMembers > 0 && (
        <button
          className="nodrag w-full border-t border-[var(--jd-border)] py-1 text-[11px] font-medium text-[var(--jd-muted)] hover:bg-[var(--jd-surface-2)] hover:text-[var(--jd-accent)]"
          onClick={(e) => {
            e.stopPropagation()
            expandType(type.id)
          }}
        >
          + {hiddenMembers} more
        </button>
      )}
      <Handle type="source" position={Position.Bottom} className="jd-handle" />
    </div>
  )
}

export const TypeNode = memo(TypeNodeComponent)
