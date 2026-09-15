import { memo, type CSSProperties } from 'react'
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { Plus } from 'lucide-react'
import type { MethodNodeData } from './buildCallFlow'
import { EndpointBadge, VisibilityGlyph } from '../components/Badges'
import { useDiagramActions } from '../components/DiagramContext'
import { parameterTypes, splitSignature } from '../data/format'
import { accentOf } from '../theme'

function MethodNodeComponent({ data }: NodeProps<Node<MethodNodeData>>) {
  const { method, owner, root, more } = data
  const { expandMethod } = useDiagramActions()
  const { returns } = splitSignature(method)
  const params = parameterTypes(method)
  const classes = ['jd-card', owner?.external && 'jd-external', root && 'jd-highlight'].filter(Boolean).join(' ')

  return (
    <div className="relative">
      <div className={classes} style={{ '--accent': accentOf(owner), minWidth: 170 } as CSSProperties}>
        <div className="px-3 py-2">
          {method.endpoint && (
            <div className="mb-1 flex">
              <EndpointBadge endpoint={method.endpoint} />
            </div>
          )}
          <div className="flex items-baseline gap-1.5 font-mono text-[12px]">
            <VisibilityGlyph visibility={method.visibility} />
            <span>
              <span className={`font-semibold ${method.isAbstract ? 'italic' : ''}`}>
                {method.isConstructor ? `new ${method.name}` : method.name}
              </span>
              <span className="text-[var(--jd-muted)]">({params})</span>
            </span>
          </div>
          {((returns && returns !== 'void') || method.isAbstract || method.inherited) && (
            <div className="mt-0.5 flex items-center gap-2 pl-4 font-mono text-[10.5px] text-[var(--jd-faint)]">
              {returns && returns !== 'void' && <span>→ {returns}</span>}
              {method.isAbstract && <span className="italic">abstract</span>}
              {method.inherited && <span className="italic">inherited</span>}
            </div>
          )}
        </div>
      </div>

      {more > 0 && (
        <button
          className="nodrag absolute -right-3 top-1/2 grid h-6 min-w-6 -translate-y-1/2 place-items-center rounded-full border border-[var(--jd-border)] bg-[var(--jd-surface)] px-1.5 text-[10.5px] font-bold text-[var(--jd-muted)] shadow-sm transition hover:border-[var(--jd-accent)] hover:text-[var(--jd-accent)]"
          title={`Show ${more} more call${more === 1 ? '' : 's'}`}
          onClick={(e) => {
            e.stopPropagation()
            expandMethod(method.id)
          }}
        >
          <span className="flex items-center">
            <Plus size={11} strokeWidth={3} />
            {more}
          </span>
        </button>
      )}
      <Handle type="target" position={Position.Left} className="jd-handle" />
      <Handle type="source" position={Position.Right} className="jd-handle" />
    </div>
  )
}

export const MethodNode = memo(MethodNodeComponent)
