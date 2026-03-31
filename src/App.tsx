import { PosterGeneratorPage } from './pages/PosterGeneratorPage'
import { RenderRuntimePage } from './pages/RenderRuntimePage'
import { TemplateManagePage } from './pages/TemplateManagePage'

function App() {
  const path = window.location.pathname
  if (path === '/render-runtime') {
    return <RenderRuntimePage />
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2">
        <a
          href="/"
          className={`rounded-md px-3 py-1.5 text-sm ${
            path === '/' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          商品图生成器
        </a>
        <a
          href="/templates"
          className={`rounded-md px-3 py-1.5 text-sm ${
            path === '/templates'
              ? 'bg-slate-900 text-white'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          模板管理
        </a>
      </header>
      <div className="min-h-0 flex-1">
        {path === '/templates' ? <TemplateManagePage /> : <PosterGeneratorPage />}
      </div>
    </div>
  )
}

export default App
