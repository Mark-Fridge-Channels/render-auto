import type {
  PosterConfig,
  Point,
  ProductBrushShadow,
  ProductOcclusionMask,
  ProductQuad,
} from '../types/render'

function scalePoint(p: Point, sx: number, sy: number): Point {
  return { x: p.x * sx, y: p.y * sy }
}

export type ScaledPosterGeometry = {
  config: PosterConfig
  productQuad: ProductQuad | null
  productBrushShadow: ProductBrushShadow | null
  productOcclusionMask: ProductOcclusionMask | null
}

/** Scale all canvas-space geometry when canvas/export size changes. */
export function scalePosterGeometry(
  config: PosterConfig,
  productQuad: ProductQuad | null,
  productBrushShadow: ProductBrushShadow | null,
  productOcclusionMask: ProductOcclusionMask | null,
  newCanvasW: number,
  newCanvasH: number,
): ScaledPosterGeometry {
  const oldW = Math.max(1, config.canvas.width)
  const oldH = Math.max(1, config.canvas.height)
  const sx = newCanvasW / oldW
  const sy = newCanvasH / oldH
  const sAvg = (sx + sy) / 2

  const nextConfig: PosterConfig = {
    ...config,
    canvas: { width: newCanvasW, height: newCanvasH },
    export: { width: newCanvasW, height: newCanvasH },
    title: {
      ...config.title,
      x: config.title.x * sx,
      y: config.title.y * sy,
      width: config.title.width * sx,
      fontSize: config.title.fontSize * sy,
    },
    logo: {
      ...config.logo,
      x: config.logo.x * sx,
      y: config.logo.y * sy,
      width: config.logo.width * sx,
    },
    product: {
      ...config.product,
      cornerRadius: config.product.cornerRadius * sAvg,
      quadInnerShadowBlur:
        (config.product.quadInnerShadowBlur ?? 14) * sAvg,
    },
    decorFrame: {
      ...config.decorFrame,
      width: config.decorFrame.width * sx,
      height: config.decorFrame.height * sy,
      cornerRadius: config.decorFrame.cornerRadius * sAvg,
      borderWidth: config.decorFrame.borderWidth * sAvg,
    },
  }

  const nextQuad = productQuad
    ? (productQuad.map((p) => scalePoint(p, sx, sy)) as unknown as ProductQuad)
    : null

  const nextBrush = productBrushShadow
    ? {
        ...productBrushShadow,
        points: productBrushShadow.points.map((p) => scalePoint(p, sx, sy)),
        blur: productBrushShadow.blur * sAvg,
        offsetX: productBrushShadow.offsetX * sx,
        offsetY: productBrushShadow.offsetY * sy,
      }
    : null

  const nextOcclusion = productOcclusionMask
    ? {
        ...productOcclusionMask,
        feather: (productOcclusionMask.feather ?? 2) * sAvg,
        edgeInset: (productOcclusionMask.edgeInset ?? 1.5) * sAvg,
        contactShadowSpread:
          (productOcclusionMask.contactShadowSpread ?? 5) * sAvg,
        regions: productOcclusionMask.regions.map((r) => ({
          points: r.points.map((p) => scalePoint(p, sx, sy)),
        })),
      }
    : null

  return {
    config: nextConfig,
    productQuad: nextQuad,
    productBrushShadow: nextBrush,
    productOcclusionMask: nextOcclusion,
  }
}
