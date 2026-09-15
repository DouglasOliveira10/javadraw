import { memo } from 'react'
import type { Node, NodeProps } from '@xyflow/react'
import { Package } from 'lucide-react'
import type { PackageNodeData } from './buildStructureDiagram'
import { GROUP_HEADER } from '../layout/elkLayout'

function PackageNodeComponent({ data }: NodeProps<Node<PackageNodeData>>) {
  return (
    <div className="jd-group">
      <div className="flex items-center gap-2 px-4 text-[var(--jd-muted)]" style={{ height: GROUP_HEADER }}>
        <Package size={14} className="shrink-0" />
        <span className="truncate font-mono text-[12px] font-medium">{data.name}</span>
        <span className="ml-auto rounded-full bg-[var(--jd-surface-2)] px-2 text-[10.5px] font-semibold">{data.count}</span>
      </div>
    </div>
  )
}

export const PackageNode = memo(PackageNodeComponent)
