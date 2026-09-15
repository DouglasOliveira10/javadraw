import type { Graph } from './types'

/** Parses the graph embedded by the CLI; returns null when the page was not generated (dev mode). */
export function readEmbeddedGraph(doc: Document = document): Graph | null {
  const text = doc.getElementById('javadraw-data')?.textContent?.trim()
  return parseEmbeddedGraph(text)
}

/** The unfilled template still holds the placeholder token, which is not a JSON object. */
export function parseEmbeddedGraph(text: string | undefined | null): Graph | null {
  if (!text || !text.startsWith('{')) return null
  return JSON.parse(text) as Graph
}

export async function loadGraph(): Promise<Graph> {
  const embedded = readEmbeddedGraph()
  if (embedded) return embedded
  const response = await fetch(`${import.meta.env.BASE_URL}sample-graph.json`)
  if (!response.ok) throw new Error('No embedded graph and no sample-graph.json available')
  return (await response.json()) as Graph
}
