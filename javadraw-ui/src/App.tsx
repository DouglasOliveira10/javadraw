import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ReactFlowProvider, useReactFlow } from '@xyflow/react'
import {
  Check,
  CornerDownLeft,
  Download,
  ImageDown,
  LayoutGrid,
  Map,
  Languages,
  Menu as MenuIcon,
  Moon,
  Palette,
  Parentheses,
  Plus,
  Redo2,
  Save,
  Sun,
  Trash2,
  Type,
  Undo2,
  Upload,
  X,
} from 'lucide-react'
import type { GraphIndex } from './data/graphIndex'
import type { PaletteControls } from './data/palette'
import type { Relation } from './data/types'
import { useI18n, type I18n } from './i18n/I18nProvider'
import { LOCALES } from './i18n/messages'
import { arrangePositions } from './layout/arrange'
import { Canvas, useExportPng, type Selection } from './diagram/Canvas'
import { Menu, MenuItem, MenuSeparator, MenuSubmenu, MenuToggle } from './components/Menu'
import { prefersDark, useStoredFlag } from './data/preferences'
import { PaletteProvider, usePaletteState } from './data/palette'
import { ColorMenu } from './components/ColorMenu'
import { ClassPicker } from './diagram/ClassPicker'
import { EdgeInspector } from './diagram/EdgeInspector'
import { Inspector } from './diagram/Inspector'
import { SelectionPanel } from './diagram/SelectionPanel'
import { toReactFlowEdges, toReactFlowNodes } from './diagram/toReactFlow'
import type { XY } from './diagram/canvasState'
import { alignPositions, distributePositions, keepTopLeft, type Alignment, type Axis } from './diagram/align'
import { useCanvas } from './diagram/useCanvas'
import type { PruneResult } from './diagram/prune'
import { directionFor, placeNode, type Box } from './diagram/placement'

export function App({ index }: { index: GraphIndex }) {
  const palette = usePaletteState()
  return (
    <PaletteProvider palette={palette.palette}>
      <ReactFlowProvider>
        <Workspace index={index} palette={palette} />
      </ReactFlowProvider>
    </PaletteProvider>
  )
}

