import type { Point, ProductQuad } from '../types/render'
import { affineFromTriangles } from './affine'

/** Grid density baseline — actual value adapts by quad area. */
const GRID_SEGMENTS_BASE = 28
const GRID_SEGMENTS_MIN = 24
const GRID_SEGMENTS_MAX = 80
const GRID_TARGET_CELL_PX = 20
/**
 * Anti-seam overdraw in destination pixels.
 * Small clip inflation makes neighboring triangles overlap and removes visible grid lines.
 */
const TRIANGLE_OVERDRAW_PX_MAX = 0.2

function bilinearPoint(
  tl: Point,
  tr: Point,
  br: Point,
  bl: Point,
  u: number,
  v: number,
): Point {
  const top = { x: tl.x + (tr.x - tl.x) * u, y: tl.y + (tr.y - tl.y) * u }
  const bottom = { x: bl.x + (br.x - bl.x) * u, y: bl.y + (br.y - bl.y) * u }
  return {
    x: top.x + (bottom.x - top.x) * v,
    y: top.y + (bottom.y - top.y) * v,
  }
}

function drawTriangleMapping(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  s0: Point,
  s1: Point,
  s2: Point,
  d0: Point,
  d1: Point,
  d2: Point,
  overdrawPx: number,
) {
  let a: number
  let b: number
  let c: number
  let d: number
  let e: number
  let f: number
  try {
    ;[a, c, e, b, d, f] = affineFromTriangles(s0, s1, s2, d0, d1, d2)
  } catch {
    return
  }

  const [c0, c1, c2] = inflateTriangle(d0, d1, d2, overdrawPx)

  ctx.save()
  ctx.beginPath()
  ctx.moveTo(c0.x, c0.y)
  ctx.lineTo(c1.x, c1.y)
  ctx.lineTo(c2.x, c2.y)
  ctx.closePath()
  ctx.clip()
  ctx.setTransform(a, b, c, d, e, f)
  ctx.drawImage(img, 0, 0)
  ctx.restore()
}

function triangleMinEdgeLength(p0: Point, p1: Point, p2: Point): number {
  const e0 = Math.hypot(p0.x - p1.x, p0.y - p1.y)
  const e1 = Math.hypot(p1.x - p2.x, p1.y - p2.y)
  const e2 = Math.hypot(p2.x - p0.x, p2.y - p0.y)
  return Math.min(e0, e1, e2)
}

function quadArea(tl: Point, tr: Point, br: Point, bl: Point): number {
  const a1 = Math.abs((tr.x - tl.x) * (bl.y - tl.y) - (tr.y - tl.y) * (bl.x - tl.x)) * 0.5
  const a2 = Math.abs((tr.x - br.x) * (bl.y - br.y) - (tr.y - br.y) * (bl.x - br.x)) * 0.5
  return a1 + a2
}

function inflateTriangle(p0: Point, p1: Point, p2: Point, amount: number): [Point, Point, Point] {
  const cx = (p0.x + p1.x + p2.x) / 3
  const cy = (p0.y + p1.y + p2.y) / 3
  const push = (p: Point): Point => {
    const dx = p.x - cx
    const dy = p.y - cy
    const len = Math.hypot(dx, dy)
    if (len < 1e-6) return p
    const k = amount / len
    return { x: p.x + dx * k, y: p.y + dy * k }
  }
  return [push(p0), push(p1), push(p2)]
}

/**
 * Approximates a perspective warp by tessellating the UV square into affine triangles.
 * quad order: top-left, top-right, bottom-right, bottom-left.
 */
export function drawWarpedImageInQuad(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  imageWidth: number,
  imageHeight: number,
  quad: ProductQuad,
) {
  const [tl, tr, br, bl] = quad
  const area = Math.max(1, quadArea(tl, tr, br, bl))
  const nByArea = Math.round(Math.sqrt(area) / GRID_TARGET_CELL_PX)
  const n = Math.max(
    GRID_SEGMENTS_MIN,
    Math.min(GRID_SEGMENTS_MAX, Math.max(GRID_SEGMENTS_BASE, nByArea)),
  )

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const u0 = i / n
      const u1 = (i + 1) / n
      const v0 = j / n
      const v1 = (j + 1) / n

      const s00 = { x: u0 * imageWidth, y: v0 * imageHeight }
      const s10 = { x: u1 * imageWidth, y: v0 * imageHeight }
      const s11 = { x: u1 * imageWidth, y: v1 * imageHeight }
      const s01 = { x: u0 * imageWidth, y: v1 * imageHeight }

      const d00 = bilinearPoint(tl, tr, br, bl, u0, v0)
      const d10 = bilinearPoint(tl, tr, br, bl, u1, v0)
      const d11 = bilinearPoint(tl, tr, br, bl, u1, v1)
      const d01 = bilinearPoint(tl, tr, br, bl, u0, v1)

      const minEdgeA = triangleMinEdgeLength(d00, d10, d11)
      const minEdgeB = triangleMinEdgeLength(d00, d11, d01)
      const overdrawA = Math.min(TRIANGLE_OVERDRAW_PX_MAX, minEdgeA * 0.04)
      const overdrawB = Math.min(TRIANGLE_OVERDRAW_PX_MAX, minEdgeB * 0.04)

      drawTriangleMapping(ctx, img, s00, s10, s11, d00, d10, d11, overdrawA)
      drawTriangleMapping(ctx, img, s00, s11, s01, d00, d11, d01, overdrawB)
    }
  }
}
