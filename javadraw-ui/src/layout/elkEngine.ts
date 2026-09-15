import ELK from 'elkjs/lib/elk-api'
import type { ElkNode } from 'elkjs/lib/elk-api'
import workerSource from 'elkjs/lib/elk-worker.min.js?raw'

let engine: InstanceType<typeof ELK> | null = null

/**
 * ELK runs in a Web Worker created from an inlined blob, so the generated page stays a single file
 * that also works when opened from file://.
 */
function getEngine(): InstanceType<typeof ELK> {
  if (!engine) {
    const url = URL.createObjectURL(new Blob([workerSource], { type: 'application/javascript' }))
    engine = new ELK({ workerUrl: url, workerFactory: (workerUrl) => new Worker(workerUrl!) })
  }
  return engine
}

export function runElk(graph: ElkNode): Promise<ElkNode> {
  return getEngine().layout(graph)
}
