import type { ReactNode } from 'react'
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalSpaceAround,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalSpaceAround,
  Eye,
  EyeOff,
  LayoutGrid,
  Trash2,
  X,
} from 'lucide-react'
import type { GraphIndex } from '../data/graphIndex'
import { KindBadge } from '../components/Badges'
import type { Alignment, Axis } from './align'
import type { CanvasState } from './canvasState'
import { canRemove } from './canvasState'

interface Props {
  index: GraphIndex
  state: CanvasState
  selectedIds: string[]
  onClose: () => void
  onSelect: (typeId: string) => void
  onAlign: (alignment: Alignment) => void
  onDistribute: (axis: Axis) => void
  onArrange: () => void
  onMembers: (visible: boolean) => void
  onRemove: () => void
}

const ALIGNMENTS: { alignment: Alignment; label: string; icon: ReactNode }[] = [
  { alignment: 'left', label: 'Align left', icon: <AlignStartVertical size={15} /> },
  { alignment: 'hcenter', label: 'Align center', icon: <AlignCenterVertical size={15} /> },
  { alignment: 'right', label: 'Align right', icon: <AlignEndVertical size={15} /> },
  { alignment: 'top', label: 'Align top', icon: <AlignStartHorizontal size={15} /> },
  { alignment: 'vmiddle', label: 'Align middle', icon: <AlignCenterHorizontal size={15} /> },
  { alignment: 'bottom', label: 'Align bottom', icon: <AlignEndHorizontal size={15} /> },
]

export function SelectionPanel({
  index,
  state,
  selectedIds,
  onClose,
  onSelect,
  onAlign,
  onDistribute,
  onArrange,
  onMembers,
  onRemove,
}: Props) {
  const removable = selectedIds.filter((id) => canRemove(state, id)).length
  const anyMemberShown = state.nodes.some(
    (n) => selectedIds.includes(n.id) && (n.visibleFields.length > 0 || n.visibleMethods.length > 0),
  )

  return (
    <aside className="jd-panel jd-scroll flex w-[360px] shrink-0 flex-col overflow-y-auto border-l">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--jd-border)] bg-[var(--jd-surface)] px-4 py-2.5">
        <span className="jd-label">{selectedIds.length} cards selected</span>
        <button className="text-[var(--jd-faint)] hover:text-[var(--jd-text)]" onClick={onClose} title="Clear selection">
          <X size={16} />
        </button>
      </div>

      <div className="space-y-4 px-4 py-4">
        <section>
          <h3 className="jd-label mb-1.5">Align</h3>
          <div className="grid grid-cols-3 gap-1.5">
            {ALIGNMENTS.map(({ alignment, label, icon }) => (
              <button key={alignment} className="jd-btn justify-center" onClick={() => onAlign(alignment)} title={label}>
                {icon}
              </button>
            ))}
          </div>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            <button
              className="jd-btn justify-center"
              onClick={() => onDistribute('horizontal')}
              disabled={selectedIds.length < 3}
              title="Distribute horizontally (needs 3 cards)"
            >
              <AlignHorizontalSpaceAround size={15} />
            </button>
            <button
              className="jd-btn justify-center"
              onClick={() => onDistribute('vertical')}
              disabled={selectedIds.length < 3}
              title="Distribute vertically (needs 3 cards)"
            >
              <AlignVerticalSpaceAround size={15} />
            </button>
          </div>
        </section>

        <section className="space-y-1.5">
          <button className="jd-btn w-full justify-center" onClick={onArrange} title="Run ELK on the selected cards only">
            <LayoutGrid size={14} /> Auto-arrange selection
          </button>
          <button
            className="jd-btn w-full justify-center"
            onClick={() => onMembers(!anyMemberShown)}
            title={anyMemberShown ? 'Collapse the selected cards' : 'Show every field and method'}
          >
            {anyMemberShown ? <EyeOff size={14} /> : <Eye size={14} />}
            {anyMemberShown ? 'Hide members' : 'Show members'}
          </button>
          <button
            className="jd-btn w-full justify-center"
            onClick={onRemove}
            disabled={removable === 0}
            title={
              removable === selectedIds.length
                ? 'Remove the selected cards'
                : `${selectedIds.length - removable} of them still hold two or more relations`
            }
          >
            <Trash2 size={14} />
            {removable === 0 ? 'Locked by relations' : `Remove ${removable} of ${selectedIds.length}`}
          </button>
          {removable > 0 && removable < selectedIds.length && (
            <p className="text-[11.5px] leading-snug text-[var(--jd-muted)]">
              Cards that still hold two or more relations stay; remove their neighbors first.
            </p>
          )}
        </section>

        <section>
          <h3 className="jd-label mb-1.5">Selected</h3>
          <div className="-mx-1">
            {selectedIds.map((id) => {
              const type = index.types.get(id)
              return (
                <button
                  key={id}
                  className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left text-[12px] hover:bg-[var(--jd-surface-2)]"
                  onClick={() => onSelect(id)}
                  title={id}
                >
                  {type && <KindBadge kind={type.kind} size={16} />}
                  <span className="min-w-0 flex-1 truncate">{type?.name ?? id}</span>
                  {!canRemove(state, id) && <span className="text-[10px] text-[var(--jd-faint)]">locked</span>}
                </button>
              )
            })}
          </div>
        </section>
      </div>
    </aside>
  )
}
