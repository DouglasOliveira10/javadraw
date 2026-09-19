import { describe, expect, it } from 'vitest'
import type { CallEdge, Relation } from '../data/types'
import { callEdgeId, canvasReducer, emptyCanvas, manualEdgeId, relationEdgeId, type CanvasState } from './canvasState'

const BOLETO = 'app.BoletoDTO'
const PESSOA = 'app.BoletoDTO$Pessoa'
const ENDERECO = 'app.BoletoDTO$Pessoa$Endereco'

const association = (source: string, target: string, label: string): Relation => ({
  source,
  target,
  kind: 'ASSOCIATION',
  label,
})

const call: CallEdge = {
  source: `${BOLETO}#total()Ljava/math/BigDecimal;`,
  target: `${PESSOA}#nome()Ljava/lang/String;`,
  kind: 'VIRTUAL',
  line: 42,
  polymorphic: false,
}

const reduce = (state: CanvasState, ...actions: Parameters<typeof canvasReducer>[1][]) =>
  actions.reduce(canvasReducer, state)

const start = () => canvasReducer(emptyCanvas('test'), { type: 'addType', typeId: BOLETO })

describe('canvasReducer', () => {
  it('starts from a single class', () => {
    const state = start()
    expect(state.nodes.map((n) => n.id)).toEqual([BOLETO])
    expect(state.edges).toEqual([])
  })

  it('adds the related class and the edge together', () => {
    const state = canvasReducer(start(), { type: 'addRelation', relation: association(BOLETO, PESSOA, 'pessoa') })
    expect(state.nodes.map((n) => n.id)).toEqual([BOLETO, PESSOA])
    expect(state.edges).toHaveLength(1)
    expect(state.edges[0]).toMatchObject({ kind: 'ASSOCIATION', source: BOLETO, target: PESSOA, label: 'pessoa' })
  })

  it('reveals the field that justifies an association', () => {
    const state = canvasReducer(start(), { type: 'addRelation', relation: association(BOLETO, PESSOA, 'pessoa') })
    expect(state.nodes.find((n) => n.id === BOLETO)?.visibleFields).toEqual(['pessoa'])
    expect(state.nodes.find((n) => n.id === PESSOA)?.visibleFields).toEqual([])
  })

  it('reveals both methods of a call and anchors the edge on them', () => {
    const state = canvasReducer(start(), { type: 'addCall', call })
    expect(state.nodes.find((n) => n.id === BOLETO)?.visibleMethods).toEqual([call.source])
    expect(state.nodes.find((n) => n.id === PESSOA)?.visibleMethods).toEqual([call.target])
    expect(state.edges[0]).toMatchObject({ kind: 'CALL', sourceMember: call.source, targetMember: call.target, line: 42 })
  })

  it('ignores an edge or a class that is already there', () => {
    const relation = association(BOLETO, PESSOA, 'pessoa')
    const twice = reduce(start(), { type: 'addRelation', relation }, { type: 'addRelation', relation }, { type: 'addType', typeId: PESSOA })
    expect(twice.nodes).toHaveLength(2)
    expect(twice.edges).toHaveLength(1)
  })

  it('removes a card together with every edge attached to it', () => {
    const chain = reduce(
      start(),
      { type: 'addRelation', relation: association(BOLETO, PESSOA, 'pessoa') },
      { type: 'addRelation', relation: association(PESSOA, ENDERECO, 'endereco') },
    )
    const removed = canvasReducer(chain, { type: 'removeNode', typeId: PESSOA })
    expect(removed.nodes.map((n) => n.id)).toEqual([BOLETO, ENDERECO])
    expect(removed.edges).toEqual([])
  })

  it('toggles members without ever dropping an edge', () => {
    const withCall = canvasReducer(start(), { type: 'addCall', call })
    const hidden = canvasReducer(withCall, { type: 'toggleMethod', typeId: PESSOA, methodId: call.target })
    expect(hidden.nodes.find((n) => n.id === PESSOA)?.visibleMethods).toEqual([])
    expect(hidden.edges).toEqual(withCall.edges)

    const shown = canvasReducer(hidden, { type: 'toggleField', typeId: PESSOA, field: 'nome', visible: true })
    expect(shown.nodes.find((n) => n.id === PESSOA)?.visibleFields).toEqual(['nome'])
    expect(canvasReducer(shown, { type: 'toggleField', typeId: PESSOA, field: 'nome', visible: true })).toBe(shown)
  })

  it('keeps positions from moves and arrange', () => {
    const moved = canvasReducer(start(), { type: 'moveNode', typeId: BOLETO, position: { x: 10, y: 20 } })
    expect(moved.nodes[0].position).toEqual({ x: 10, y: 20 })
    const arranged = canvasReducer(moved, { type: 'setPositions', positions: { [BOLETO]: { x: 0, y: 0 } } })
    expect(arranged.nodes[0].position).toEqual({ x: 0, y: 0 })
  })

  it('removes several cards at once', () => {
    const chain = reduce(
      start(),
      { type: 'addRelation', relation: association(BOLETO, PESSOA, 'pessoa') },
      { type: 'addRelation', relation: association(PESSOA, ENDERECO, 'endereco') },
    )
    const state = canvasReducer(chain, { type: 'removeNodes', typeIds: [PESSOA, ENDERECO] })
    expect(state.nodes.map((n) => n.id)).toEqual([BOLETO])
    expect(state.edges).toEqual([])
    expect(canvasReducer(state, { type: 'removeNodes', typeIds: ['nobody'] })).toBe(state)
  })

  it('replaces the members of several cards and keeps the relations', () => {
    const withCall = canvasReducer(start(), { type: 'addCall', call })
    const hidden = canvasReducer(withCall, {
      type: 'setMembers',
      members: { [BOLETO]: { fields: [], methods: [] }, [PESSOA]: { fields: [], methods: [] } },
    })
    expect(hidden.nodes.every((n) => n.visibleMethods.length === 0 && n.visibleFields.length === 0)).toBe(true)
    expect(hidden.edges).toEqual(withCall.edges)

    const shown = canvasReducer(hidden, {
      type: 'setMembers',
      members: { [PESSOA]: { fields: ['nome'], methods: [call.target] } },
    })
    expect(shown.nodes.find((n) => n.id === PESSOA)).toMatchObject({ visibleFields: ['nome'], visibleMethods: [call.target] })
  })

  it('remembers a resized card until it is set back to automatic', () => {
    const sized = canvasReducer(start(), { type: 'resizeNode', typeId: BOLETO, size: { width: 400, height: 200 } })
    expect(sized.nodes[0].size).toEqual({ width: 400, height: 200 })
    expect(canvasReducer(sized, { type: 'resizeNode', typeId: BOLETO, size: { width: 400, height: 200 } })).toBe(sized)

    const auto = canvasReducer(sized, { type: 'autoSizeNode', typeId: BOLETO })
    expect(auto.nodes[0].size).toBeUndefined()
    expect(canvasReducer(auto, { type: 'autoSizeNode', typeId: BOLETO })).toBe(auto)
  })

  it('clears back to an empty canvas for the same project', () => {
    const cleared = canvasReducer(start(), { type: 'clear' })
    expect(cleared).toEqual(emptyCanvas('test'))
  })
})

