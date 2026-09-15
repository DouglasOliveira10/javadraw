import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Boxes, Moon, PanelLeft, PanelLeftClose, Sun, Workflow } from 'lucide-react'
import type { GraphIndex } from './data/graphIndex'
import type { RelationKind } from './data/types'
import { pluralize, qualifiedMethodLabel } from './data/format'
import { DiagramCanvas } from './components/DiagramCanvas'
import { DiagramContext, type DiagramActions } from './components/DiagramContext'
import { DetailsPanel } from './components/DetailsPanel'
import { buildStructureDiagram, defaultPackages, type StructureOptions } from './structure/buildStructureDiagram'
import { StructureSidebar } from './structure/StructureSidebar'
import { buildCallFlow, type CallFlowOptions } from './flow/buildCallFlow'
import { FlowSidebar } from './flow/FlowSidebar'

type View = 'structure' | 'flow'

export function App({ index }: { index: GraphIndex }) {
  const [view, setView] = useState<View>('structure')
  const [dark, setDark] = useDarkMode()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [structure, setStructure] = useState<StructureOptions>(() => ({
    packages: defaultPackages(index),
    focus: null,
    relationKinds: new Set<RelationKind>(['EXTENDS', 'IMPLEMENTS', 'ASSOCIATION']),
    detail: 'all',
    showExternal: false,
    hideAccessors: true,
    groupByPackage: false,
    maxMembers: 14,
    expanded: new Set(),
  }))

  const [flowRoot, setFlowRoot] = useState<string | null>(() => defaultRoot(index))
  const [flow, setFlow] = useState<CallFlowOptions>({
    depth: 4,
    expanded: new Set(),
    hideAccessors: true,
    hideConstructors: false,
    showExternal: false,
    maxNodes: 300,
  })

  const patchStructure = useCallback((patch: Partial<StructureOptions>) => setStructure((s) => ({ ...s, ...patch })), [])
  const patchFlow = useCallback((patch: Partial<CallFlowOptions>) => setFlow((s) => ({ ...s, ...patch })), [])

  const structureDiagram = useMemo(() => buildStructureDiagram(index, structure), [index, structure])
  const callFlow = useMemo(() => (flowRoot ? buildCallFlow(index, flowRoot, flow) : null), [index, flowRoot, flow])

  const openFlow = useCallback((methodId: string) => {
    setFlowRoot(methodId)
    setFlow((f) => ({ ...f, expanded: new Set() }))
    setView('flow')
    setSelectedId(methodId)
  }, [])

  const focusType = useCallback((typeId: string) => {
    setStructure((s) => ({ ...s, focus: typeId }))
    setView('structure')
    setSelectedId(typeId)
  }, [])

  const actions = useMemo<DiagramActions>(
    () => ({
      selectedId,
      focusType,
      openFlow,
      expandType: (id) => setStructure((s) => ({ ...s, expanded: new Set(s.expanded).add(id) })),
      expandMethod: (id) => setFlow((f) => ({ ...f, expanded: new Set(f.expanded).add(id) })),
    }),
    [selectedId, focusType, openFlow],
  )

  const projectTypes = useMemo(() => index.graph.types.filter((t) => !t.external).length, [index])
  const rootMethod = flowRoot ? index.methods.get(flowRoot) : undefined
  const diagram = view === 'structure' ? structureDiagram : callFlow?.diagram
  const visibleTypes = structureDiagram.nodes.filter((n) => n.type === 'type').length

  return (
    <DiagramContext.Provider value={actions}>
      <div className="flex h-full flex-col">
        <header className="jd-panel flex h-12 shrink-0 items-center gap-3 border-b px-3">
          <button className="jd-btn border-transparent px-2" onClick={() => setSidebarOpen(!sidebarOpen)} title="Toggle sidebar">
            {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
          </button>
          <div className="flex items-center gap-2">
            <Logo />
            <span className="text-[14px] font-semibold tracking-tight">JavaDraw</span>
            <span className="text-[var(--jd-faint)]">/</span>
            <span className="font-medium">{index.graph.meta.name}</span>
            <span className="hidden text-[11.5px] text-[var(--jd-faint)] md:inline">
              {pluralize(projectTypes, 'type')} · {pluralize(index.graph.calls?.length ?? 0, 'call')}
            </span>
          </div>

          <nav className="mx-auto flex rounded-lg border border-[var(--jd-border)] bg-[var(--jd-surface-2)] p-0.5">
            <ViewTab active={view === 'structure'} onClick={() => setView('structure')} icon={<Boxes size={14} />} label="Structure" />
            <ViewTab active={view === 'flow'} onClick={() => setView('flow')} icon={<Workflow size={14} />} label="Call flow" />
          </nav>

          <div className="flex items-center gap-2">
            <span className="hidden text-[11.5px] text-[var(--jd-faint)] lg:inline">
              {view === 'structure'
                ? `${pluralize(visibleTypes, 'type')} shown`
                : callFlow
                  ? `${pluralize(callFlow.methodCount, 'method')}${callFlow.truncated ? ' (truncated)' : ''}`
                  : ''}
            </span>
            <button className="jd-btn px-2" onClick={() => setDark(!dark)} title="Toggle theme">
              {dark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          {sidebarOpen && (
            <aside className="jd-panel jd-scroll w-[300px] shrink-0 overflow-y-auto border-r">
              {view === 'structure' ? (
                <StructureSidebar index={index} options={structure} onChange={patchStructure} onSelect={setSelectedId} />
              ) : (
                <FlowSidebar index={index} root={flowRoot} options={flow} onRoot={openFlow} onChange={patchFlow} />
              )}
            </aside>
          )}

          <main className="relative min-w-0 flex-1">
            {view === 'flow' && rootMethod && (
              <div className="pointer-events-none absolute left-3 top-3 z-10 max-w-[60%]">
                <div className="jd-panel pointer-events-auto truncate rounded-lg border px-3 py-1.5 font-mono text-[12px] shadow-sm">
                  <span className="text-[var(--jd-faint)]">flow from </span>
                  {qualifiedMethodLabel(index.ownerOf.get(rootMethod.id), rootMethod)}
                </div>
              </div>
            )}
            {diagram && diagram.nodes.length > 0 ? (
              <DiagramCanvas
                diagram={diagram}
                dark={dark}
                fileName={`${index.graph.meta.name}-${view}`}
                onSelect={setSelectedId}
              />
            ) : (
              <EmptyState view={view} />
            )}
          </main>

          {selectedId && (
            <DetailsPanel index={index} selectedId={selectedId} onClose={() => setSelectedId(null)} onFocusType={focusType} onOpenFlow={openFlow} />
          )}
        </div>
      </div>
    </DiagramContext.Provider>
  )
}

function ViewTab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md px-3 py-1 text-[12.5px] font-medium transition"
      style={active ? { background: 'var(--jd-surface)', color: 'var(--jd-text)', boxShadow: 'var(--jd-shadow)' } : { color: 'var(--jd-muted)' }}
    >
      {icon}
      {label}
    </button>
  )
}

