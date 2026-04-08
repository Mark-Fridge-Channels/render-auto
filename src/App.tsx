import { useEffect, useState } from 'react'
import { getSession, login, logout } from './api/authApi'
import { PosterGeneratorPage } from './pages/PosterGeneratorPage'
import { RenderRuntimePage } from './pages/RenderRuntimePage'
import { TemplateManagePage } from './pages/TemplateManagePage'

function App() {
  const path = window.location.pathname
  if (path === '/render-runtime') {
    return <RenderRuntimePage />
  }
  const [loading, setLoading] = useState(true)
  const [authedUser, setAuthedUser] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const session = await getSession()
      if (session.authenticated) {
        setAuthedUser(session.username)
      }
      setLoading(false)
    })()
  }, [])

  if (loading) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-500">检查登录状态中...</div>
  }

  if (!authedUser) {
    return (
      <LoginPage
        onSuccess={(username) => {
          setAuthedUser(username)
        }}
      />
    )
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
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-slate-500">{authedUser}</span>
          <button
            type="button"
            className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
            onClick={async () => {
              await logout()
              setAuthedUser(null)
            }}
          >
            退出
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1">
        {path === '/templates' ? <TemplateManagePage /> : <PosterGeneratorPage />}
      </div>
    </div>
  )
}

function LoginPage({ onSuccess }: { onSuccess: (username: string) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex h-full items-center justify-center bg-slate-100 p-4">
      <form
        className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!username.trim() || !password) {
            setError('请输入账号和密码')
            return
          }
          setError(null)
          setSubmitting(true)
          try {
            await login(username.trim(), password)
            onSuccess(username.trim())
          } catch (err) {
            console.error(err)
            setError('账号或密码错误')
          } finally {
            setSubmitting(false)
          }
        }}
      >
        <h1 className="text-base font-semibold text-slate-900">访问验证</h1>
        <p className="mt-1 text-xs text-slate-500">请输入账号密码后继续。</p>
        <div className="mt-4 space-y-3">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="账号"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            autoComplete="username"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="密码"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            autoComplete="current-password"
          />
        </div>
        {error ? <div className="mt-3 text-xs text-rose-600">{error}</div> : null}
        <button
          type="submit"
          className="mt-4 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={submitting}
        >
          {submitting ? '登录中...' : '登录'}
        </button>
      </form>
    </div>
  )
}

export default App
