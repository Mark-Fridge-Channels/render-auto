import { useEffect, useState } from 'react'
import { deleteTemplate, listTemplates, runBatch, updateTemplate } from '../api/templateApi'
import type { BatchRenderResult, TemplateItem } from '../types/template'

/**
 * Dedicated template management page: list, order, enable toggle, delete and batch execution.
 */
export function TemplateManagePage() {
  const [templates, setTemplates] = useState<TemplateItem[]>([])
  const [busy, setBusy] = useState(false)
  const [productImageUrl, setProductImageUrl] = useState('')
  const [results, setResults] = useState<BatchRenderResult[]>([])

  const load = async () => {
    try {
      const data = await listTemplates()
      setTemplates(data.templates)
    } catch (err) {
      console.error(err)
      window.alert('模板列表加载失败')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const move = async (tpl: TemplateItem, delta: number) => {
    setBusy(true)
    try {
      await updateTemplate(tpl.id, { order: Math.max(1, tpl.order + delta) })
      await load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-6">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">模板管理</h2>
        <p className="mt-1 text-xs text-slate-600">支持排序、启用状态、删除以及跳转到生成页编辑。</p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          模板列表
        </div>
        <div className="flex flex-col gap-2">
          {templates.length === 0 ? (
            <p className="text-sm text-slate-500">暂无模板</p>
          ) : (
            templates.map((tpl) => (
              <div key={tpl.id} className="rounded border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">
                      #{tpl.order} {tpl.name}
                    </div>
                    <div className="text-[11px] text-slate-500">{tpl.id}</div>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    启用
                    <input
                      type="checkbox"
                      checked={tpl.enabled}
                      onChange={async (e) => {
                        await updateTemplate(tpl.id, { enabled: e.target.checked })
                        await load()
                      }}
                    />
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded border border-slate-200 px-3 py-1 text-xs"
                    onClick={() => void move(tpl, -1)}
                    disabled={busy}
                  >
                    上移
                  </button>
                  <button
                    type="button"
                    className="rounded border border-slate-200 px-3 py-1 text-xs"
                    onClick={() => void move(tpl, 1)}
                    disabled={busy}
                  >
                    下移
                  </button>
                  <button
                    type="button"
                    className="rounded border border-sky-200 px-3 py-1 text-xs text-sky-700"
                    onClick={() => {
                      window.location.href = `/?templateId=${encodeURIComponent(tpl.id)}`
                    }}
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    className="rounded border border-rose-200 px-3 py-1 text-xs text-rose-700"
                    onClick={async () => {
                      if (!window.confirm('确认删除该模板？')) return
                      await deleteTemplate(tpl.id)
                      await load()
                    }}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          批量执行（仅 enabled=true）
        </div>
        <input
          type="url"
          value={productImageUrl}
          onChange={(e) => setProductImageUrl(e.target.value)}
          placeholder="productImageUrl"
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
        />
        <button
          type="button"
          className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          disabled={busy}
          onClick={async () => {
            if (!productImageUrl.trim()) {
              window.alert('请输入 productImageUrl')
              return
            }
            setBusy(true)
            try {
              const data = await runBatch(productImageUrl.trim())
              setResults(data.results)
            } catch (err) {
              console.error(err)
              window.alert('批量执行失败')
            } finally {
              setBusy(false)
            }
          }}
        >
          按模板顺序生成并上传 S3
        </button>

        <div className="mt-3 flex flex-col gap-2">
          {results.map((r, i) => (
            <div key={`${r.templateName}-${i}`} className="rounded border border-slate-200 p-2 text-xs">
              <div className="font-medium text-slate-800">{r.templateName}</div>
              <div className="break-all text-slate-600">{r.s3Url ?? '-'}</div>
              {r.error ? <div className="text-rose-600">{r.error}</div> : null}
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