function Workspace({ index, palette }: { index: GraphIndex; palette: PaletteControls }) {
  const { t, tc } = useI18n()
  const project = index.graph.meta.name
  const { state, dispatch, exportJson, importJson, restored, undo, redo, canUndo, canRedo } = useCanvas(index)
  const [dark, setDark] = useDarkMode()
  const [showMinimap, setShowMinimap] = useStoredFlag('javadraw.minimap', () => true)
  const [showFieldTypes, setShowFieldTypes] = useStoredFlag('javadraw.fieldTypes', () => true)
  const [showParameters, setShowParameters] = useStoredFlag('javadraw.parameters', () => true)
  const [showReturnTypes, setShowReturnTypes] = useStoredFlag('javadraw.returnTypes', () => true)
  const { exportPng, busy: exportingPng } = useExportPng(`${project}-diagram`)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const importInput = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | undefined>(() => describePruning(restored, t))
  const { getNodes, getNode, fitView } = useReactFlow()

  const nodes = useMemo(
    () => toReactFlowNodes(state, index, { showFieldTypes, showParameters, showReturnTypes }),
    [state, index, showFieldTypes, showParameters, showReturnTypes],
  )
  const edges = useMemo(() => toReactFlowEdges(state), [state])
  const onCanvas = useMemo(() => new Set(state.nodes.map((n) => n.id)), [state])
  const empty = state.nodes.length === 0

  const selectedId = selectedIds.length === 1 ? selectedIds[0] : null
  const selectedEdgeId = selectedIds.length === 0 && selectedEdgeIds.length === 1 ? selectedEdgeIds[0] : null

  /** React Flow reports the same selection again after we push it back; ignore those. */
  const selectionChanged = useCallback((selection: Selection) => {
    setSelectedIds((current) => (sameIds(current, selection.nodes) ? current : selection.nodes))
    setSelectedEdgeIds((current) => (sameIds(current, selection.edges) ? current : selection.edges))
  }, [])

  const clearSelection = useCallback(() => selectionChanged({ nodes: [], edges: [] }), [selectionChanged])

  useUndoShortcuts(undo, redo)

  // Undo can take away what was selected; dropping those ids keeps the panels honest.
  useEffect(() => {
    const cards = new Set(state.nodes.map((n) => n.id))
    const edges = new Set(state.edges.map((e) => e.id))
    setSelectedIds((current) => (current.every((id) => cards.has(id)) ? current : current.filter((id) => cards.has(id))))
    setSelectedEdgeIds((current) => (current.every((id) => edges.has(id)) ? current : current.filter((id) => edges.has(id))))
  }, [state])

  const boxOf = useCallback(
    (typeId: string): Box | undefined => {
      const node = state.nodes.find((n) => n.id === typeId)
      if (!node?.position) return undefined
      const measured = getNode(typeId)?.measured
      return { ...node.position, width: measured?.width ?? 240, height: measured?.height ?? 90 }
    },
    [state, getNode],
  )

  /** Bounding boxes of the cards already placed, so a new one does not land on top of them. */
  const boxes = useCallback((): Box[] => {
    return state.nodes.map((n) => boxOf(n.id)).filter((b): b is Box => !!b)
  }, [state, boxOf])

  const selectedBoxes = useCallback((): Record<string, Box> => {
    const result: Record<string, Box> = {}
    for (const id of selectedIds) {
      const box = boxOf(id)
      if (box) result[id] = box
    }
    return result
  }, [selectedIds, boxOf])

  const placeNear = useCallback(
    (originId: string, targetId: string, kind: string, outgoing: boolean): XY | undefined => {
      if (state.nodes.some((n) => n.id === targetId)) return undefined
      const measured = getNode(originId)?.measured
      return placeNode(boxOf(originId), measured ?? undefined, boxes(), directionFor(kind, outgoing))
    },
    [state, getNode, boxOf, boxes],
  )

  const addRelation = useCallback(
    (relation: Relation, origin: string) => {
      const other = relation.source === origin ? relation.target : relation.source
      dispatch({ type: 'addRelation', relation, position: placeNear(origin, other, relation.kind, relation.source === origin) })
      setSelectedIds([other])
    },
    [dispatch, placeNear],
  )

  const addType = useCallback(
    (typeId: string) => {
      dispatch({ type: 'addType', typeId, position: placeNode(undefined, undefined, boxes()) })
      setSelectedIds([typeId])
      setPickerOpen(false)
      requestAnimationFrame(() => fitView({ padding: 0.2, duration: 300, maxZoom: 1.1 }))
    },
    [dispatch, boxes, fitView],
  )

  const autoArrange = useCallback(async () => {
    const positions = await arrangePositions(getNodes(), state.edges)
    dispatch({ type: 'setPositions', positions })
    requestAnimationFrame(() => fitView({ padding: 0.1, duration: 400, maxZoom: 1.1 }))
  }, [getNodes, state.edges, dispatch, fitView])

  const remove = useCallback(
    (typeId: string) => {
      dispatch({ type: 'removeNode', typeId })
      setSelectedIds((current) => current.filter((id) => id !== typeId))
    },
    [dispatch],
  )

  const removeNodes = useCallback(
    (typeIds: string[]) => {
      dispatch({ type: 'removeNodes', typeIds })
      setSelectedIds((current) => current.filter((id) => !typeIds.includes(id)))
    },
    [dispatch],
  )

  const removeEdges = useCallback(
    (edgeIds: string[]) => {
      dispatch({ type: 'removeEdges', edgeIds })
      setSelectedEdgeIds((current) => current.filter((id) => !edgeIds.includes(id)))
    },
    [dispatch],
  )

  // ---------------------------------------------------------------- selection actions

  const alignSelection = useCallback(
    (alignment: Alignment) => dispatch({ type: 'setPositions', positions: alignPositions(selectedBoxes(), alignment) }),
    [dispatch, selectedBoxes],
  )

  const distributeSelection = useCallback(
    (axis: Axis) => dispatch({ type: 'setPositions', positions: distributePositions(selectedBoxes(), axis) }),
    [dispatch, selectedBoxes],
  )

  const arrangeSelection = useCallback(async () => {
    const selection = new Set(selectedIds)
    const positions = await arrangePositions(
      getNodes().filter((n) => selection.has(n.id)),
      state.edges.filter((e) => selection.has(e.source) && selection.has(e.target)),
    )
    dispatch({ type: 'setPositions', positions: keepTopLeft(positions, selectedBoxes()) })
  }, [selectedIds, getNodes, state.edges, dispatch, selectedBoxes])

  const membersOfSelection = useCallback(
    (visible: boolean) => {
      const members: Record<string, { fields: string[]; methods: string[] }> = {}
      for (const id of selectedIds) {
        const type = index.types.get(id)
        members[id] = visible
          ? {
              fields: (type?.fields ?? []).map((f) => f.name),
              methods: (type?.methods ?? []).filter((m) => !m.generated && !m.inherited).map((m) => m.id),
            }
          : { fields: [], methods: [] }
      }
      dispatch({ type: 'setMembers', members })
    },
    [selectedIds, index, dispatch],
  )

  /** Section eye in the Inspector: reveals or hides every field or method of one card. */
  const toggleSection = useCallback(
    (typeId: string, section: 'fields' | 'methods', visible: boolean) => {
      const node = state.nodes.find((n) => n.id === typeId)
      const type = index.types.get(typeId)
      if (!node || !type) return
      const fields = section === 'fields' ? (visible ? (type.fields ?? []).map((f) => f.name) : []) : node.visibleFields
      const methods =
        section === 'methods'
          ? visible
            ? (type.methods ?? []).filter((m) => !m.generated).map((m) => m.id)
            : []
          : node.visibleMethods
      dispatch({ type: 'setMembers', members: { [typeId]: { fields, methods } } })
    },
    [state, index, dispatch],
  )

  const removeSelection = useCallback(() => {
    dispatch({ type: 'removeNodes', typeIds: selectedIds })
    setSelectedIds([])
  }, [selectedIds, dispatch])

  return (
    <div className="flex h-full flex-col">
      <header className="jd-panel flex h-12 shrink-0 items-center gap-3 border-b px-3">
        <DiagramMenu
          empty={empty}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
          canArrange={state.nodes.length >= 2}
          pickerOpen={pickerOpen}
          showMinimap={showMinimap}
          palette={palette}
          showFieldTypes={showFieldTypes}
          showParameters={showParameters}
          showReturnTypes={showReturnTypes}
          onToggleFieldTypes={setShowFieldTypes}
          onToggleParameters={setShowParameters}
          onToggleReturnTypes={setShowReturnTypes}
          onAddClass={() => setPickerOpen((open) => !open)}
          onClear={() => dispatch({ type: 'clear' })}
          onSave={() => downloadJson(`${project}-diagram`, exportJson())}
          onImport={() => importInput.current?.click()}
          onExportPng={() => {
            void exportPng().catch((failure: unknown) => setError(failure instanceof Error ? failure.message : String(failure)))
          }}
          exporting={exportingPng}
          onToggleMinimap={setShowMinimap}
          onAutoArrange={autoArrange}
        />
        <Logo />
        <span className="text-[14px] font-semibold tracking-tight">JavaDraw</span>
        <span className="text-[var(--jd-faint)]">/</span>
        <span className="font-medium">{project}</span>
        <span className="hidden text-[11.5px] text-[var(--jd-faint)] md:inline">
          {tc('app.typesAnalyzed', index.graph.types.filter((type) => !type.external).length)}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-[11.5px] text-[var(--jd-faint)] lg:inline">
            {tc('app.cards', state.nodes.length)} · {tc('app.relations', state.edges.length)}
          </span>
          <LanguageMenu />
          <button className="jd-btn px-2" onClick={() => setDark(!dark)} title={t('app.toggleTheme')}>
            {dark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </header>

      <input
        ref={importInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          try {
            setError(describePruning(importJson(await file.text()), t))
          } catch (failure) {
            setError(failure instanceof Error ? failure.message : String(failure))
          }
        }}
      />

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
              onClose={empty ? undefined : () => setPickerOpen(false)}
              title={t(empty ? 'picker.startTitle' : 'picker.addTitle')}
              hint={t(empty ? 'picker.startHint' : 'picker.addHint')}
            />
          </aside>
        )}

        {/* React Flow stays mounted even with an empty diagram: unmounting it inside the provider makes its
            store loop when the canvas is filled again. The empty state is an overlay instead. */}
        <main className="relative min-w-0 flex-1">
          <Canvas
            nodes={nodes}
            edges={edges}
            dark={dark}
            selectedIds={selectedIds}
            selectedEdgeIds={selectedEdgeIds}
            showMinimap={showMinimap && !empty}
            onSelectionChange={selectionChanged}
            onMove={(positions) => dispatch({ type: 'setPositions', positions })}
            onResize={(typeId, size) => dispatch({ type: 'resizeNode', typeId, size })}
            onRemoveNodes={removeNodes}
            onRemoveEdges={removeEdges}
            onConnect={(connection) => dispatch({ type: 'connect', ...connection })}
            onMoveEnd={(edgeId, end, typeId, anchor) => dispatch({ type: 'anchorEdge', edgeId, end, typeId, anchor })}
            onWaypoints={(edgeId, points) => dispatch({ type: 'setWaypoints', edgeId, points })}
          />
          {empty && <EmptyCanvas />}
        </main>

        {selectedIds.length > 1 && (
          <SelectionPanel
            index={index}
            state={state}
            selectedIds={selectedIds}
            onClose={clearSelection}
            onSelect={(id) => setSelectedIds([id])}
            onAlign={alignSelection}
            onDistribute={distributeSelection}
            onArrange={arrangeSelection}
            onMembers={membersOfSelection}
            onRemove={removeSelection}
          />
        )}

        {selectedEdgeId && (
          <EdgeInspector
            index={index}
            state={state}
            edgeId={selectedEdgeId}
            onClose={clearSelection}
            onSelectNode={(id) => selectionChanged({ nodes: [id], edges: [] })}
            onStyle={(edgeId, style) => dispatch({ type: 'styleEdge', edgeId, style })}
            onResetRoute={(edgeId) => dispatch({ type: 'resetRoute', edgeId })}
            onRemove={(id) => removeEdges([id])}
          />
        )}

        {selectedId && onCanvas.has(selectedId) && (
          <Inspector
            index={index}
            state={state}
            typeId={selectedId}
            onClose={clearSelection}
            onSelect={(id) => onCanvas.has(id) && setSelectedIds([id])}
            onAddRelation={addRelation}
            onToggleField={(typeId, field) => dispatch({ type: 'toggleField', typeId, field })}
            onToggleMethod={(typeId, methodId) => dispatch({ type: 'toggleMethod', typeId, methodId })}
            onToggleSection={toggleSection}
            onAutoSize={(typeId) => dispatch({ type: 'autoSizeNode', typeId })}
            showFieldTypes={showFieldTypes}
            showParameters={showParameters}
            showReturnTypes={showReturnTypes}
            onRemove={remove}
          />
        )}
      </div>
    </div>
  )
}

