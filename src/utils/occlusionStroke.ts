import type { Point } from '../types/render'
import {
  dedupeConsecutive,
  polygonArea,
  simplifyPolyline,
} from './polylineSimplify'

export function signedPolygonArea(points: Point[]): number {
  if (points.length < 3) return 0
  let a = 0
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length
    a += points[i]!.x * points[j]!.y - points[j]!.x * points[i]!.y
  }
  return a * 0.5
}

/** Offset a closed polygon along vertex bisector normals. Negative delta insets. */
export function offsetClosedPolygon(points: Point[], delta: number): Point[] {
  if (points.length < 3 || delta === 0) return [...points]
  const ccw = signedPolygonArea(points) > 0
  const sign = ccw ? 1 : -1
  const n = points.length
  return points.map((p, i) => {
    const prev = points[(i - 1 + n) % n]!
    const next = points[(i + 1) % n]!
    const dx1 = p.x - prev.x
    const dy1 = p.y - prev.y
    const dx2 = next.x - p.x
    const dy2 = next.y - p.y
    const len1 = Math.hypot(dx1, dy1) || 1
    const len2 = Math.hypot(dx2, dy2) || 1
    const n1x = (-dy1 / len1) * sign
    const n1y = (dx1 / len1) * sign
    const n2x = (-dy2 / len2) * sign
    const n2y = (dx2 / len2) * sign
    let nx = n1x + n2x
    let ny = n1y + n2y
    const nl = Math.hypot(nx, ny)
    if (nl < 1e-6) {
      nx = n1x
      ny = n1y
    } else {
      nx /= nl
      ny /= nl
    }
    const miter = 1 / Math.max(0.45, Math.abs(nx * n1x + ny * n1y))
    const scale = Math.min(miter, 2.2)
    return {
      x: p.x + nx * delta * scale,
      y: p.y + ny * delta * scale,
    }
  })
}

/** Chaikin corner-cutting for a closed polygon — rounds sharp vertices. */
function chaikinClosed(points: Point[], iterations: number): Point[] {
  if (points.length < 3) return [...points]
  let pts = [...points]
  for (let iter = 0; iter < iterations; iter++) {
    const next: Point[] = []
    const n = pts.length
    for (let i = 0; i < n; i++) {
      const p0 = pts[i]!
      const p1 = pts[(i + 1) % n]!
      next.push(
        { x: 0.75 * p0.x + 0.25 * p1.x, y: 0.75 * p0.y + 0.25 * p1.y },
        { x: 0.25 * p0.x + 0.75 * p1.x, y: 0.25 * p0.y + 0.75 * p1.y },
      )
    }
    pts = next
  }
  return pts
}

/** Expands a closed polygon along vertex bisector normals. */
export function expandClosedPolygon(points: Point[], delta: number): Point[] {
  return offsetClosedPolygon(points, delta)
}

function clampToCanvas(p: Point, w: number, h: number): Point {
  return {
    x: Math.min(w, Math.max(0, p.x)),
    y: Math.min(h, Math.max(0, p.y)),
  }
}

/**
 * Turn a raw freehand stroke into a smooth closed occlusion polygon.
 * Lighter simplification + Chaikin rounding + slight outward expand.
 */
export function finalizeOcclusionPolygon(
  raw: Point[],
  canvasW: number,
  canvasH: number,
): Point[] | null {
  let chain = dedupeConsecutive(raw, 1)
  if (chain.length >= 2) {
    const a = chain[0]!
    const b = chain[chain.length - 1]!
    if (Math.hypot(a.x - b.x, a.y - b.y) < 1) chain = chain.slice(0, -1)
  }
  if (chain.length < 3) return null

  const simplified = simplifyPolyline(chain, 1.2)
  if (simplified.length < 3) return null

  let smooth = chaikinClosed(simplified, 2)
  smooth = expandClosedPolygon(smooth, 1.5)
  smooth = smooth.map((p) => clampToCanvas(p, canvasW, canvasH))

  if (smooth.length < 3) return null
  if (polygonArea(smooth) < 0.75) return null
  return smooth
}

/** Draw a smooth closed curve through polygon vertices (quadratic mid-point technique). */
export function traceSmoothClosedPath(
  ctx: CanvasRenderingContext2D,
  points: Point[],
): void {
  const n = points.length
  if (n < 2) return
  if (n < 3) {
    ctx.beginPath()
    ctx.moveTo(points[0]!.x, points[0]!.y)
    ctx.lineTo(points[1]!.x, points[1]!.y)
    return
  }

  const mid = (a: Point, b: Point): Point => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  })

  const m0 = mid(points[n - 1]!, points[0]!)
  ctx.beginPath()
  ctx.moveTo(m0.x, m0.y)

  for (let i = 0; i < n; i++) {
    const cur = points[i]!
    const nxt = points[(i + 1) % n]!
    const m = mid(cur, nxt)
    ctx.quadraticCurveTo(cur.x, cur.y, m.x, m.y)
  }
  ctx.closePath()
}
