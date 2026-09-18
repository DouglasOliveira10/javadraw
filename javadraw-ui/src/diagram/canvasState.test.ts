import { describe, expect, it } from 'vitest'
import type { CallEdge, Relation } from '../data/types'
import { canRemove, canvasReducer, emptyCanvas, removeCascading, type CanvasState } from './canvasState'

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

  it('removes a leaf together with its single edge', () => {
    const state = canvasReducer(start(), { type: 'addRelation', relation: association(BOLETO, PESSOA, 'pessoa') })
    expect(canRemove(state, PESSOA)).toBe(true)
    const removed = canvasReducer(state, { type: 'removeNode', typeId: PESSOA })
    expect(removed.nodes.map((n) => n.id)).toEqual([BOLETO])
    expect(removed.edges).toEqual([])
  })

  it('refuses to remove a class holding two relations', () => {
    const state = reduce(
      start(),
      { type: 'addRelation', relation: association(BOLETO, PESSOA, 'pessoa') },
      { type: 'addRelation', relation: association(PESSOA, ENDERECO, 'endereco') },
    )
    expect(canRemove(state, PESSOA)).toBe(false)
    expect(canvasReducer(state, { type: 'removeNode', typeId: PESSOA })).toBe(state)
    expect(canRemove(state, ENDERECO)).toBe(true)
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

  it('removes a whole branch at once, leaves first', () => {
    const chain = reduce(
      start(),
      { type: 'addRelation', relation: association(BOLETO, PESSOA, 'pessoa') },
      { type: 'addRelation', relation: association(PESSOA, ENDERECO, 'endereco') },
    )
    const { state, blocked } = removeCascading(chain, [PESSOA, ENDERECO])
    expect(state.nodes.map((n) => n.id)).toEqual([BOLETO])
    expect(state.edges).toEqual([])
    expect(blocked).toEqual([])
  })

  it('keeps cards that still hold the diagram together', () => {
    const chain = reduce(
      start(),
      { type: 'addRelation', relation: association(BOLETO, PESSOA, 'pessoa') },
      { type: 'addRelation', relation: association(PESSOA, ENDERECO, 'endereco') },
    )
    const { state, blocked } = removeCascading(chain, [PESSOA])
    expect(blocked).toEqual([PESSOA])
    expect(state).toBe(chain)
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