describe('hand-drawn edges', () => {
  const twoCards = () => reduce(start(), { type: 'addType', typeId: ENDERECO })

  it('connects any two cards, even without a relation behind it', () => {
    const state = canvasReducer(twoCards(), {
      type: 'connect',
      source: BOLETO,
      target: ENDERECO,
      sourceAnchor: { side: 'r', offset: 0.5 },
      targetAnchor: { side: 'l', offset: 0.5 },
    })
    expect(state.edges).toHaveLength(1)
    expect(state.edges[0]).toMatchObject({
      kind: 'MANUAL',
      origin: 'manual',
      source: BOLETO,
      target: ENDERECO,
      anchors: { source: { side: 'r', offset: 0.5 }, target: { side: 'l', offset: 0.5 } },
    })
  })

  it('numbers each line, so two of them between the same cards stay apart', () => {
    const once = canvasReducer(twoCards(), { type: 'connect', source: BOLETO, target: ENDERECO })
    const twice = canvasReducer(once, { type: 'connect', source: BOLETO, target: ENDERECO })
    expect(twice.edges.map((e) => e.id)).toEqual(['M:0', 'M:1'])
    expect(manualEdgeId(twice)).toBe('M:2')
  })

  it('refuses a loop and a card that is not on the canvas', () => {
    const state = twoCards()
    expect(canvasReducer(state, { type: 'connect', source: BOLETO, target: BOLETO })).toBe(state)
    expect(canvasReducer(state, { type: 'connect', source: BOLETO, target: PESSOA })).toBe(state)
  })

  it('removes an edge without touching the cards', () => {
    const state = canvasReducer(twoCards(), { type: 'connect', source: BOLETO, target: ENDERECO })
    const removed = canvasReducer(state, { type: 'removeEdges', edgeIds: ['M:0'] })
    expect(removed.edges).toEqual([])
    expect(removed.nodes).toEqual(state.nodes)
    expect(canvasReducer(removed, { type: 'removeEdges', edgeIds: ['M:0'] })).toBe(removed)
  })

  it('merges the style and forgets the properties set back to default', () => {
    const state = canvasReducer(twoCards(), { type: 'connect', source: BOLETO, target: ENDERECO })
    const styled = reduce(
      state,
      { type: 'styleEdge', edgeId: 'M:0', style: { line: 'dashed', color: '#ff0000' } },
      { type: 'styleEdge', edgeId: 'M:0', style: { text: 'publica em' } },
    )
    expect(styled.edges[0].style).toEqual({ line: 'dashed', color: '#ff0000', text: 'publica em' })

    const reset = reduce(
      styled,
      { type: 'styleEdge', edgeId: 'M:0', style: { color: undefined, text: '' } },
      { type: 'styleEdge', edgeId: 'M:0', style: { line: undefined } },
    )
    expect(reset.edges[0].style).toBeUndefined()
  })

  it('moves an end to another card and drops the route it had', () => {
    const state = reduce(
      canvasReducer(twoCards(), { type: 'addRelation', relation: association(BOLETO, PESSOA, 'pessoa') }),
      { type: 'setWaypoints', edgeId: relationEdgeId(association(BOLETO, PESSOA, 'pessoa')), points: [{ x: 5, y: 5 }] },
    )
    const edgeId = state.edges[0].id
    expect(state.edges[0].waypoints).toEqual([{ x: 5, y: 5 }])

    const moved = canvasReducer(state, { type: 'anchorEdge', edgeId, end: 'target', typeId: ENDERECO, anchor: { side: 't', offset: 0.3 } })
    expect(moved.edges[0]).toMatchObject({ source: BOLETO, target: ENDERECO, anchors: { target: { side: 't', offset: 0.3 } } })
    expect(moved.edges[0].waypoints).toBeUndefined()

    expect(canvasReducer(moved, { type: 'anchorEdge', edgeId, end: 'target', typeId: BOLETO })).toBe(moved)
    expect(canvasReducer(moved, { type: 'anchorEdge', edgeId, end: 'target', typeId: 'app.Nowhere' })).toBe(moved)
  })

  it('slides an end along the same card without losing the bends', () => {
    const state = reduce(
      canvasReducer(twoCards(), { type: 'connect', source: BOLETO, target: ENDERECO }),
      { type: 'setWaypoints', edgeId: 'M:0', points: [{ x: 5, y: 5 }] },
      { type: 'anchorEdge', edgeId: 'M:0', end: 'source', anchor: { side: 'b', offset: 0.8 } },
    )
    expect(state.edges[0]).toMatchObject({
      source: BOLETO,
      anchors: { source: { side: 'b', offset: 0.8 } },
      waypoints: [{ x: 5, y: 5 }],
    })
  })

  it('detaches the end from the member it was anchored on', () => {
    const state = reduce(
      canvasReducer(start(), { type: 'addCall', call }),
      { type: 'anchorEdge', edgeId: callEdgeId(call), end: 'source', anchor: { side: 'r', offset: 0.5 } },
    )
    expect(state.edges[0].sourceMember).toBeUndefined()
    expect(state.edges[0].targetMember).toBe(call.target)
  })

  it('gives the automatic route back', () => {
    const state = reduce(
      canvasReducer(twoCards(), { type: 'connect', source: BOLETO, target: ENDERECO, sourceAnchor: { side: 'r', offset: 0.5 } }),
      { type: 'setWaypoints', edgeId: 'M:0', points: [{ x: 5, y: 5 }] },
    )
    const reset = canvasReducer(state, { type: 'resetRoute', edgeId: 'M:0' })
    expect(reset.edges[0].anchors).toBeUndefined()
    expect(reset.edges[0].waypoints).toBeUndefined()
    expect(canvasReducer(reset, { type: 'resetRoute', edgeId: 'M:0' })).toBe(reset)
  })

  it('keeps the bend points until they are cleared', () => {
    const state = canvasReducer(twoCards(), { type: 'connect', source: BOLETO, target: ENDERECO })
    const bent = canvasReducer(state, { type: 'setWaypoints', edgeId: 'M:0', points: [{ x: 1, y: 2 }] })
    expect(bent.edges[0].waypoints).toEqual([{ x: 1, y: 2 }])
    expect(canvasReducer(bent, { type: 'setWaypoints', edgeId: 'M:0', points: [] }).edges[0].waypoints).toBeUndefined()
  })
})
