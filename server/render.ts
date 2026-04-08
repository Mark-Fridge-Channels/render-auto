import { chromium } from 'playwright'
import { config as loadEnv } from 'dotenv'
import { z } from 'zod'
import { buildObjectKey, uploadPngToS3 } from './s3'

loadEnv()

const payloadSchema = z.object({
  config: z.object({
    canvas: z.object({
      width: z.number(),
      height: z.number(),
    }),
    title: z.object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      fontSize: z.number(),
    }).passthrough(),
    logo: z.object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
    }).passthrough(),
    export: z.object({
      width: z.number(),
      height: z.number(),
    }),
  }).passthrough(),
  productQuad: z.unknown(),
  productBrushShadow: z.unknown().optional(),
})

type RenderTemplate = {
  id: string
  name: string
  order: number
  payload: unknown
}

type Point = { x: number; y: number }

function toRuntimeAssetUrl(appUrl: string, rawUrl: string): string {
  const s = rawUrl.trim()
  if (!s) return s
  if (s.startsWith('blob:') || s.startsWith('data:')) return s
  const absolute = new URL(s, appUrl)
  return `/api/render-asset?url=${encodeURIComponent(absolute.toString())}`
}

function withCacheBust(url: string, token: string): string {
  if (!url) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}cb=${encodeURIComponent(token)}`
}

function scalePayloadToExport(payload: z.infer<typeof payloadSchema>) {
  const cW = Math.max(1, Number(payload.config.canvas.width || payload.config.export.width))
  const cH = Math.max(1, Number(payload.config.canvas.height || payload.config.export.height))
  const eW = Math.max(1, Number(payload.config.export.width))
  const eH = Math.max(1, Number(payload.config.export.height))
  const sx = eW / cW
  const sy = eH / cH

  const cfg = structuredClone(payload.config)
  cfg.canvas.width = eW
  cfg.canvas.height = eH

  cfg.title.x *= sx
  cfg.title.y *= sy
  cfg.title.width *= sx
  cfg.title.fontSize *= sy
  cfg.logo.x *= sx
  cfg.logo.y *= sy
  cfg.logo.width *= sx

  const sAvg = (sx + sy) / 2
  if (cfg.product && typeof cfg.product === 'object') {
    const prod = cfg.product as { quadInnerShadowBlur?: number }
    if (typeof prod.quadInnerShadowBlur === 'number') {
      prod.quadInnerShadowBlur *= sAvg
    }
  }

  const scaledQuad = Array.isArray(payload.productQuad)
    ? (payload.productQuad as Point[]).map((p) => ({ x: p.x * sx, y: p.y * sy }))
    : payload.productQuad

  type Brush = {
    points: Point[]
    blur: number
    offsetX?: number
    offsetY?: number
    mode: string
    opacity: number
    color: string
  }

  let productBrushShadow: unknown = payload.productBrushShadow
  const raw = payload.productBrushShadow
  if (
    raw &&
    typeof raw === 'object' &&
    Array.isArray((raw as Brush).points) &&
    (raw as Brush).points!.every(
      (p) =>
        p &&
        typeof p === 'object' &&
        typeof (p as Point).x === 'number' &&
        typeof (p as Point).y === 'number',
    )
  ) {
    const b = raw as Brush
    productBrushShadow = {
      ...b,
      points: b.points.map((p) => ({ x: p.x * sx, y: p.y * sy })),
      blur: b.blur * sAvg,
      offsetX: (b.offsetX ?? 0) * sx,
      offsetY: (b.offsetY ?? 0) * sy,
    }
  }

  return {
    config: cfg,
    productQuad: scaledQuad,
    productBrushShadow,
  }
}

export async function renderBatchWithChromium(input: {
  batchId: string
  productImageUrl: string
  templates: RenderTemplate[]
}) {
  // Keep local DX simple: fall back to Vite dev URL when env is absent.
  const appUrl = process.env.RENDER_APP_URL?.trim() || 'http://localhost:5173'

  const browser = await chromium.launch({ headless: true })
  /**
   * Headless rasterization is more prone to revealing triangle-tessellation seams.
   * Render at higher DPR then downsample to CSS pixels for smoother output.
   */
  const context = await browser.newContext({ deviceScaleFactor: 2 })

  try {
    const results: Array<{ templateName: string; s3Url: string | null; error: string | null }> = []
    for (const tpl of input.templates) {
      try {
        const payload = payloadSchema.parse(tpl.payload)
        const page = await context.newPage()
        // Attach debug listeners from page to server logs to diagnose render timeouts
        page.on('console', (msg) => {
          try {
            const text = msg.text()
            console.log(`[playwright:${tpl.name}] console ${msg.type()}: ${text}`)
          } catch (e) {
            console.log('[playwright] console event error', e)
          }
        })
        page.on('pageerror', (err) => {
          console.log(`[playwright:${tpl.name}] pageerror: ${err?.message ?? String(err)}`)
        })
        page.on('requestfailed', (req) => {
          const failure = req.failure()
          console.log(`[playwright:${tpl.name}] requestfailed: ${req.url()} ${failure?.errorText ?? ''}`)
        })
        page.on('response', (res) => {
          try {
            console.log(`[playwright:${tpl.name}] response ${res.status()} ${res.url()}`)
          } catch {}
        })
        const exportWidth = Math.max(1, Number(payload.config.export.width || 1600))
        const exportHeight = Math.max(1, Number(payload.config.export.height || 2000))
        await page.setViewportSize({
          width: Math.min(8000, Math.round(exportWidth)),
          height: Math.min(8000, Math.round(exportHeight)),
        })
        const scaled = scalePayloadToExport(payload)
        if (typeof scaled.config.backgroundImageUrl === 'string') {
          scaled.config.backgroundImageUrl = toRuntimeAssetUrl(appUrl, scaled.config.backgroundImageUrl)
        }
        // Force each render to re-fetch product bitmap; avoids stale proxy/browser cache.
        const runtimeProductImageUrl = withCacheBust(
          toRuntimeAssetUrl(appUrl, input.productImageUrl),
          `${input.batchId}:${tpl.id}`,
        )
        await page.addInitScript((p) => {
          ;(window as Window & { __RENDER_PAYLOAD__?: unknown }).__RENDER_PAYLOAD__ = p
        }, { ...scaled, productImageUrl: runtimeProductImageUrl })

        const url = new URL('/render-runtime', appUrl)
        console.log(`[playwright:${tpl.name}] navigating to ${url.toString()} (appUrl=${appUrl})`)
        await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
        try {
          await page.waitForFunction(
            () => {
              const w = window as Window & {
                __RENDER_EXPORT_DATA_URL__?: string
                __RENDER_EXPORT_ERROR__?: string
              }
              return Boolean(w.__RENDER_EXPORT_DATA_URL__ || w.__RENDER_EXPORT_ERROR__)
            },
            undefined,
            { timeout: 45000 },
          )
        } catch (err) {
          console.log(`[playwright:${tpl.name}] waitForFunction timeout or error: ${err}`)
          try {
            const html = await page.content()
            console.log(`[playwright:${tpl.name}] page html snapshot length=${html.length}`)
          } catch (e) {
            console.log(`[playwright:${tpl.name}] failed to read page content: ${e}`)
          }
          throw err
        }
        const exportState = await page.evaluate(() => {
          const w = window as Window & {
            __RENDER_EXPORT_DATA_URL__?: string
            __RENDER_EXPORT_ERROR__?: string
          }
          return {
            dataUrl: w.__RENDER_EXPORT_DATA_URL__ ?? null,
            error: w.__RENDER_EXPORT_ERROR__ ?? null,
          }
        })
        if (exportState.error) {
          throw new Error(exportState.error)
        }
        const dataUrl = exportState.dataUrl
        if (!dataUrl || !dataUrl.startsWith('data:image/png;base64,')) {
          throw new Error('render export data url not found')
        }
        const png = Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64')
        await page.close()

        const key = buildObjectKey(input.batchId, tpl.order, tpl.id)
        const s3Url = await uploadPngToS3(key, png)
        results.push({ templateName: tpl.name, s3Url, error: null })
      } catch (error) {
        results.push({
          templateName: tpl.name,
          s3Url: null,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
    return results
  } finally {
    await context.close()
    await browser.close()
  }
}
