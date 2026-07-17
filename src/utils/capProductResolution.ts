import type { ProductQuad } from '../types/render'
import { getObjectCoverDestRect } from './objectCover'
import { getQuadBounds } from './roundedQuadClip'

/**
 * Caps product warp source resolution so sharpness matches the background scene.
 * When the canvas upscales a low-res background, a full-res product looks pasted-on.
 */
export function capProductWarpSourceSize(
  productNaturalW: number,
  productNaturalH: number,
  quad: ProductQuad,
  canvasW: number,
  canvasH: number,
  bgNaturalW: number,
  bgNaturalH: number,
): { width: number; height: number } {
  const pw = Math.max(1, Math.floor(productNaturalW))
  const ph = Math.max(1, Math.floor(productNaturalH))
  if (bgNaturalW <= 0 || bgNaturalH <= 0) {
    return { width: pw, height: ph }
  }

  const bounds = getQuadBounds(quad)
  const quadMax = Math.max(bounds.width, bounds.height, 1)
  const cover = getObjectCoverDestRect(canvasW, canvasH, bgNaturalW, bgNaturalH)
  const bgPxPerCanvasPx = bgNaturalW / Math.max(1, cover.dw)
  const maxUsefulDim = Math.max(64, quadMax * bgPxPerCanvasPx * 1.15)
  const productMax = Math.max(pw, ph)

  if (productMax <= maxUsefulDim) {
    return { width: pw, height: ph }
  }

  const scale = maxUsefulDim / productMax
  return {
    width: Math.max(64, Math.round(pw * scale)),
    height: Math.max(64, Math.round(ph * scale)),
  }
}
