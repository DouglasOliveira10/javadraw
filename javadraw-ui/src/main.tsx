import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { App } from './App'
import { indexGraph, type GraphIndex } from './data/graphIndex'
import { loadGraph } from './data/loadGraph'
import { I18nProvider, useI18n } from './i18n/I18nProvider'

function Root() {
  const { t } = useI18n()
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
    return (
      <div className="grid h-full place-items-center text-[13px] text-red-600">{t('notice.loadFailed', { error })}</div>
    )
  }
  if (!index) return null
  return <App index={index} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <Root />
    </I18nProvider>
  </StrictMode>,
)
