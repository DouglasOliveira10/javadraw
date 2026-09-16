import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

const CloseContext = createContext<() => void>(() => {})

/** Dropdown anchored to its trigger; closes on Escape, on a click outside and after an item runs. */
export function Menu({ trigger, children, title }: { trigger: ReactNode; children: ReactNode; title?: string }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

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
      <button className="jd-btn border-transparent px-2" onClick={() => setOpen(!open)} title={title} aria-expanded={open}>
        {trigger}
      </button>
      {open && (
        <div className="jd-menu" role="menu">
          <CloseContext.Provider value={() => setOpen(false)}>{children}</CloseContext.Provider>
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
  const [open, setOpen] = useState(false)
  return (
    <div className="relative" onMouseEnter={() => !disabled && setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button className="jd-menu-item" role="menuitem" disabled={disabled} onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="jd-menu-icon">{icon}</span>
        <span className="flex-1 text-left">{label}</span>
        <ChevronRight size={13} className="text-[var(--jd-faint)]" />
      </button>
      {open && <div className="jd-menu jd-submenu">{children}</div>}
    </div>
  )
}
