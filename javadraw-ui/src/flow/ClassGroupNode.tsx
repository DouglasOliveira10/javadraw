import { memo, type CSSProperties } from 'react'
import type { Node, NodeProps } from '@xyflow/react'
import type { ClassGroupData } from './buildCallFlow'
import { KindBadge, StereotypePill } from '../components/Badges'
import { GROUP_HEADER } from '../layout/elkLayout'
import { accentOf } from '../theme'

function ClassGroupNodeComponent({ data }: NodeProps<Node<ClassGroupData>>) {
  const { type } = data
  const external = type?.external
  return (
    <div
      className={`jd-group ${external ? '' : 'jd-group-solid'}`}
      style={{ '--accent': accentOf(type) } as CSSProperties}
    >
      <div className="flex items-center gap-2 px-3" style={{ height: GROUP_HEADER }}>
        {type && <KindBadge kind={type.kind} abstract={type.modifiers?.includes('abstract')} size={18} />}
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[12.5px] font-semibold">{type?.name ?? '?'}</div>
          {external && <div className="truncate font-mono text-[10px] text-[var(--jd-faint)]">{type?.packageName}</div>}
        </div>
        <span className="ml-auto">{type?.stereotypes?.[0] && <StereotypePill stereotype={type.stereotypes[0]} />}</span>
      </div>
    </div>
  )
}

export const ClassGroupNode = memo(ClassGroupNodeComponent)
