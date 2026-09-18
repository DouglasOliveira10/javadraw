import { RotateCcw } from 'lucide-react'
import type { PaletteControls } from '../data/palette'
import { DEFAULT_KIND_COLORS, DEFAULT_STEREOTYPE_COLORS } from '../theme'
import type { TypeKind } from '../data/types'

const KINDS = Object.keys(DEFAULT_KIND_COLORS) as TypeKind[]
const STEREOTYPES = Object.keys(DEFAULT_STEREOTYPE_COLORS)

/** Colour pickers for the two palettes; lives inside the menu's "Colors" submenu. */
export function ColorMenu({ palette, setKindColor, setStereotypeColor, reset }: PaletteControls) {
  return (
    <div className="jd-scroll max-h-[70vh] w-[230px] overflow-y-auto p-1">
      <p className="px-2 pb-1 pt-0.5 text-[10.5px] leading-snug text-[var(--jd-muted)]">
        A stereotype wins over the kind, so a <code>@Service</code> class takes the service colour.
      </p>

      <Group title="Stereotypes">
        {STEREOTYPES.map((stereotype) => (
          <ColorRow
            key={stereotype}
            label={stereotype}
            value={palette.stereotypes[stereotype] ?? DEFAULT_STEREOTYPE_COLORS[stereotype]}
            onChange={(color) => setStereotypeColor(stereotype, color)}
          />
        ))}
      </Group>

      <Group title="Kinds">
        {KINDS.map((kind) => (
          <ColorRow
            key={kind}
            label={kind.toLowerCase()}
            value={palette.kinds[kind] ?? DEFAULT_KIND_COLORS[kind]}
            onChange={(color) => setKindColor(kind, color)}
          />
        ))}
      </Group>

      <button className="jd-menu-item mt-1" onClick={reset}>
        <span className="jd-menu-icon">
          <RotateCcw size={13} />
        </span>
        <span className="flex-1 text-left">Reset to defaults</span>
      </button>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <div className="jd-label px-2 py-1">{title}</div>
      {children}
    </div>
  )
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (color: string) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-[3px] text-[12px] hover:bg-[var(--jd-surface-2)]">
      <input
        type="color"
        className="jd-color-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={`Colour for ${label}`}
      />
      <span className="flex-1 capitalize">{label}</span>
      <span className="font-mono text-[10px] uppercase text-[var(--jd-faint)]">{value}</span>
    </label>
  )
}