/** Order does not matter: React Flow reports the selection in its own order, and a reorder is not a change. */
/** Tells the user what a stale diagram lost, so cards vanishing is never a mystery. */
function describePruning(pruned: PruneResult | null | undefined, t: I18n['t']): string | undefined {
  if (!pruned) return undefined
  const parts: string[] = []
  if (pruned.droppedTypes.length > 0) {
    parts.push(
      t('notice.cardsDropped', {
        count: pruned.droppedTypes.length,
        names: pruned.droppedTypes.slice(0, 3).join(', '),
      }),
    )
  }
  if (pruned.droppedEdges > 0) {
    parts.push(t('notice.relationsDropped', { count: pruned.droppedEdges }))
  }
  return parts.length > 0 ? parts.join('. ') : undefined
}

function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const known = new Set(a)
  return b.every((id) => known.has(id))
}

/** Language switcher, next to the theme button: shows the current code and lists the others. */
function LanguageMenu() {
  const { locale, setLocale, t } = useI18n()
  const current = LOCALES.find((option) => option.code === locale) ?? LOCALES[0]
  return (
    <Menu
      title={t('app.language')}
      align="right"
      trigger={
        <span className="flex items-center gap-1">
          <Languages size={15} />
          <span className="text-[10.5px] font-semibold">{current.short}</span>
        </span>
      }
    >
      {LOCALES.map((option) => (
        <MenuItem
          key={option.code}
          icon={option.code === locale ? <Check size={14} /> : null}
          label={option.label}
          hint={option.short}
          onSelect={() => setLocale(option.code)}
        />
      ))}
    </Menu>
  )
}

