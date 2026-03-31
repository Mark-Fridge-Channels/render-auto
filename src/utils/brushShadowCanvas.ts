import type { Point, ProductBrushShadow } from '../types/render'

/**
 * Map UI color + opacity into an `rgba(...)` string for Canvas shadows/strokes.
 */
export function shadowRgba(color: string, opacity: number): string {
  const t = color.trim()
  const m = /^#?([0-9a-f]{6})$/i.exec(t)
  if (m) {
    const n = parseInt(m[1]!, 16)
    const r = (n >> 16) & 255
    const g = (n >> 8) & 255
    const b = n & 255
    return `rgba(${r},${g},${b},${opacity})`
  }
  return `rgba(0,0,0,${opacity})`
}

export function traceClosedPolygonPath(
  ctx: CanvasRenderingContext2D,
  points: Point[],
): void {
  if (points.length < 2) return
  ctx.beginPath()
  ctx.moveTo(points[0]!.x, points[0]!.y)
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i]!.x, points[i]!.y)
  ctx.closePath()
}

/**
 * Local shadow inside the existing product rounded-quad clip.
 * Call only while `applyRoundedQuadClip` is active on `ctx`.
 */
export function drawBrushShadowInClip(
  ctx: CanvasRenderingContext2D,
  brush: ProductBrushShadow,
): void {
  if (!brush.points || brush.points.length < 3) return

  const { mode, blur, opacity, offsetX, offsetY, color } = brush
  const alpha = Math.min(1, Math.max(0, opacity))

  if (mode === 'outer') {
    /**
     * Shadow strength is multiplied by fill alpha in browsers; ~0.02 alpha fill
     * makes `shadowOpacity` almost invisible. Use an opaque offscreen fill to
     * generate the drop shadow, then `destination-out` the solid interior so only
     * the outer halo composites onto the product (still under the active quad clip).
     */
    const w = ctx.canvas.width
    const h = ctx.canvas.height
    const layer = document.createElement('canvas')
    layer.width = w
    layer.height = h
    const lctx = layer.getContext('2d')
    if (!lctx) return

    lctx.clearRect(0, 0, w, h)
    lctx.fillStyle = '#000000'
    lctx.shadowColor = shadowRgba(color, alpha)
    lctx.shadowBlur = Math.max(0, blur)
    lctx.shadowOffsetX = offsetX
    lctx.shadowOffsetY = offsetY
    traceClosedPolygonPath(lctx, brush.points)
    lctx.fill()

    lctx.shadowBlur = 0
    lctx.shadowOffsetX = 0
    lctx.shadowOffsetY = 0
    lctx.globalCompositeOperation = 'destination-out'
    lctx.fillStyle = '#000000'
    traceClosedPolygonPath(lctx, brush.points)
    lctx.fill()

    ctx.save()
    ctx.globalCompositeOperation = 'source-over'
    ctx.drawImage(layer, 0, 0)
    ctx.restore()
    return
  }

  /**
   * Inner: within the drawn region, effect is **fainter at the boundary** and ramps
   * inward (distance from edge). Implemented by blurring a solid mask so alpha is low
   * near the perimeter and high in the interior, then using it to modulate a tint.
   */
  const w = ctx.canvas.width
  const h = ctx.canvas.height
  const feather = Math.max(0, blur)

  const sharp = document.createElement('canvas')
  sharp.width = w
  sharp.height = h
  const sctx = sharp.getContext('2d')
  if (!sctx) return

  sctx.clearRect(0, 0, w, h)
  sctx.fillStyle = '#ffffff'
  traceClosedPolygonPath(sctx, brush.points)
  sctx.fill()

  const blurry = document.createElement('canvas')
  blurry.width = w
  blurry.height = h
  const bctx = blurry.getContext('2d')
  if (!bctx) return

  bctx.clearRect(0, 0, w, h)
  if (feather > 0) {
    bctx.filter = `blur(${feather}px)`
  }
  bctx.drawImage(sharp, 0, 0)
  bctx.filter = 'none'

  const shade = document.createElement('canvas')
  shade.width = w
  shade.height = h
  const shctx = shade.getContext('2d')
  if (!shctx) return

  shctx.clearRect(0, 0, w, h)
  shctx.fillStyle = shadowRgba(color, alpha)
  shctx.fillRect(0, 0, w, h)
  shctx.globalCompositeOperation = 'destination-in'
  shctx.drawImage(blurry, 0, 0)

  ctx.save()
  traceClosedPolygonPath(ctx, brush.points)
  ctx.clip()
  ctx.globalCompositeOperation = 'source-over'
  ctx.drawImage(shade, 0, 0)
  ctx.restore()
}
