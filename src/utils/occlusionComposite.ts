import type { Point, ProductOcclusionMask } from '../types/render'
import { drawImageObjectCover } from './objectCover'
import { offsetClosedPolygon, traceSmoothClosedPath } from './occlusionStroke'

export type OcclusionCompositeOptions = {
  feather: number
  edgeInset: number
  contactShadowSpread: number
  contactShadowOpacity: number
}

const DEFAULTS: OcclusionCompositeOptions = {
  feather: 2,
  edgeInset: 1.5,
  contactShadowSpread: 5,
  contactShadowOpacity: 0.22,
}

export function resolveOcclusionOptions(
  mask: ProductOcclusionMask,
): OcclusionCompositeOptions {
  return {
    feather: Math.max(0, mask.feather ?? DEFAULTS.feather),
    edgeInset: Math.max(0, mask.edgeInset ?? DEFAULTS.edgeInset),
    contactShadowSpread: Math.max(
      0,
      mask.contactShadowSpread ?? DEFAULTS.contactShadowSpread,
    ),
    contactShadowOpacity: Math.min(
      1,
      Math.max(0, mask.contactShadowOpacity ?? DEFAULTS.contactShadowOpacity),
    ),
  }
}

function fillSmoothMask(
  width: number,
  height: number,
  points: Point[],
  feather: number,
): HTMLCanvasElement | null {
  if (points.length < 3) return null

  const hard = document.createElement('canvas')
  hard.width = width
  hard.height = height
  const hctx = hard.getContext('2d')
  if (!hctx) return null

  traceSmoothClosedPath(hctx, points)
  hctx.fillStyle = '#ffffff'
  hctx.fill()

  const f = Math.max(0, feather)
  if (f <= 0) return hard

  const soft = document.createElement('canvas')
  soft.width = width
  soft.height = height
  const sctx = soft.getContext('2d')
  if (!sctx) return hard

  sctx.filter = `blur(${f}px)`
  sctx.drawImage(hard, 0, 0)
  sctx.filter = 'none'
  return soft
}

/** Ring mask = expanded outer shell minus inner core (for contact shadow). */
function buildContactRingMask(
  width: number,
  height: number,
  points: Point[],
  spread: number,
  feather: number,
  edgeInset: number,
): HTMLCanvasElement | null {
  if (points.length < 3 || spread <= 0) return null

  const outer = offsetClosedPolygon(points, spread)
  const outerMask = fillSmoothMask(width, height, outer, feather)
  if (!outerMask) return null

  const corePts =
    edgeInset > 0 ? offsetClosedPolygon(points, -edgeInset) : points
  const coreMask = fillSmoothMask(width, height, corePts, Math.max(0, feather * 0.5))
  if (!coreMask) return outerMask

  const ring = document.createElement('canvas')
  ring.width = width
  ring.height = height
  const rctx = ring.getContext('2d')
  if (!rctx) return outerMask

  rctx.drawImage(outerMask, 0, 0)
  rctx.globalCompositeOperation = 'destination-out'
  rctx.drawImage(coreMask, 0, 0)
  rctx.globalCompositeOperation = 'source-over'
  return ring
}

function drawContactShadow(
  ctx: CanvasRenderingContext2D,
  ringMask: HTMLCanvasElement,
  opacity: number,
): void {
  if (opacity <= 0) return
  const { width, height } = ctx.canvas
  const layer = document.createElement('canvas')
  layer.width = width
  layer.height = height
  const lctx = layer.getContext('2d')
  if (!lctx) return

  lctx.fillStyle = '#000000'
  lctx.fillRect(0, 0, width, height)
  lctx.globalCompositeOperation = 'destination-in'
  lctx.drawImage(ringMask, 0, 0)

  ctx.save()
  ctx.globalAlpha = opacity
  ctx.globalCompositeOperation = 'source-over'
  ctx.drawImage(layer, 0, 0)
  ctx.restore()
}

/**
 * Feathered restore: alpha blends with product below at edges (defringe via compositing).
 */
function drawFeatheredRestore(
  ctx: CanvasRenderingContext2D,
  background: CanvasImageSource,
  imageWidth: number,
  imageHeight: number,
  points: Point[],
  feather: number,
  edgeInset: number,
  productUnderlay: CanvasImageSource | null,
): void {
  const { width, height } = ctx.canvas
  const corePts =
    edgeInset > 0 ? offsetClosedPolygon(points, -edgeInset) : points
  const alphaMask = fillSmoothMask(width, height, corePts, feather)
  if (!alphaMask) return

  const restored = document.createElement('canvas')
  restored.width = width
  restored.height = height
  const rctx = restored.getContext('2d')
  if (!rctx) return

  drawImageObjectCover(rctx, background, imageWidth, imageHeight, width, height)
  rctx.globalCompositeOperation = 'destination-in'
  rctx.drawImage(alphaMask, 0, 0)

  if (productUnderlay && feather > 0) {
    const blended = document.createElement('canvas')
    blended.width = width
    blended.height = height
    const bctx = blended.getContext('2d')
    if (bctx) {
      bctx.drawImage(productUnderlay, 0, 0, width, height)
      bctx.drawImage(restored, 0, 0)
      ctx.drawImage(blended, 0, 0)
      return
    }
  }

  ctx.drawImage(restored, 0, 0)
}

/**
 * Contact shadow on the product layer, then feather-blended foreground restore.
 */
export function drawOcclusionComposite(
  ctx: CanvasRenderingContext2D,
  background: CanvasImageSource,
  imageWidth: number,
  imageHeight: number,
  mask: ProductOcclusionMask,
  productUnderlay: CanvasImageSource | null,
): void {
  const opts = resolveOcclusionOptions(mask)

  for (const region of mask.regions) {
    const pts = region.points
    if (!pts || pts.length < 3) continue

    const ring = buildContactRingMask(
      ctx.canvas.width,
      ctx.canvas.height,
      pts,
      opts.contactShadowSpread,
      opts.feather,
      opts.edgeInset,
    )
    if (ring) drawContactShadow(ctx, ring, opts.contactShadowOpacity)

    drawFeatheredRestore(
      ctx,
      background,
      imageWidth,
      imageHeight,
      pts,
      opts.feather,
      opts.edgeInset,
      productUnderlay,
    )
  }
}

/** @deprecated Use drawOcclusionComposite */
export function drawOcclusionRestore(
  ctx: CanvasRenderingContext2D,
  background: CanvasImageSource,
  imageWidth: number,
  imageHeight: number,
  mask: ProductOcclusionMask,
): void {
  drawOcclusionComposite(ctx, background, imageWidth, imageHeight, mask, null)
}
