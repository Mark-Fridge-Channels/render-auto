import type { Point } from '../types/render'

function distPointToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  if (len < 1e-9) return Math.hypot(p.x - a.x, p.y - a.y)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (len * len)))
  const px = a.x + t * dx
  const py = a.y + t * dy
  return Math.hypot(p.x - px, p.y - py)
}

/**
 * Ramer–Douglas–Peucker on an open polyline (does not duplicate the closing edge).
 */
export function simplifyPolyline(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2) return [...points]
  let dmax = 0
  let idx = 0
  for (let i = 1; i < points.length - 1; i++) {
    const d = distPointToSegment(points[i]!, points[0]!, points[points.length - 1]!)
    if (d > dmax) {
      idx = i
      dmax = d
    }
  }
  if (dmax > epsilon) {
    const left = simplifyPolyline(points.slice(0, idx + 1), epsilon)
    const right = simplifyPolyline(points.slice(idx), epsilon)
    return [...left.slice(0, -1), ...right]
  }
  return [points[0]!, points[points.length - 1]!]
}

/** Drop consecutive points closer than `minDist` (canvas pixels). */
export function dedupeConsecutive(points: Point[], minDist: number): Point[] {
  if (points.length === 0) return []
  const out: Point[] = [points[0]!]
  for (let i = 1; i < points.length; i++) {
    const p = points[i]!
    const last = out[out.length - 1]!
    if (Math.hypot(p.x - last.x, p.y - last.y) >= minDist) out.push(p)
  }
  return out
}

/** Signed area of a simple closed polygon (implicit close last→first). */
export function polygonArea(points: Point[]): number {
  if (points.length < 3) return 0
  let a = 0
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length
    a += points[i]!.x * points[j]!.y - points[j]!.x * points[i]!.y
  }
  return Math.abs(a * 0.5)
}