function EmptyCanvas() {
  const { t } = useI18n()
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center bg-[var(--jd-bg)] p-8 text-center">
      <div className="max-w-sm">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-[var(--jd-surface-2)] text-[var(--jd-muted)]">
          <Plus size={22} />
        </div>
        <h2 className="text-[15px] font-semibold">{t('canvas.emptyTitle')}</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--jd-muted)]">{t('canvas.emptyHint')}</p>
      </div>
    </div>
  )
}

interface MenuProps {
  empty: boolean
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  canArrange: boolean
  pickerOpen: boolean
  showMinimap: boolean
  palette: PaletteControls
  showFieldTypes: boolean
  showParameters: boolean
  showReturnTypes: boolean
  exporting: boolean
  onAddClass: () => void
  onClear: () => void
  onSave: () => void
  onImport: () => void
  onExportPng: () => void
  onToggleMinimap: (value: boolean) => void
  onToggleFieldTypes: (value: boolean) => void
  onToggleParameters: (value: boolean) => void
  onToggleReturnTypes: (value: boolean) => void
  onAutoArrange: () => void
}

function DiagramMenu({
  empty,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  canArrange,
  pickerOpen,
  showMinimap,
  palette,
  showFieldTypes,
  showParameters,
  showReturnTypes,
  exporting,
  onAddClass,
  onClear,
  onSave,
  onImport,
  onExportPng,
  onToggleMinimap,
  onToggleFieldTypes,
  onToggleParameters,
  onToggleReturnTypes,
  onAutoArrange,
}: MenuProps) {
  const { t } = useI18n()
  const [confirmingClear, setConfirmingClear] = useState(false)
  useEffect(() => {
    if (!confirmingClear) return
    const timer = setTimeout(() => setConfirmingClear(false), 4000)
    return () => clearTimeout(timer)
  }, [confirmingClear])

  return (
    <Menu trigger={<MenuIcon size={16} />} title={t('app.diagramMenu')}>
      <MenuItem icon={<Undo2 size={14} />} label={t('menu.undo')} hint={UNDO_KEYS} disabled={!canUndo} onSelect={onUndo} />
      <MenuItem icon={<Redo2 size={14} />} label={t('menu.redo')} hint={REDO_KEYS} disabled={!canRedo} onSelect={onRedo} />
      <MenuSeparator />
      <MenuItem
        icon={<Plus size={14} />}
        label={t(pickerOpen ? 'menu.hideClassPicker' : 'menu.addClass')}
        disabled={empty}
        onSelect={onAddClass}
      />
      <MenuItem
        icon={<Trash2 size={14} />}
        label={t(confirmingClear ? 'menu.clearConfirm' : 'menu.clearDiagram')}
        disabled={empty}
        keepOpen={!confirmingClear}
        onSelect={() => {
          if (confirmingClear) onClear()
          setConfirmingClear(!confirmingClear)
        }}
      />
      <MenuSeparator />
      <MenuItem icon={<Save size={14} />} label={t('menu.save')} hint=".json" disabled={empty} onSelect={onSave} />
      <MenuItem icon={<Upload size={14} />} label={t('menu.import')} onSelect={onImport} />
      <MenuSubmenu icon={<Download size={14} />} label={t('menu.exportAs')} disabled={empty}>
        <MenuItem
          icon={<ImageDown size={14} />}
          label={exporting ? t('menu.exporting') : 'PNG'}
          disabled={exporting}
          onSelect={onExportPng}
        />
      </MenuSubmenu>
      <MenuSeparator />
      <MenuSubmenu icon={<Palette size={14} />} label={t('menu.colors')}>
        <ColorMenu {...palette} />
      </MenuSubmenu>
      <MenuToggle icon={<Type size={14} />} label={t('menu.showFieldTypes')} checked={showFieldTypes} onChange={onToggleFieldTypes} />
      <MenuToggle icon={<Parentheses size={14} />} label={t('menu.showParameters')} checked={showParameters} onChange={onToggleParameters} />
      <MenuToggle icon={<CornerDownLeft size={14} />} label={t('menu.showReturnTypes')} checked={showReturnTypes} onChange={onToggleReturnTypes} />
      <MenuSeparator />
      <MenuToggle icon={<Map size={14} />} label={t('menu.showMinimap')} checked={showMinimap} onChange={onToggleMinimap} />
      <MenuItem icon={<LayoutGrid size={14} />} label={t('menu.autoArrange')} disabled={!canArrange} onSelect={onAutoArrange} />
    </Menu>
  )
}

const APPLE = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const UNDO_KEYS = APPLE ? '\u2318Z' : 'Ctrl+Z'
const REDO_KEYS = APPLE ? '\u21e7\u2318Z' : 'Ctrl+Y'

/** The usual keys, as long as the typing is not going into a field. */
function useUndoShortcuts(onUndo: () => void, onRedo: () => void) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      const key = event.key.toLowerCase()
      if (key !== 'z' && key !== 'y') return
      event.preventDefault()
      if (key === 'y' || event.shiftKey) onRedo()
      else onUndo()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onUndo, onRedo])
}

function downloadJson(fileName: string, json: string) {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const link = document.createElement('a')
  link.download = `${fileName}.json`
  link.href = url
  link.click()
  URL.revokeObjectURL(url)
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
  const [dark, setDark] = useStoredFlag('javadraw.dark', legacyTheme)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])
  return [dark, setDark]
}

/** Falls back to the theme saved by earlier versions before asking the operating system. */
function legacyTheme(): boolean {
  try {
    const stored = localStorage.getItem('javadraw.theme')
    if (stored) return stored === 'dark'
  } catch {
    // storage unavailable
  }
  return prefersDark()
}
