import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  createTemplate,
  getTemplateById,
  updateTemplate,
} from '../api/templateApi'
import { ControlPanel } from '../components/ControlPanel'
import { PreviewCanvas } from '../components/PreviewCanvas'
import type { ProductBrushShadow, ProductQuad } from '../types/render'
import { usePosterStore } from '../store/posterStore'

/**
 * Single-page authoring shell — responsive preview framing around the fixed logical poster size.
 */
export function PosterGeneratorPage() {
  const exportRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.5)

  const config = usePosterStore((s) => s.config)
  const productUrl = usePosterStore((s) => s.productObjectUrl)
  const logoUrl = usePosterStore((s) => s.logoObjectUrl)
  const logoNaturalWidth = usePosterStore((s) => s.logoNaturalWidth)
  const logoNaturalHeight = usePosterStore((s) => s.logoNaturalHeight)
  const productQuad = usePosterStore((s) => s.productQuad)
  const quadDraft = usePosterStore((s) => s.quadDraft)
  const quadDrawing = usePosterStore((s) => s.quadDrawing)
  const backgroundFailed = usePosterStore((s) => s.backgroundLoadFailed)
  const backgroundFileUrl = usePosterStore((s) => s.backgroundFileUrl)
  const backgroundFetchedUrl = usePosterStore((s) => s.backgroundFetchedUrl)
  const addDraftQuadPoint = usePosterStore((s) => s.addDraftQuadPoint)
  const moveQuadCorner = usePosterStore((s) => s.moveQuadCorner)
  const setConfig = usePosterStore((s) => s.setConfig)
  const setBackgroundLoadFailed = usePosterStore((s) => s.setBackgroundLoadFailed)
  const setProductQuad = usePosterStore((s) => s.setProductQuad)
  const productBrushShadow = usePosterStore((s) => s.productBrushShadow)
  const brushDraftPoints = usePosterStore((s) => s.brushDraftPoints)
  const brushDrawing = usePosterStore((s) => s.brushDrawing)
  const appendBrushDraftPoint = usePosterStore((s) => s.appendBrushDraftPoint)
  const finishBrushDrawing = usePosterStore((s) => s.finishBrushDrawing)
  const cancelBrushDrawing = usePosterStore((s) => s.cancelBrushDrawing)
  const setProductBrushShadow = usePosterStore((s) => s.setProductBrushShadow)
  const patchBrushTool = usePosterStore((s) => s.patchBrushTool)
  const patchNested = usePosterStore((s) => s.patchNested)

  const [templateName, setTemplateName] = useState('未命名模板')
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(null)
  const [savingTemplate, setSavingTemplate] = useState(false)

  const queryTemplateId = useMemo(() => {
    const sp = new URLSearchParams(window.location.search)
    return sp.get('templateId')
  }, [])

  useEffect(() => {
    if (!queryTemplateId) return
    void (async () => {
      try {
        const data = await getTemplateById(queryTemplateId)
        setBackgroundLoadFailed(false)
        setConfig(data.template.payload.config)
        setProductQuad((data.template.payload.productQuad ?? null) as ProductQuad | null)
        const loadedShadow = (data.template.payload.productBrushShadow ??
          null) as ProductBrushShadow | null
        setProductBrushShadow(loadedShadow)
        if (loadedShadow) {
          patchBrushTool({
            mode: loadedShadow.mode,
            blur: loadedShadow.blur,
            opacity: loadedShadow.opacity,
            offsetX: loadedShadow.offsetX,
            offsetY: loadedShadow.offsetY,
            color: loadedShadow.color,
          })
        }
        setTemplateName(data.template.name)
        setCurrentTemplateId(data.template.id)
      } catch (err) {
        console.error(err)
        window.alert('模板加载失败')
      }
    })()
  }, [
    queryTemplateId,
    setConfig,
    setBackgroundLoadFailed,
    setProductQuad,
    setProductBrushShadow,
    patchBrushTool,
  ])

  useLayoutEffect(() => {
    const shell = viewportRef.current
    if (!shell) return

    function measure() {
      const rect = viewportRef.current?.getBoundingClientRect()
      if (!rect) return
      const pad = 56
      const sw = Math.max(120, rect.width - pad)
      const sh = Math.max(120, rect.height - pad)
      const s = Math.min(
        sw / config.canvas.width,
        sh / config.canvas.height,
        1,
      )
      setScale(Number.isFinite(s) ? s : 1)
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(shell)
    return () => ro.disconnect()
  }, [config.canvas.height, config.canvas.width])

  const backgroundSrc =
    backgroundFileUrl ??
    backgroundFetchedUrl ??
    config.backgroundImageUrl

  const onSaveTemplate = async () => {
    if (!productQuad) {
      window.alert('保存模板前请先完成四点标记')
      return
    }
    setSavingTemplate(true)
    try {
      if (currentTemplateId) {
        await updateTemplate(currentTemplateId, {
          name: templateName.trim() || '未命名模板',
          payload: { config, productQuad, productBrushShadow },
        })
      } else {
        const created = await createTemplate({
          name: templateName.trim() || `模板-${Date.now()}`,
          payload: { config, productQuad, productBrushShadow },
          enabled: true,
        })
        setCurrentTemplateId(created.template.id)
      }
      window.alert('模板保存成功')
    } catch (err) {
      console.error(err)
      window.alert('模板保存失败')
    } finally {
      setSavingTemplate(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 bg-slate-100">
      <ControlPanel
        exportRootRef={exportRef}
        templateName={templateName}
        setTemplateName={setTemplateName}
        currentTemplateId={currentTemplateId}
        savingTemplate={savingTemplate}
        onSaveTemplate={onSaveTemplate}
      />
      <section
        ref={viewportRef}
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-6"
      >
        <div
          style={{
            width: config.canvas.width * scale,
            height: config.canvas.height * scale,
          }}
        >
          <div
            style={{
              width: config.canvas.width,
              height: config.canvas.height,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
            <PreviewCanvas
              exportRef={exportRef}
              config={config}
              backgroundSrc={backgroundSrc}
              productUrl={productUrl}
              logoUrl={logoUrl}
              logoNaturalWidth={logoNaturalWidth}
              logoNaturalHeight={logoNaturalHeight}
              productQuad={productQuad}
              quadDraft={quadDraft}
              quadDrawing={quadDrawing}
              backgroundFailed={backgroundFailed}
              onBackgroundError={() => setBackgroundLoadFailed(true)}
              onBackgroundLoad={() => setBackgroundLoadFailed(false)}
              onAddQuadPoint={addDraftQuadPoint}
              onMoveQuadCorner={moveQuadCorner}
              productBrushShadow={productBrushShadow}
              brushDraftPoints={brushDraftPoints}
              brushDrawing={brushDrawing}
              onAppendBrushPoint={appendBrushDraftPoint}
              onFinishBrushStroke={finishBrushDrawing}
              onCancelBrushStroke={cancelBrushDrawing}
              onPatchTitle={(p) => patchNested('title', p)}
              onPatchLogo={(p) => patchNested('logo', p)}
            />
          </div>
        </div>
      </section>
    </div>
  )
}
