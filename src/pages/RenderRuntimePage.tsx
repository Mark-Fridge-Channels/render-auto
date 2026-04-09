import { useEffect, useMemo, useState } from 'react'
import { toPng } from 'html-to-image'
import { withDecorFrameDefaults } from '../config/defaultConfig'
import { PreviewCanvas } from '../components/PreviewCanvas'
import type { PosterConfig, ProductBrushShadow, ProductQuad } from '../types/render'

type RuntimePayload = {
  config: PosterConfig
  productQuad: ProductQuad | null
  productBrushShadow?: ProductBrushShadow | null
  productImageUrl: string
}

type RuntimeWindow = Window & {
  __RENDER_PAYLOAD__?: unknown
  __RENDER_EXPORT_DATA_URL__?: string
  __RENDER_EXPORT_ERROR__?: string
  __RENDER_RUNTIME_STATE__?: string
}

function readRuntimePayload(): RuntimePayload | null {
  const raw = (window as RuntimeWindow).__RENDER_PAYLOAD__
  if (!raw || typeof raw !== 'object') return null
  const r = raw as RuntimePayload
  return {
    ...r,
    config: withDecorFrameDefaults(r.config as PosterConfig),
  }
}

/**
 * Minimal runtime page used by Headless Chromium batch renderer.
 */
export function RenderRuntimePage() {
  const payload = useMemo(() => readRuntimePayload(), [])
  const [sourceReady, setSourceReady] = useState(false)
  const [bakedPngUrl, setBakedPngUrl] = useState<string | null>(null)
  const [bakeFailed, setBakeFailed] = useState(false)

  useEffect(() => {
    ;(window as RuntimeWindow).__RENDER_RUNTIME_STATE__ = 'boot'
  }, [])

  useEffect(() => {
    let disposed = false
    if (bakedPngUrl || bakeFailed) return
    const root = document.querySelector('[data-render-root="true"]') as HTMLElement | null
    if (!root) return
    ;(window as RuntimeWindow).__RENDER_RUNTIME_STATE__ = 'waiting-source'

    const check = () => {
      if (disposed) return
      const imgs = Array.from(root.querySelectorAll('img'))
      // For runtime export, a broken image should fail fast later in bake step,
      // not block readiness polling indefinitely.
      const imgsReady = imgs.every((img) => img.complete)
      const productReady = root.querySelector('canvas[data-product-ready="true"]') !== null
      if (imgsReady && productReady) {
        ;(window as RuntimeWindow).__RENDER_RUNTIME_STATE__ = 'source-ready'
        setSourceReady(true)
        return
      }
      window.setTimeout(check, 80)
    }
    const t = window.setTimeout(check, 50)
    return () => {
      disposed = true
      window.clearTimeout(t)
    }
  }, [payload, bakedPngUrl, bakeFailed])

  useEffect(() => {
    let cancelled = false
    if (!sourceReady || bakedPngUrl || bakeFailed || !payload) return
    const root = document.querySelector('[data-render-root="true"]') as HTMLElement | null
    if (!root) return
    ;(window as RuntimeWindow).__RENDER_RUNTIME_STATE__ = 'baking'

    void (async () => {
      try {
        const dataUrl = await toPng(root, {
          width: payload.config.export.width,
          height: payload.config.export.height,
          pixelRatio: 1,
          cacheBust: false,
        })
        if (cancelled) return
        ;(window as RuntimeWindow).__RENDER_EXPORT_DATA_URL__ = dataUrl
        ;(window as RuntimeWindow).__RENDER_RUNTIME_STATE__ = 'done'
        setBakedPngUrl(dataUrl)
      } catch {
        if (cancelled) return
        const w = window as RuntimeWindow
        w.__RENDER_EXPORT_ERROR__ = 'html-to-image pre-bake failed (possibly CORS/tainted canvas)'
        w.__RENDER_RUNTIME_STATE__ = 'failed-bake'
        setBakeFailed(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [sourceReady, bakedPngUrl, bakeFailed, payload])

  useEffect(() => {
    if (bakedPngUrl || bakeFailed) return
    const timeoutMs = 25000
    const t = window.setTimeout(() => {
      const w = window as RuntimeWindow
      if (w.__RENDER_EXPORT_DATA_URL__ || w.__RENDER_EXPORT_ERROR__) return
      const root = document.querySelector('[data-render-root="true"]') as HTMLElement | null
      const imgCount = root ? root.querySelectorAll('img').length : 0
      const productReady = root ? root.querySelector('canvas[data-product-ready="true"]') !== null : false
      const state = w.__RENDER_RUNTIME_STATE__ || 'unknown'
      w.__RENDER_EXPORT_ERROR__ =
        `runtime ready timeout ${timeoutMs}ms (state=${state}, imgCount=${imgCount}, productReady=${productReady})`
      w.__RENDER_RUNTIME_STATE__ = 'failed-timeout'
      setBakeFailed(true)
    }, timeoutMs)
    return () => window.clearTimeout(t)
  }, [bakedPngUrl, bakeFailed])

  if (!payload) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-slate-600">
        missing render payload
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-white p-0">
      <div
        data-render-root="true"
        style={{
          width: payload.config.export.width,
          height: payload.config.export.height,
          overflow: 'hidden',
        }}
      >
        {bakedPngUrl ? (
          <img
            src={bakedPngUrl}
            alt=""
            className="block h-full w-full"
          />
        ) : (
          <PreviewCanvas
            exportRef={{ current: null }}
            config={payload.config}
            backgroundSrc={payload.config.backgroundImageUrl}
            productUrl={payload.productImageUrl}
            logoUrl={null}
            logoNaturalWidth={1}
            logoNaturalHeight={1}
            productQuad={payload.productQuad}
            quadDraft={[]}
            quadDrawing={false}
            backgroundFailed={false}
            onBackgroundError={() => {}}
            onBackgroundLoad={() => {}}
            onAddQuadPoint={() => {}}
            onMoveQuadCorner={() => {}}
            productBrushShadow={payload.productBrushShadow ?? null}
            brushDraftPoints={[]}
            brushDrawing={false}
            onAppendBrushPoint={() => {}}
            onFinishBrushStroke={() => {}}
            onCancelBrushStroke={() => {}}
            showInteraction={false}
            decorated={false}
          />
        )}
      </div>
      {bakedPngUrl || bakeFailed ? (
        <div data-render-ready="true" style={{ width: 1, height: 1 }} />
      ) : null}
    </div>
  )
}
