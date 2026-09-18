import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

const CloseContext = createContext<() => void>(() => {})

/** Only one submenu is open at a time, so two panels never overlap. */
interface Submenus {
  active: string | null
  open: (id: string) => void
  close: (id: string) => void
}

const SubmenuContext = createContext<Submenus>({ active: null, open: () => {}, close: () => {} })

/** Dropdown anchored to its trigger; closes on Escape, on a click outside and after an item runs. */
export function Menu({
  trigger,
  children,
  title,
  align = 'left',
}: {
  trigger: ReactNode
  children: ReactNode
  title?: string
  /** Side the popover is anchored to: 'right' keeps a trigger near the window edge from overflowing. */
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null)
  const root = useRef<HTMLDivElement>(null)

  const submenus = useMemo<Submenus>(
    () => ({
      active: activeSubmenu,
      open: (id) => setActiveSubmenu(id),
      close: (id) => setActiveSubmenu((current) => (current === id ? null : current)),
    }),
    [activeSubmenu],
  )

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="relative" ref={root}>
      <button
        className="jd-btn border-transparent px-2"
        onClick={() => {
          setOpen(!open)
          setActiveSubmenu(null)
        }}
        title={title}
        aria-expanded={open}
      >
        {trigger}
      </button>
      {open && (
        <div className={`jd-menu ${align === 'right' ? 'jd-menu-right' : ''}`} role="menu">
          <CloseContext.Provider value={() => setOpen(false)}>
            <SubmenuContext.Provider value={submenus}>{children}</SubmenuContext.Provider>
          </CloseContext.Provider>
        </div>
      )}
    </div>
  )
}

export function MenuItem({
  icon,
  label,
  hint,
  disabled,
  onSelect,
  keepOpen,
}: {
  icon?: ReactNode
  label: ReactNode
  hint?: ReactNode
  disabled?: boolean
  onSelect: () => void
  /** Keeps the menu open, for items that toggle something. */
  keepOpen?: boolean
}) {
  const close = useContext(CloseContext)
  return (
    <button
      className="jd-menu-item"
      role="menuitem"
      disabled={disabled}
      onClick={() => {
        onSelect()
        if (!keepOpen) close()
      }}
    >
      <span className="jd-menu-icon">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {hint && <span className="text-[10.5px] text-[var(--jd-faint)]">{hint}</span>}
    </button>
  )
}

export function MenuSeparator() {
  return <div className="my-1 border-t border-[var(--jd-border)]" role="separator" />
}

/** A switch row: clicking flips it and the menu stays open. */
export function MenuToggle({ icon, label, checked, onChange }: { icon?: ReactNode; label: ReactNode; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button className="jd-menu-item" role="menuitemcheckbox" aria-checked={checked} onClick={() => onChange(!checked)}>
      <span className="jd-menu-icon">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      <span
        className="relative inline-block h-[16px] w-[26px] shrink-0 rounded-full transition"
        style={{ background: checked ? 'var(--jd-accent)' : 'var(--jd-border-strong)' }}
      >
        <span className="absolute top-[2px] h-[12px] w-[12px] rounded-full bg-white shadow transition-all" style={{ left: checked ? 12 : 2 }} />
      </span>
    </button>
  )
}

/** Nested list, opened by hovering or clicking the parent row. */
export function MenuSubmenu({ icon, label, children, disabled }: { icon?: ReactNode; label: ReactNode; children: ReactNode; disabled?: boolean }) {
  const id = useId()
  const submenus = useContext(SubmenuContext)
  const open = submenus.active === id
  const root = useRef<HTMLDivElement>(null)
  const closing = useRef<number>(0)
  const used = useRef(false)

  useEffect(() => () => window.clearTimeout(closing.current), [])

  /**
   * The pointer leaving is only a hint. A control inside may have opened an operating system panel —
   * the colour swatch does — and then the pointer is on its way there, not away from the menu. So wait
   * a moment, and stay open while the focus is inside or the list has already been used: from there on
   * it closes on the parent row, on Escape or on a click outside, never by the pointer wandering off.
   */
  const leave = () => {
    window.clearTimeout(closing.current)
    closing.current = window.setTimeout(() => {
      if (used.current || root.current?.contains(document.activeElement)) return
      submenus.close(id)
    }, 120)
  }

  const enter = () => {
    window.clearTimeout(closing.current)
    if (!disabled) submenus.open(id)
  }

  return (
    <div className="relative" ref={root} onMouseEnter={enter} onMouseLeave={leave}>
      <button
        className="jd-menu-item"
        role="menuitem"
        disabled={disabled}
        onClick={() => {
          used.current = false
          if (open) submenus.close(id)
          else submenus.open(id)
        }}
        aria-expanded={open}
      >
        <span className="jd-menu-icon">{icon}</span>
        <span className="flex-1 text-left">{label}</span>
        <ChevronRight size={13} className="text-[var(--jd-faint)]" />
      </button>
      {open && (
        <div className="jd-menu jd-submenu" onMouseDown={() => (used.current = true)}>
          {children}
        </div>
      )}
    </div>
  )
}
