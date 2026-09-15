import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { App } from './App'
import { indexGraph, type GraphIndex } from './data/graphIndex'
import { loadGraph } from './data/loadGraph'

function Root() {
  const [index, setIndex] = useState<GraphIndex>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    loadGraph()
      .then((graph) => {
        document.title = `${graph.meta.name} · JavaDraw`
        setIndex(indexGraph(graph))
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  if (error) {
    return <div className="grid h-full place-items-center text-[13px] text-red-600">Could not load graph: {error}</div>
  }
  if (!index) return null
  return <App index={index} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
