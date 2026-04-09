import type { RefObject } from 'react'
import type { ProductBrushShadowMode } from '../types/render'
import { uploadBackgroundAsset } from '../api/templateApi'
import { usePosterStore } from '../store/posterStore'
import { exportPosterToPng, downloadBlob } from '../utils/exportPng'
import { maxSafeCornerRadius } from '../utils/roundedQuadClip'

type Props = {
  exportRootRef: RefObject<HTMLDivElement | null>
  templateName: string
  setTemplateName: (name: string) => void
  currentTemplateId: string | null
  savingTemplate: boolean
  onSaveTemplate: () => Promise<void>
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-600">
      <span className="font-medium text-slate-800">{label}</span>
      {children}
    </label>
  )
}

function Num({
  value,
  onChange,
  step = 1,
  min,
  max,
  disabled,
}: {
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
  disabled?: boolean
}) {
  return (
    <input
      type="number"
      step={step}
      min={min}
      max={max}
      disabled={disabled}
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:cursor-not-allowed disabled:bg-slate-100"
    />
  )
}

/**
 * Left rail — owns uploads, numeric parameters, quad controls, and PNG export.
 */
export function ControlPanel({
  exportRootRef,
  templateName,
  setTemplateName,
  currentTemplateId,
  savingTemplate,
  onSaveTemplate,
}: Props) {
  const config = usePosterStore((s) => s.config)
  const patchNested = usePosterStore((s) => s.patchNested)
  const patchConfig = usePosterStore((s) => s.patchConfig)

  const productUrl = usePosterStore((s) => s.productObjectUrl)
  const setProductFile = usePosterStore((s) => s.setProductFile)

  const logoUrl = usePosterStore((s) => s.logoObjectUrl)
  const setLogoFile = usePosterStore((s) => s.setLogoFile)

  const productQuad = usePosterStore((s) => s.productQuad)
  const quadDraft = usePosterStore((s) => s.quadDraft)
  const quadDrawing = usePosterStore((s) => s.quadDrawing)
  const beginQuadDrawingSession = usePosterStore((s) => s.beginQuadDrawingSession)

  const productBrushShadow = usePosterStore((s) => s.productBrushShadow)
  const brushTool = usePosterStore((s) => s.brushTool)
  const brushDrawing = usePosterStore((s) => s.brushDrawing)
  const beginBrushDrawingSession = usePosterStore((s) => s.beginBrushDrawingSession)
  const cancelBrushDrawing = usePosterStore((s) => s.cancelBrushDrawing)
  const clearProductBrushShadow = usePosterStore((s) => s.clearProductBrushShadow)
  const patchProductBrushShadow = usePosterStore((s) => s.patchProductBrushShadow)
  const patchBrushTool = usePosterStore((s) => s.patchBrushTool)

  const setBackgroundLoadFailed = usePosterStore((s) => s.setBackgroundLoadFailed)
  const setBackgroundFile = usePosterStore((s) => s.setBackgroundFile)
  const revokeBackgroundFetched = usePosterStore((s) => s.revokeBackgroundFetched)
  const clearBackgroundOverrides = usePosterStore((s) => s.clearBackgroundOverrides)
  const fetchBackgroundBlobFromUrl = usePosterStore(
    (s) => s.fetchBackgroundBlobFromUrl,
  )
  const backgroundFileUrl = usePosterStore((s) => s.backgroundFileUrl)
  const backgroundFetchedUrl = usePosterStore((s) => s.backgroundFetchedUrl)
  const exportDisabled = !productQuad || productQuad.length !== 4

  const onExport = async () => {
    const node = exportRootRef.current
    if (!node) return
    if (exportDisabled) {
      window.alert('请先完成四角标记（左上 → 右上 → 右下 → 左下）。')
      return
    }
    try {
      const blob = await exportPosterToPng(node, {
        width: config.export.width,
        height: config.export.height,
      })
      downloadBlob(blob, `poster-${Date.now()}.png`)
    } catch (err) {
      console.error(err)
      window.alert(
        '导出失败：请优先通过「本地上传背景」或「从 URL 拉取」获取同源 Blob；若仍失败，可能是目标图禁用了跨域或为浏览器快照限制。',
      )
    }
  }


  return (
    <aside className="flex h-full min-h-0 w-[380px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-slate-200 bg-slate-50/80 p-4 backdrop-blur">
      <header>
        <h1 className="text-base font-semibold text-slate-900">商品图生成器</h1>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          背景可使用<strong>本地上传</strong>或点击「从 URL
          拉取」将远程图转为 Blob，从而规避大部分导出时的跨域染色问题。
        </p>
      </header>

      <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          画布与导出
        </h2>
        <Field label="背景图 URL（直连，可能与导出 CORS 有关）">
          <input
            type="url"
            value={config.backgroundImageUrl}
            onChange={(e) => {
              setBackgroundLoadFailed(false)
              revokeBackgroundFetched()
              patchConfig({ backgroundImageUrl: e.target.value })
            }}
            className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </Field>
        <Field label="背景图（本地上传，推荐）">
          <input
            type="file"
            accept="image/*"
            onChange={async (e) => {
              const f = e.target.files?.[0] ?? null
              if (!f) return
              try {
                const uploaded = await uploadBackgroundAsset(f)
                clearBackgroundOverrides()
                patchConfig({ backgroundImageUrl: uploaded.path })
              } catch (err) {
                console.error(err)
                // Fallback to in-memory blob when local API upload fails.
                setBackgroundFile(f)
              }
              setBackgroundLoadFailed(false)
            }}
            className="text-xs text-slate-700 file:mr-2 file:rounded-md file:border file:border-slate-200 file:bg-slate-50 file:px-2 file:py-1 file:text-xs"
          />
          <span className="text-[10px] text-slate-400">
            {backgroundFileUrl
              ? '正使用本地文件覆盖 URL'
              : '未选择本地文件'}
          </span>
        </Field>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-sm hover:bg-slate-50"
            onClick={async () => {
              try {
                await fetchBackgroundBlobFromUrl(config.backgroundImageUrl)
                setBackgroundLoadFailed(false)
              } catch {
                window.alert(
                  '从 URL 拉取失败：请确认链接可公网访问且响应包含 Access-Control-Allow-Origin，或直接改用上方本地上传。',
                )
              }
            }}
          >
            从 URL 拉取到本地 Blob（需目标支持 CORS）
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={() => {
              clearBackgroundOverrides()
              setBackgroundLoadFailed(false)
            }}
          >
            清除本地 / 拉取的背景
          </button>
          {backgroundFetchedUrl ? (
            <p className="text-[10px] text-emerald-600">
              已缓存拉取的背景 Blob；导出时优先使用该副本。
            </p>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="画布宽">
            <Num
              min={64}
              value={config.canvas.width}
              onChange={(v) => patchNested('canvas', { width: Math.max(64, v) })}
            />
          </Field>
          <Field label="画布高">
            <Num
              min={64}
              value={config.canvas.height}
              onChange={(v) => patchNested('canvas', { height: Math.max(64, v) })}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="导出宽">
            <Num
              min={1}
              value={config.export.width}
              onChange={(v) => patchNested('export', { width: Math.max(1, v) })}
            />
          </Field>
          <Field label="导出高">
            <Num
              min={1}
              value={config.export.height}
              onChange={(v) => patchNested('export', { height: Math.max(1, v) })}
            />
          </Field>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          资源
        </h2>
        <Field label="产品图（PNG / JPG）">
          <input
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            onChange={(e) =>
              setProductFile(e.target.files?.[0] ?? null)
            }
            className="text-xs text-slate-700 file:mr-2 file:rounded-md file:border file:border-slate-200 file:bg-slate-50 file:px-2 file:py-1 file:text-xs"
          />
          <span className="text-[10px] text-slate-400">
            {productUrl ? '已选择本地文件' : '未选择'}
          </span>
        </Field>
        <Field label="Logo（可选）">
          <input
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
            onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
            className="text-xs text-slate-700 file:mr-2 file:rounded-md file:border file:border-slate-200 file:bg-slate-50 file:px-2 file:py-1 file:text-xs"
          />
          <span className="text-[10px] text-slate-400">
            {logoUrl ? '已选择' : '未选择'}
          </span>
        </Field>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          四点贴图
        </h2>
        <button
          type="button"
          onClick={beginQuadDrawingSession}
          className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white shadow hover:bg-sky-700"
        >
          {quadDrawing ? '重新标记四点' : '开始标记四点'}
        </button>
        <p className="text-xs leading-relaxed text-slate-600">
          {quadDrawing
            ? `请按顺序点击：左上 → 右上 → 右下 → 左下（当前 ${quadDraft.length}/4）。`
            : productQuad
              ? '四点已锁定，可直接拖拽浅蓝色控制点微调。再次点击上方按钮可清空重做。'
              : '点击按钮后，在画布上依次点四个角；亦可先打点再上传产品图。'}
        </p>
        <Field label="产品贴图圆角（画布像素，0 为直角）">
          <div className="flex flex-col gap-2">
            {productQuad ? (
              <>
                <input
                  type="range"
                  min={0}
                  max={Math.max(
                    1,
                    Math.ceil(maxSafeCornerRadius(productQuad)),
                  )}
                  value={Math.min(
                    config.product.cornerRadius,
                    maxSafeCornerRadius(productQuad),
                  )}
                  onChange={(e) => {
                    const cap = maxSafeCornerRadius(productQuad)
                    const n = Number(e.target.value)
                    patchNested('product', {
                      cornerRadius: Math.min(Math.max(0, n), cap),
                    })
                  }}
                  className="w-full accent-sky-600"
                />
                <Num
                  min={0}
                  step={1}
                  value={Math.min(
                    config.product.cornerRadius,
                    productQuad
                      ? maxSafeCornerRadius(productQuad)
                      : config.product.cornerRadius,
                  )}
                  onChange={(v) => {
                    const cap = productQuad
                      ? maxSafeCornerRadius(productQuad)
                      : Infinity
                    patchNested('product', {
                      cornerRadius: Math.min(Math.max(0, v), cap),
                    })
                  }}
                />
                <p className="text-[10px] leading-relaxed text-sky-800">
                  当前四点下圆角上限：约{' '}
                  <strong>{maxSafeCornerRadius(productQuad).toFixed(0)}</strong>{' '}
                  px（再大会顶到短边或锐角，已自动封顶）。拖滑块即可直观看到弧度。
                </p>
              </>
            ) : (
              <>
                <Num
                  min={0}
                  step={1}
                  value={config.product.cornerRadius}
                  onChange={(v) =>
                    patchNested('product', { cornerRadius: Math.max(0, v) })
                  }
                />
                <p className="text-[10px] leading-relaxed text-slate-500">
                  完成四点标记后，会显示滑块与「安全上限」说明；数值表示裁剪轮廓上每个角的圆弧半径（画布坐标）。
                </p>
              </>
            )}
          </div>
        </Field>
        <label className="flex items-center gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 accent-sky-600"
            checked={config.product.realismEnabled}
            onChange={(e) =>
              patchNested('product', { realismEnabled: e.target.checked })
            }
          />
          开启真实感（阴影/光照/色彩匹配/轻微噪点）
        </label>
        <Field label="真实感强度（0-100）">
          <div className="flex flex-col gap-2">
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.max(0, Math.min(100, config.product.realismStrength))}
              onChange={(e) =>
                patchNested('product', {
                  realismStrength: Math.max(0, Math.min(100, Number(e.target.value))),
                })
              }
              className="w-full accent-sky-600"
              disabled={!config.product.realismEnabled}
            />
            <Num
              min={0}
              step={1}
              value={Math.max(0, Math.min(100, config.product.realismStrength))}
              onChange={(v) =>
                patchNested('product', {
                  realismStrength: Math.max(0, Math.min(100, v)),
                })
              }
            />
          </div>
        </Field>
        <label className="flex items-center gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 accent-sky-600"
            checked={config.product.quadInnerShadowEnabled ?? false}
            onChange={(e) =>
              patchNested('product', { quadInnerShadowEnabled: e.target.checked })
            }
          />
          产品四边形整体内阴影（贴图边缘一圈；可与手绘光影叠加变暗）
        </label>
        <div className="grid grid-cols-2 gap-2">
          <Field label="整体内阴影 · 模糊半径（画布 px）">
            <Num
              min={0}
              step={0.5}
              value={config.product.quadInnerShadowBlur ?? 14}
              onChange={(v) =>
                patchNested('product', { quadInnerShadowBlur: Math.max(0, v) })
              }
              disabled={!(config.product.quadInnerShadowEnabled ?? false)}
            />
          </Field>
          <Field label="整体内阴影 · 不透明度（0–1）">
            <Num
              min={0}
              max={1}
              step={0.05}
              value={config.product.quadInnerShadowOpacity ?? 0.35}
              onChange={(v) =>
                patchNested('product', {
                  quadInnerShadowOpacity: Math.min(1, Math.max(0, v)),
                })
              }
              disabled={!(config.product.quadInnerShadowEnabled ?? false)}
            />
          </Field>
        </div>
        <p className="text-[10px] leading-relaxed text-slate-500">
          推荐流程：先定四点和圆角，再打开真实感并用强度滑块微调。该开关仅影响产品贴图层，不影响背景/标题/logo。整体内阴影与手绘区域各自独立，同时开启时按绘制顺序叠加变暗。
        </p>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          手绘光影区域
        </h2>
        <p className="text-xs leading-relaxed text-slate-600">
          仅在<strong>产品圆角裁剪框内</strong>叠加阴影：自由拖拽闭合多边形（抬笔自动首尾相连）。定稿后形状不可拖动，仍可调参数或清除重画。
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!productQuad || brushDrawing}
            onClick={() => beginBrushDrawingSession()}
            className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium text-white shadow hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            开始手绘区域
          </button>
          <button
            type="button"
            disabled={!brushDrawing}
            onClick={() => cancelBrushDrawing()}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            取消当前笔划
          </button>
          <button
            type="button"
            disabled={!productBrushShadow}
            onClick={() => clearProductBrushShadow()}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            清除已保存区域
          </button>
        </div>
        {brushDrawing ? (
          <p className="text-[11px] font-medium text-violet-800">
            在画布上按住拖动绘制；松开即定稿（至少三个转折点且封闭后面积足够才生效）。
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <Field label="模式">
            <select
              value={
                productBrushShadow && !brushDrawing
                  ? productBrushShadow.mode
                  : brushTool.mode
              }
              onChange={(e) => {
                const mode = e.target.value as ProductBrushShadowMode
                if (productBrushShadow && !brushDrawing) {
                  patchProductBrushShadow({ mode })
                } else {
                  patchBrushTool({ mode })
                }
              }}
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="outer">外阴影（沿边缘向外晕开）</option>
              <option value="inner">内阴影（靠边越淡，越往区域中心越深）</option>
            </select>
          </Field>
          <Field label="颜色 (#RRGGBB)">
            <input
              type="text"
              value={
                productBrushShadow && !brushDrawing
                  ? productBrushShadow.color
                  : brushTool.color
              }
              onChange={(e) => {
                const color = e.target.value
                if (productBrushShadow && !brushDrawing) {
                  patchProductBrushShadow({ color })
                } else {
                  patchBrushTool({ color })
                }
              }}
              className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="模糊半径（画布 px）">
            <Num
              min={0}
              step={0.5}
              value={
                productBrushShadow && !brushDrawing
                  ? productBrushShadow.blur
                  : brushTool.blur
              }
              onChange={(v) => {
                const blur = Math.max(0, v)
                if (productBrushShadow && !brushDrawing) {
                  patchProductBrushShadow({ blur })
                } else {
                  patchBrushTool({ blur })
                }
              }}
            />
          </Field>
          <Field label="不透明度（0–1）">
            <Num
              min={0}
              max={1}
              step={0.05}
              value={
                productBrushShadow && !brushDrawing
                  ? productBrushShadow.opacity
                  : brushTool.opacity
              }
              onChange={(v) => {
                const opacity = Math.min(1, Math.max(0, v))
                if (productBrushShadow && !brushDrawing) {
                  patchProductBrushShadow({ opacity })
                } else {
                  patchBrushTool({ opacity })
                }
              }}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="偏移 X（外阴影）">
            <Num
              value={
                productBrushShadow && !brushDrawing
                  ? productBrushShadow.offsetX
                  : brushTool.offsetX
              }
              onChange={(v) => {
                if (productBrushShadow && !brushDrawing) {
                  patchProductBrushShadow({ offsetX: v })
                } else {
                  patchBrushTool({ offsetX: v })
                }
              }}
            />
          </Field>
          <Field label="偏移 Y（外阴影）">
            <Num
              value={
                productBrushShadow && !brushDrawing
                  ? productBrushShadow.offsetY
                  : brushTool.offsetY
              }
              onChange={(v) => {
                if (productBrushShadow && !brushDrawing) {
                  patchProductBrushShadow({ offsetY: v })
                } else {
                  patchBrushTool({ offsetY: v })
                }
              }}
            />
          </Field>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          顶层装饰框
        </h2>
        <p className="text-[10px] leading-relaxed text-slate-500">
          圆角矩形描边，框内可加半透明叠色；相对画布水平垂直居中，叠在标题与
          Logo 之上；按模板保存，未开启的模板不会显示。
        </p>
        <label className="flex items-center gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 accent-sky-600"
            checked={config.decorFrame.enabled}
            onChange={(e) =>
              patchNested('decorFrame', { enabled: e.target.checked })
            }
          />
          显示装饰框
        </label>
        <div className="grid grid-cols-2 gap-2">
          <Field label="框宽（画布 px）">
            <Num
              min={1}
              value={config.decorFrame.width}
              onChange={(v) =>
                patchNested('decorFrame', { width: Math.max(1, v) })
              }
              disabled={!config.decorFrame.enabled}
            />
          </Field>
          <Field label="框高（画布 px）">
            <Num
              min={1}
              value={config.decorFrame.height}
              onChange={(v) =>
                patchNested('decorFrame', { height: Math.max(1, v) })
              }
              disabled={!config.decorFrame.enabled}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="圆角半径（画布 px）">
            <Num
              min={0}
              value={config.decorFrame.cornerRadius}
              onChange={(v) =>
                patchNested('decorFrame', { cornerRadius: Math.max(0, v) })
              }
              disabled={!config.decorFrame.enabled}
            />
          </Field>
          <Field label="描边宽度（画布 px）">
            <Num
              min={0}
              step={0.5}
              value={config.decorFrame.borderWidth}
              onChange={(v) =>
                patchNested('decorFrame', { borderWidth: Math.max(0, v) })
              }
              disabled={!config.decorFrame.enabled}
            />
          </Field>
        </div>
        <Field label="描边颜色 (#RRGGBB 等)">
          <input
            type="text"
            value={config.decorFrame.color}
            onChange={(e) =>
              patchNested('decorFrame', { color: e.target.value })
            }
            disabled={!config.decorFrame.enabled}
            className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-slate-100"
          />
        </Field>
        <Field label="框内半透明 · 颜色">
          <input
            type="text"
            value={config.decorFrame.fillColor}
            onChange={(e) =>
              patchNested('decorFrame', { fillColor: e.target.value })
            }
            disabled={!config.decorFrame.enabled}
            className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-slate-100"
          />
        </Field>
        <Field label="框内半透明 · 不透明度（0–1，0 为无填充）">
          <div className="flex flex-col gap-2">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={Math.min(1, Math.max(0, config.decorFrame.fillOpacity))}
              onChange={(e) =>
                patchNested('decorFrame', {
                  fillOpacity: Math.min(1, Math.max(0, Number(e.target.value))),
                })
              }
              disabled={!config.decorFrame.enabled}
              className="w-full accent-sky-600 disabled:opacity-50"
            />
            <Num
              min={0}
              max={1}
              step={0.05}
              value={Math.min(1, Math.max(0, config.decorFrame.fillOpacity))}
              onChange={(v) =>
                patchNested('decorFrame', {
                  fillOpacity: Math.min(1, Math.max(0, v)),
                })
              }
              disabled={!config.decorFrame.enabled}
            />
          </div>
        </Field>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          标题
        </h2>
        <p className="text-[10px] leading-relaxed text-slate-500">
          画布上可拖拽虚线框移动位置，拖动右下角圆点同步放大缩小（宽度与字号按比例）。
        </p>
        <Field label="文案">
          <input
            type="text"
            value={config.title.text}
            onChange={(e) => patchNested('title', { text: e.target.value })}
            className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="x">
            <Num value={config.title.x} onChange={(v) => patchNested('title', { x: v })} />
          </Field>
          <Field label="y">
            <Num value={config.title.y} onChange={(v) => patchNested('title', { y: v })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="宽（单行截断）">
            <Num
              min={0}
              value={config.title.width}
              onChange={(v) => patchNested('title', { width: Math.max(0, v) })}
            />
          </Field>
          <Field label="字号">
            <Num
              min={1}
              value={config.title.fontSize}
              onChange={(v) => patchNested('title', { fontSize: Math.max(1, v) })}
            />
          </Field>
        </div>
        <Field label="颜色 (#RRGGBB)">
          <input
            type="text"
            value={config.title.color}
            onChange={(e) => patchNested('title', { color: e.target.value })}
            className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </Field>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Logo
        </h2>
        <p className="text-[10px] leading-relaxed text-slate-500">
          上传 Logo 后可在画布拖拽虚线框移动，右下角圆点调整宽度（高度随比例）。
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Field label="x">
            <Num value={config.logo.x} onChange={(v) => patchNested('logo', { x: v })} />
          </Field>
          <Field label="y">
            <Num value={config.logo.y} onChange={(v) => patchNested('logo', { y: v })} />
          </Field>
        </div>
        <Field label="宽度（高度自动按比例）">
          <Num
            min={1}
            value={config.logo.width}
            onChange={(v) => patchNested('logo', { width: Math.max(1, v) })}
          />
        </Field>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          模板
        </h2>
        <Field label="模板名">
          <input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </Field>
        <button
          type="button"
          disabled={savingTemplate}
          onClick={() => void onSaveTemplate()}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50"
        >
          {currentTemplateId ? '保存模板（更新当前）' : '保存模板（新建）'}
        </button>
        <button
          type="button"
          onClick={() => {
            window.location.href = '/templates'
          }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
        >
          前往模板管理页
        </button>
      </section>

      <div className="mt-auto">
        <button
          type="button"
          disabled={exportDisabled}
          onClick={onExport}
          className="w-full rounded-xl bg-slate-900 px-3 py-3 text-sm font-semibold text-white shadow-lg hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          导出 PNG
        </button>
        {exportDisabled ? (
          <p className="mt-2 text-center text-[11px] text-slate-500">
            完成四点后才可导出
          </p>
        ) : null}
      </div>
    </aside>
  )
}
