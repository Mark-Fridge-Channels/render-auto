import { useEffect, useRef } from 'react'
import type { ProductBrushShadow, ProductQuad } from '../types/render'
import { drawBrushShadowInClip } from '../utils/brushShadowCanvas'
import {
  applyRoundedQuadClip,
  getQuadBounds,
  maxSafeCornerRadius,
  traceRoundedQuadPath,
} from '../utils/roundedQuadClip'
import { renderWarpedImageInQuadCpu } from '../utils/cpuQuadWarp'
import { drawQuadInnerShadowRim } from '../utils/quadInnerShadow'
import { drawWarpedImageInQuad } from '../utils/quadWarp'

type Props = {
  width: number
  height: number
  imageUrl: string | null
  quad: ProductQuad | null
  /** Corner fillet radius in canvas pixels (clamped to the quad geometry). */
  cornerRadius: number
  /** Realism pass toggle (shadow, light, subtle shear, tone/noise). */
  realismEnabled: boolean
  /** Realism intensity (0-100). */
  realismStrength: number
  /** Local shadow inside the product quad; `null` skips. */
  brushShadow: ProductBrushShadow | null
  quadInnerShadowEnabled: boolean
  quadInnerShadowOpacity: number
  quadInnerShadowBlur: number
}

let noiseTexture: HTMLCanvasElement | null = null

function getNoiseTexture(): HTMLCanvasElement {
  if (noiseTexture) return noiseTexture
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const cctx = c.getContext('2d')
  if (!cctx) return c

  const img = cctx.createImageData(c.width, c.height)
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(Math.random() * 255)
    img.data[i] = v
    img.data[i + 1] = v
    img.data[i + 2] = v
    img.data[i + 3] = 255
  }
  cctx.putImageData(img, 0, 0)
  noiseTexture = c
  return c
}

/**
 * Renders the warped product bitmap into a transparent canvas layer between background and typography.
 * Rounded fillets are applied by clipping a tessellated offscreen render against a rounded polygon.
 */
