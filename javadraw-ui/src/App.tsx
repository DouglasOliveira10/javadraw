import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ReactFlowProvider, useReactFlow } from '@xyflow/react'
import { Download, LayoutGrid, Moon, Plus, Sun, Trash2, Upload, X } from 'lucide-react'
import type { GraphIndex } from './data/graphIndex'
import type { CallEdge, Relation } from './data/types'
import { pluralize } from './data/format'
import { arrangePositions } from './layout/arrange'
import { Canvas, ExportPngButton } from './diagram/Canvas'
import { ClassPicker } from './diagram/ClassPicker'
import { Inspector } from './diagram/Inspector'
import { toReactFlowEdges, toReactFlowNodes } from './diagram/toReactFlow'
import { typeOfMethod, type XY } from './diagram/canvasState'
import { useCanvas } from './diagram/useCanvas'
import { directionFor, placeNode, type Box } from './diagram/placement'

export function App({ index }: { index: GraphIndex }) {
  return (
    <ReactFlowProvider>
      <Workspace index={index} />
    </ReactFlowProvider>
  )
}

function Workspace({ index }: { index: GraphIndex }) {
  const project = index.graph.meta.name
  const { state, dispatch, exportJson, importJson } = useCanvas(project)
  const [dark, setDark] = useDarkMode()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [error, setError] = useState<string>()
  const { getNodes, getNode, fitView } = useReactFlow()

  const nodes = useMemo(() => toReactFlowNodes(state, index), [state, index])
  const edges = useMemo(() => toReactFlowEdges(state), [state])
  const onCanvas = useMemo(() => new Set(state.nodes.map((n) => n.id)), [state])
  const empty = state.nodes.length === 0

  /** Bounding boxes of the cards already placed, so a new one does not land on top of them. */
  const boxes = useCallback((): Box[] => {
    return state.nodes
      .filter((n) => n.position)
      .map((n) => {
        const measured = getNode(n.id)?.measured
        return { ...n.position!, width: measured?.width ?? 240, height: measured?.height ?? 90 }
      })
  }, [state, getNode])

  const placeNear = useCallback(
    (originId: string, targetId: string, kind: string, outgoing: boolean): XY | undefined => {
      if (state.nodes.some((n) => n.id === targetId)) return undefined
      const origin = state.nodes.find((n) => n.id === originId)
      const measured = getNode(originId)?.measured
      const originBox = origin?.position
        ? { ...origin.position, width: measured?.width ?? 240, height: measured?.height ?? 90 }
        : undefined
      return placeNode(originBox, measured ?? undefined, boxes(), directionFor(kind, outgoing))
    },
    [state, getNode, boxes],
  )

  const addRelation = useCallback(
    (relation: Relation, origin: string) => {
      const other = relation.source === origin ? relation.target : relation.source
      dispatch({ type: 'addRelation', relation, position: placeNear(origin, other, relation.kind, relation.source === origin) })
      setSelectedId(other)
    },
    [dispatch, placeNear],
  )

  const addCall = useCallback(
    (call: CallEdge, origin: string) => {
      const source = typeOfMethod(call.source)
      const other = source === origin ? typeOfMethod(call.target) : source
      dispatch({ type: 'addCall', call, position: placeNear(origin, other, 'CALL', source === origin) })
      setSelectedId(other)
    },
    [dispatch, placeNear],
  )

  const addType = useCallback(
    (typeId: string) => {
      dispatch({ type: 'addType', typeId, position: placeNode(undefined, undefined, boxes()) })
      setSelectedId(typeId)
      setPickerOpen(false)
      requestAnimationFrame(() => fitView({ padding: 0.2, duration: 300, maxZoom: 1.1 }))
    },
    [dispatch, boxes, fitView],
  )

  const autoArrange = useCallback(async () => {
    const positions = await arrangePositions(getNodes(), state.edges)
    dispatch({ type: 'arrange', positions })
    requestAnimationFrame(() => fitView({ padding: 0.1, duration: 400, maxZoom: 1.1 }))
  }, [getNodes, state.edges, dispatch, fitView])

  const remove = useCallback(
    (typeId: string) => {
      dispatch({ type: 'removeNode', typeId })
      setSelectedId((current) => (current === typeId ? null : current))
    },
    [dispatch],
  )

  return (
    <div className="flex h-full flex-col">
      <header className="jd-panel flex h-12 shrink-0 items-center gap-3 border-b px-3">
        <Logo />
        <span className="text-[14px] font-semibold tracking-tight">JavaDraw</span>
        <span className="text-[var(--jd-faint)]">/</span>
        <span className="font-medium">{project}</span>
        <span className="hidden text-[11.5px] text-[var(--jd-faint)] md:inline">
          {pluralize(index.graph.types.filter((t) => !t.external).length, 'type')} analyzed
        </span>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-[11.5px] text-[var(--jd-faint)] lg:inline">
            {pluralize(state.nodes.length, 'card')} · {pluralize(state.edges.length, 'relation')}
          </span>
          <button
            className="jd-btn"
            onClick={() => setPickerOpen((open) => !open)}
            disabled={empty}
            title="Add a class that has no relation with the diagram"
          >
            {pickerOpen ? <X size={14} /> : <Plus size={14} />} Add class
          </button>
          <button className="jd-btn" onClick={autoArrange} disabled={state.nodes.length < 2} title="Rearrange every card with ELK">
            <LayoutGrid size={14} /> Auto-arrange
          </button>
          <ExportPngButton fileName={`${project}-diagram`} disabled={empty} />
          <ExportJsonButton fileName={`${project}-diagram`} json={exportJson} disabled={empty} />
          <ImportJsonButton onImport={importJson} onError={setError} />
          <ClearButton onClear={() => dispatch({ type: 'clear' })} disabled={empty} />
          <button className="jd-btn px-2" onClick={() => setDark(!dark)} title="Toggle theme">
            {dark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </header>

      {error && (
        <div className="flex items-center gap-2 border-b border-red-300 bg-red-50 px-4 py-1.5 text-[12px] text-red-700">
          {error}
          <button className="ml-auto" onClick={() => setError(undefined)}>
            <X size={14} />
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {(empty || pickerOpen) && (
          <aside className="jd-panel w-[320px] shrink-0 border-r">
            <ClassPicker
              index={index}
              onCanvas={onCanvas}
              onPick={addType}
              title={empty ? 'Start from a class' : 'Add a class'}
              hint={
                empty
                  ? 'Pick the class you want to explore. From there you grow the diagram one relation at a time.'
                  : 'The class is added loose; relate it through the panel on the right.'
              }
            />
          </aside>
        )}

        <main className="relative min-w-0 flex-1">
          {empty ? (
            <EmptyCanvas />
          ) : (
            <Canvas
              nodes={nodes}
              edges={edges}
              dark={dark}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onMove={(typeId, position) => dispatch({ type: 'moveNode', typeId, position })}
            />
          )}
        </main>

        {selectedId && onCanvas.has(selectedId) && (
          <Inspector
            index={index}
            state={state}
            typeId={selectedId}
            onClose={() => setSelectedId(null)}
            onSelect={(id) => onCanvas.has(id) && setSelectedId(id)}
            onAddRelation={addRelation}
            onAddCall={addCall}
            onToggleField={(typeId, field) => dispatch({ type: 'toggleField', typeId, field })}
            onToggleMethod={(typeId, methodId) => dispatch({ type: 'toggleMethod', typeId, methodId })}
            onRemove={remove}
          />
        )}
      </div>
    </div>
  )
}

function EmptyCanvas() {
  return (
    <div className="grid h-full place-items-center p-8 text-center">
      <div className="max-w-sm">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-[var(--jd-surface-2)] text-[var(--jd-muted)]">
          <Plus size={22} />
        </div>
        <h2 className="text-[15px] font-semibold">Empty diagram</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--jd-muted)]">
          Choose a class on the left. Every card you add afterwards comes from a relation that exists in the analyzed
          bytecode.
        </p>
      </div>
    </div>
  )
}

function ExportJsonButton({ fileName, json, disabled }: { fileName: string; json: () => string; disabled: boolean }) {
  const download = () => {
    const url = URL.createObjectURL(new Blob([json()], { type: 'application/json' }))
    const link = document.createElement('a')
    link.download = `${fileName}.json`
    link.href = url
    link.click()
    URL.revokeObjectURL(url)
  }
  return (
    <button className="jd-btn px-2" onClick={download} disabled={disabled} title="Export the diagram as JSON">
      <Download size={14} />
    </button>
  )
}

function ImportJsonButton({ onImport, onError }: { onImport: (text: string) => void; onError: (message: string) => void }) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          try {
            onImport(await file.text())
          } catch (failure) {
            onError(failure instanceof Error ? failure.message : String(failure))
          }
        }}
      />
      <button className="jd-btn px-2" onClick={() => input.current?.click()} title="Import a diagram JSON">
        <Upload size={14} />
      </button>
    </>
  )
}

/** Two-step so a full diagram is never lost by a stray click. */
function ClearButton({ onClear, disabled }: { onClear: () => void; disabled: boolean }) {
  const [confirming, setConfirming] = useState(false)
  useEffect(() => {
    if (!confirming) return
    const timer = setTimeout(() => setConfirming(false), 4000)
    return () => clearTimeout(timer)
  }, [confirming])

  return (
    <button
      className="jd-btn px-2"
      style={confirming ? { color: '#ef4444', borderColor: '#ef4444' } : undefined}
      disabled={disabled}
      onClick={() => {
        if (confirming) {
          onClear()
          setConfirming(false)
        } else {
          setConfirming(true)
        }
      }}
      title={confirming ? 'Click again to clear the diagram' : 'Clear the diagram'}
    >
      <Trash2 size={14} />
      {confirming && <span className="text-[11.5px]">Sure?</span>}
    </button>
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
