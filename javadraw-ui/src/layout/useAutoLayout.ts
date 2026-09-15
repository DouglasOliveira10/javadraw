import { useEffect, useRef, useState } from 'react'
import { useNodesInitialized, useReactFlow, type Edge, type Node } from '@xyflow/react'
import type { Diagram, EdgeRoute, Size } from './diagram'
import { fromElkGraph, toElkGraph } from './elkLayout'
import { runElk } from './elkEngine'

export type LayoutStatus = 'measuring' | 'layout' | 'ready' | 'error'

export interface RoutedEdgeData extends Record<string, unknown> {
  route?: EdgeRoute
}

/**
 * Two-pass layout: nodes are first rendered invisibly so React Flow can measure their real size,
 * then ELK computes positions and orthogonal edge routes, and the nodes fade in.
 *
 * The diagram is treated as immutable: mount a new canvas (e.g. with a React key) to lay out a
 * different diagram.
 */
export function useAutoLayout(diagram: Diagram) {
  const { getNodes, fitView } = useReactFlow()
  const [nodes, setNodes] = useState<Node[]>(() =>
    diagram.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: { x: 0, y: 0 },
      data: n.data,
      parentId: n.parent,
      style: { opacity: 0 },
      selectable: !n.group,
      focusable: !n.group,
      zIndex: n.group ? -1 : 0,
    })),
  )
  const [edges, setEdges] = useState<Edge[]>([])
  const [status, setStatus] = useState<LayoutStatus>(diagram.nodes.length ? 'measuring' : 'ready')
  const [error, setError] = useState<string>()
  const started = useRef(false)
  const alive = useRef(true)
  const initialized = useNodesInitialized()

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  useEffect(() => {
    if (!initialized || started.current) return
    const sizes = new Map<string, Size>()
    for (const node of getNodes()) {
      if (node.measured?.width && node.measured?.height) {
        sizes.set(node.id, { width: node.measured.width, height: node.measured.height })
      }
    }
    started.current = true
    setStatus('layout')
    runElk(toElkGraph(diagram, sizes))
      .then((laidOut) => {
        if (!alive.current) return
        const result = fromElkGraph(laidOut, diagram)
        setNodes((previous) =>
          previous.map((node) => {
            const size = result.groupSizes.get(node.id)
            // Group sizes come from ELK; explicit width/height make React Flow use them for bounds and fitView.
            return {
              ...node,
              position: result.positions.get(node.id) ?? node.position,
              style: size ? { width: size.width, height: size.height } : undefined,
              ...(size ? { width: size.width, height: size.height, measured: size } : {}),
              className: 'jd-fade-in',
            }
          }),
        )
        setEdges(
          diagram.edges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            type: 'routed',
            data: { ...e.data, label: e.label, route: result.routes.get(e.id) } satisfies RoutedEdgeData,
          })),
        )
        setStatus('ready')
      })
      .catch((e: unknown) => {
        if (!alive.current) return
        setError(e instanceof Error ? e.message : String(e))
        setStatus('error')
      })
  }, [initialized, diagram, getNodes])

  // Fit once the positioned nodes have been committed to the React Flow store.
  useEffect(() => {
    if (status !== 'ready') return
    // Two frames: the first commits positions, the second has them in React Flow's node lookup.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => fitView({ padding: 0.08, duration: 400, maxZoom: 1.1 }))
    })
    return () => cancelAnimationFrame(frame)
  }, [status, fitView])

  return { nodes, edges, setNodes, setEdges, status, error }
}