export function ProductWarpCanvas({
  width,
  height,
  imageUrl,
  quad,
  cornerRadius,
  realismEnabled,
  realismStrength,
  brushShadow,
  quadInnerShadowEnabled,
  quadInnerShadowOpacity,
  quadInnerShadowBlur,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.dataset.productReady = 'false'

    ctx.clearRect(0, 0, width, height)
    if (!imageUrl || !quad) {
      canvas.dataset.productReady = 'true'
      return
    }

    const img = new Image()
    img.decoding = 'async'
    img.src = imageUrl

    let cancelled = false
    img.onload = () => {
      if (cancelled) return

      const off = document.createElement('canvas')
      off.width = width
      off.height = height
      const octx = off.getContext('2d')
      if (!octx) return

      octx.clearRect(0, 0, width, height)
      octx.imageSmoothingEnabled = true
      octx.imageSmoothingQuality = 'high'
      const warpedNoMesh =
        renderWarpedImageInQuadCpu(
          img,
          img.naturalWidth,
          img.naturalHeight,
          width,
          height,
          quad,
        )
      if (warpedNoMesh) {
        octx.drawImage(warpedNoMesh, 0, 0)
      } else {
        // Last-resort fallback: keep rendering possible even if both no-mesh paths fail.
        drawWarpedImageInQuad(
          octx,
          img,
          img.naturalWidth,
          img.naturalHeight,
          quad,
        )
      }

      ctx.clearRect(0, 0, width, height)
      const rEff = Math.min(cornerRadius, maxSafeCornerRadius(quad))
      const bounds = getQuadBounds(quad)

      const k = Math.min(1, Math.max(0, realismStrength / 100))
      const kShadow = 0.35 + 0.65 * k
      const kOverlay = 0.3 + 0.7 * k
      const kNoise = 0.2 + 0.8 * k

      if (realismEnabled) {
        // Contact shadow: the thin dark ring where the sticker touches the surface.
        ctx.save()
        traceRoundedQuadPath(ctx, quad, rEff)
        ctx.shadowColor = `rgba(0,0,0,${(0.25 * kShadow).toFixed(3)})`
        ctx.shadowBlur = 2 + 6 * k
        ctx.shadowOffsetX = 0
        ctx.shadowOffsetY = 0.5 + 1.5 * k
        ctx.fillStyle = 'rgba(0,0,0,0.01)'
        ctx.fill()
        ctx.restore()

        // Main cast shadow: softer, directional (light from right side).
        ctx.save()
        traceRoundedQuadPath(ctx, quad, rEff)
        ctx.shadowColor = `rgba(0,0,0,${(0.18 * kShadow).toFixed(3)})`
        ctx.shadowBlur = 5 + 15 * k
        ctx.shadowOffsetX = -2 - 4 * k
        ctx.shadowOffsetY = 2 + 4 * k
        ctx.fillStyle = 'rgba(0,0,0,0.01)'
        ctx.fill()
        ctx.restore()
      }

      ctx.save()
      applyRoundedQuadClip(ctx, quad, rEff)

      if (realismEnabled) {
        // Slight micro-shear to mimic non-perfectly-flat placement.
        const cx = bounds.minX + bounds.width / 2
        const cy = bounds.minY + bounds.height / 2
        ctx.translate(cx, cy)
        const s = 0.004 + 0.016 * k
        ctx.transform(1, s, -s, 1, 0, 0)
        ctx.translate(-cx, -cy)
        const brightness = 1 - 0.05 * k
        const contrast = 1 + 0.05 * k
        const saturate = 1 - 0.1 * k
        const blur = 0.05 + 0.25 * k
        ctx.filter = `brightness(${brightness.toFixed(3)}) contrast(${contrast.toFixed(3)}) saturate(${saturate.toFixed(3)}) blur(${blur.toFixed(3)}px)`
      }

      ctx.drawImage(off, 0, 0)

      if (realismEnabled) {
        // Directional light overlay (white -> dark) for surface depth.
        const gradient = ctx.createLinearGradient(
          bounds.minX,
          bounds.minY,
          bounds.maxX,
          bounds.maxY,
        )
        gradient.addColorStop(0, `rgba(255,255,255,${(0.15 * kOverlay).toFixed(3)})`)
        gradient.addColorStop(1, `rgba(0,0,0,${(0.15 * kOverlay).toFixed(3)})`)
        ctx.globalCompositeOperation = 'overlay'
        ctx.fillStyle = gradient
        ctx.fillRect(bounds.minX, bounds.minY, bounds.width, bounds.height)

        // Subtle film grain to avoid too-clean digital look.
        ctx.globalCompositeOperation = 'source-over'
        ctx.globalAlpha = 0.01 + 0.04 * kNoise
        ctx.drawImage(
          getNoiseTexture(),
          bounds.minX,
          bounds.minY,
          bounds.width,
          bounds.height,
        )
        ctx.globalAlpha = 1
      }

      // Whole-quad inset shadow first, then hand-drawn brush — both darken with source-over.
      if (quadInnerShadowEnabled && quadInnerShadowOpacity > 0) {
        ctx.filter = 'none'
        drawQuadInnerShadowRim(
          ctx,
          quad,
          rEff,
          quadInnerShadowOpacity,
          quadInnerShadowBlur,
        )
      }

      if (brushShadow) {
        // Realism `filter` would soften the hand-authored shadow; keep brush crisp to param.
        ctx.filter = 'none'
        drawBrushShadowInClip(ctx, brushShadow)
      }

      if (realismEnabled) {
        // Thin highlight edge for coated/plastic reflection cue.
        traceRoundedQuadPath(ctx, quad, rEff)
        ctx.strokeStyle = `rgba(255,255,255,${(0.08 + 0.12 * k).toFixed(3)})`
        ctx.lineWidth = 0.8 + 0.4 * k
        ctx.stroke()
      }

      ctx.restore()
      canvas.dataset.productReady = 'true'
    }
    img.onerror = () => {
      if (cancelled) return
      canvas.dataset.productReady = 'true'
    }

    return () => {
      cancelled = true
    }
  }, [
    imageUrl,
    quad,
    width,
    height,
    cornerRadius,
    realismEnabled,
    realismStrength,
    brushShadow,
    quadInnerShadowEnabled,
    quadInnerShadowOpacity,
    quadInnerShadowBlur,
  ])

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      className="pointer-events-none absolute inset-0 z-20"
      aria-hidden
    />
  )
}
