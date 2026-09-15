import { useEffect, useRef, type ReactNode } from 'react'
import { Search, X } from 'lucide-react'

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--jd-faint)]" />
      <input className="jd-input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} spellCheck={false} />
      {value && (
        <button className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--jd-faint)] hover:text-[var(--jd-text)]" onClick={() => onChange('')}>
          <X size={14} />
        </button>
      )}
    </div>
  )
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="border-b border-[var(--jd-border)] px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="jd-label">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

export function Toggle({ label, checked, onChange, hint }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; hint?: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 py-1 text-[12.5px]">
      <span
        role="switch"
        aria-checked={checked}
        className="relative inline-block h-[18px] w-[30px] shrink-0 rounded-full transition"
        style={{ background: checked ? 'var(--jd-accent)' : 'var(--jd-border-strong)' }}
      >
        <span
          className="absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow transition-all"
          style={{ left: checked ? 14 : 2 }}
        />
      </span>
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="flex-1">{label}</span>
      {hint}
    </label>
  )
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-lg border border-[var(--jd-border)] bg-[var(--jd-surface-2)] p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          className="flex-1 rounded-md px-2 py-1 text-[12px] font-medium transition"
          style={
            o.value === value
              ? { background: 'var(--jd-surface)', color: 'var(--jd-text)', boxShadow: 'var(--jd-shadow)' }
              : { color: 'var(--jd-muted)' }
          }
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Checkbox({ checked, indeterminate, onChange }: { checked: boolean; indeterminate?: boolean; onChange: (v: boolean) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate
  }, [indeterminate])
  return (
    <input
      ref={ref}
      type="checkbox"
      className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-[var(--jd-accent)]"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      onClick={(e) => e.stopPropagation()}
    />
  )
}