function EmptyState({ view }: { view: View }) {
  return (
    <div className="grid h-full place-items-center p-8 text-center">
      <div className="max-w-sm">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-[var(--jd-surface-2)] text-[var(--jd-muted)]">
          {view === 'structure' ? <Boxes size={22} /> : <Workflow size={22} />}
        </div>
        <h2 className="text-[15px] font-semibold">{view === 'structure' ? 'Nothing to draw' : 'Pick a starting point'}</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--jd-muted)]">
          {view === 'structure'
            ? 'Select one or more packages in the sidebar, or search for a class.'
            : 'Choose an entry point or search for any method to follow its calls.'}
        </p>
      </div>
    </div>
  )
}

function Logo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <defs>
        <linearGradient id="jd-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="22" height="22" rx="6" fill="url(#jd-logo)" />
      <rect x="5" y="5.5" width="6" height="4.5" rx="1.2" fill="white" />
      <rect x="13" y="14" width="6" height="4.5" rx="1.2" fill="white" fillOpacity="0.85" />
      <path d="M8 10 V16.25 H13" stroke="white" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  )
}

/** Prefers HTTP endpoints, then any other entry point. */
function defaultRoot(index: GraphIndex): string | null {
  const http = index.entryPoints.find((m) => m.endpoint && /^[A-Z]+ \//.test(m.endpoint))
  return (http ?? index.entryPoints[0])?.id ?? null
}

function useDarkMode(): [boolean, (dark: boolean) => void] {
  const [dark, setDark] = useState(() => {
    try {
      const stored = localStorage.getItem('javadraw.theme')
      if (stored) return stored === 'dark'
    } catch {
      // storage unavailable (e.g. file:// in some browsers)
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  })
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try {
      localStorage.setItem('javadraw.theme', dark ? 'dark' : 'light')
    } catch {
      // ignore
    }
  }, [dark])
  return [dark, setDark]
}
