import type { ProductQuad } from '../types/render'
import { traceRoundedQuadPath } from './roundedQuadClip'

/**
 * Inset shadow along the rounded product quad: half the stroke survives the active
 * clip, darkening the interior near the boundary. Stacks with `source-over` on top
 * of the warped bitmap and any hand-drawn brush shadow layers.
 */
export function drawQuadInnerShadowRim(
  ctx: CanvasRenderingContext2D,
  quad: ProductQuad,
  rEff: number,
  opacity: number,
  blur: number,
): void {
  const a = Math.min(1, Math.max(0, opacity))
  if (a <= 0) return

  const lineWidth = Math.max(1, blur * 2)
  ctx.globalCompositeOperation = 'source-over'
  traceRoundedQuadPath(ctx, quad, rEff)
  ctx.strokeStyle = `rgba(0,0,0,${a})`
  ctx.lineWidth = lineWidth
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  traceRoundedQuadPath(ctx, quad, rEff)
  ctx.stroke()
}
