import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  createTemplate,
  getTemplateById,
  updateTemplate,
} from '../api/templateApi'
import { ControlPanel } from '../components/ControlPanel'
import { PreviewCanvas } from '../components/PreviewCanvas'
import type { PosterConfig, ProductBrushShadow, ProductOcclusionMask, ProductQuad } from '../types/render'
import { defaultPosterConfig, withDecorFrameDefaults } from '../config/defaultConfig'
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
  const setBackgroundNaturalSize = usePosterStore((s) => s.setBackgroundNaturalSize)
  const syncPosterDimensionsToBackground = usePosterStore(
    (s) => s.syncPosterDimensionsToBackground,
  )
  const backgroundNaturalWidth = usePosterStore((s) => s.backgroundNaturalWidth)
  const backgroundNaturalHeight = usePosterStore((s) => s.backgroundNaturalHeight)
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
  const productOcclusionMask = usePosterStore((s) => s.productOcclusionMask)
  const occlusionDraftPoints = usePosterStore((s) => s.occlusionDraftPoints)
  const occlusionDrawing = usePosterStore((s) => s.occlusionDrawing)
  const appendOcclusionDraftPoint = usePosterStore(
    (s) => s.appendOcclusionDraftPoint,
  )
  const finishOcclusionStroke = usePosterStore((s) => s.finishOcclusionStroke)
  const cancelOcclusionDrawing = usePosterStore((s) => s.cancelOcclusionDrawing)
  const setProductOcclusionMask = usePosterStore((s) => s.setProductOcclusionMask)

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
        setConfig(
          withDecorFrameDefaults(data.template.payload.config as PosterConfig),
        )
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
        const loadedOcclusion = (data.template.payload.productOcclusionMask ??
          null) as ProductOcclusionMask | null
        setProductOcclusionMask(
          loadedOcclusion
            ? {
                regions: loadedOcclusion.regions ?? [],
                feather: loadedOcclusion.feather ?? 2,
                edgeInset: loadedOcclusion.edgeInset ?? 1.5,
                contactShadowSpread: loadedOcclusion.contactShadowSpread ?? 5,
                contactShadowOpacity: loadedOcclusion.contactShadowOpacity ?? 0.22,
              }
            : null,
        )
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
    setProductOcclusionMask,
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

  const handleBackgroundLoad = (naturalWidth: number, naturalHeight: number) => {
    setBackgroundLoadFailed(false)
    const prev = usePosterStore.getState()
    const isDefaultCanvas =
      prev.config.canvas.width === defaultPosterConfig.canvas.width &&
      prev.config.canvas.height === defaultPosterConfig.canvas.height &&
      prev.config.export.width === defaultPosterConfig.export.width &&
      prev.config.export.height === defaultPosterConfig.export.height
    setBackgroundNaturalSize(naturalWidth, naturalHeight)
    if (!currentTemplateId && (isDefaultCanvas || prev.backgroundNaturalWidth === 0)) {
      syncPosterDimensionsToBackground(naturalWidth, naturalHeight)
    }
  }

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
          payload: { config, productQuad, productBrushShadow, productOcclusionMask },
        })
      } else {
        const created = await createTemplate({
          name: templateName.trim() || `模板-${Date.now()}`,
          payload: { config, productQuad, productBrushShadow, productOcclusionMask },
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
              onBackgroundLoad={handleBackgroundLoad}
              backgroundNaturalWidth={backgroundNaturalWidth}
              backgroundNaturalHeight={backgroundNaturalHeight}
              onAddQuadPoint={addDraftQuadPoint}
              onMoveQuadCorner={moveQuadCorner}
              productBrushShadow={productBrushShadow}
              brushDraftPoints={brushDraftPoints}
              brushDrawing={brushDrawing}
              onAppendBrushPoint={appendBrushDraftPoint}
              onFinishBrushStroke={finishBrushDrawing}
              onCancelBrushStroke={cancelBrushDrawing}
              productOcclusionMask={productOcclusionMask}
              occlusionDraftPoints={occlusionDraftPoints}
              occlusionDrawing={occlusionDrawing}
              onAppendOcclusionPoint={appendOcclusionDraftPoint}
              onFinishOcclusionStroke={finishOcclusionStroke}
              onCancelOcclusionStroke={cancelOcclusionDrawing}
              onPatchTitle={(p) => patchNested('title', p)}
              onPatchLogo={(p) => patchNested('logo', p)}
            />
          </div>
        </div>
      </section>
    </div>
  )
}
