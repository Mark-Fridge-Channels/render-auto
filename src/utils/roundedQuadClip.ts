import type { Point, ProductQuad } from '../types/render'

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

function quadCentroid(q: ProductQuad): Point {
  const p = [...q] as Point[]
  return {
    x: (p[0]!.x + p[1]!.x + p[2]!.x + p[3]!.x) / 4,
    y: (p[0]!.y + p[1]!.y + p[2]!.y + p[3]!.y) / 4,
  }
}

function pointInConvexQuad(p: Point, quad: ProductQuad): boolean {
  const pts = [...quad] as Point[]
  let sign = 0
  for (let i = 0; i < 4; i++) {
    const a = pts[i]!
    const b = pts[(i + 1) % 4]!
    const cross =
      (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)
    if (Math.abs(cross) < 1e-9) continue
    const s = cross > 0 ? 1 : -1
    if (sign === 0) sign = s
    else if (s !== sign) return false
  }
  return true
}

type CornerGeom = {
  T1: Point
  T2: Point
  O: Point
  r: number
  sharp: boolean
  /** Start / end angles (rad) from `O` toward `T1` / `T2`. */
  a1: number
  a2: number
  /** `true` = Canvas `arc` 使用逆时针从 `a1` 扫到 `a2`。 */
  ccw: boolean
}

function arcSampleMidpoint(
  O: Point,
  r: number,
  a1: number,
  a2: number,
  ccw: boolean,
): Point {
  let d = a2 - a1
  if (ccw) {
    while (d < 0) d += 2 * Math.PI
    while (d >= 2 * Math.PI) d -= 2 * Math.PI
  } else {
    while (d > 0) d -= 2 * Math.PI
    while (d <= -2 * Math.PI) d += 2 * Math.PI
  }
  const m = a1 + d / 2
  return { x: O.x + r * Math.cos(m), y: O.y + r * Math.sin(m) }
}

function cornerGeometry(
  Pp: Point,
  V: Point,
  Pn: Point,
  rReq: number,
  centroid: Point,
  quad: ProductQuad,
): CornerGeom | null {
  const e1 = Math.hypot(V.x - Pp.x, V.y - Pp.y)
  const e2 = Math.hypot(Pn.x - V.x, Pn.y - V.y)
  if (e1 < 1e-6 || e2 < 1e-6) return null

  const w1 = { x: (Pp.x - V.x) / e1, y: (Pp.y - V.y) / e1 }
  const w2 = { x: (Pn.x - V.x) / e2, y: (Pn.y - V.y) / e2 }
  const c = clamp(w1.x * w2.x + w1.y * w2.y, -1, 1)
  const phi = Math.acos(c)
  if (phi < 1e-4 || Math.abs(phi - Math.PI) < 1e-4) {
    return {
      T1: { ...V },
      T2: { ...V },
      O: { ...V },
      r: 0,
      sharp: true,
      a1: 0,
      a2: 0,
      ccw: false,
    }
  }

  const tMax = Math.min(e1, e2) * 0.48
  const rMax = tMax * Math.tan(phi / 2)
  const r = Math.min(Math.max(0, rReq), rMax)
  if (r < 0.25) {
    return {
      T1: { ...V },
      T2: { ...V },
      O: { ...V },
      r: 0,
      sharp: true,
      a1: 0,
      a2: 0,
      ccw: false,
    }
  }

  const t = r / Math.tan(phi / 2)
  const T1 = { x: V.x + w1.x * t, y: V.y + w1.y * t }
  const T2 = { x: V.x + w2.x * t, y: V.y + w2.y * t }

  const bx = w1.x + w2.x
  const by = w1.y + w2.y
  const blen = Math.hypot(bx, by)
  if (blen < 1e-6) {
    return {
      T1: { ...V },
      T2: { ...V },
      O: { ...V },
      r: 0,
      sharp: true,
      a1: 0,
      a2: 0,
      ccw: false,
    }
  }

  const bis = { x: bx / blen, y: by / blen }
  const distOv = r / Math.sin(phi / 2)
  const O = { x: V.x + bis.x * distOv, y: V.y + bis.y * distOv }

  const a1 = Math.atan2(T1.y - O.y, T1.x - O.x)
  const a2 = Math.atan2(T2.y - O.y, T2.x - O.x)

  const midCCW = arcSampleMidpoint(O, r, a1, a2, true)
  const midCW = arcSampleMidpoint(O, r, a1, a2, false)
  const inCCW = pointInConvexQuad(midCCW, quad)
  const inCW = pointInConvexQuad(midCW, quad)

  let ccw: boolean
  if (inCCW && !inCW) ccw = true
  else if (!inCCW && inCW) ccw = false
  else {
    const cx = centroid.x
    const cy = centroid.y
    const dCCW = Math.hypot(midCCW.x - cx, midCCW.y - cy)
    const dCW = Math.hypot(midCW.x - cx, midCW.y - cy)
    ccw = dCCW <= dCW
  }

  return { T1, T2, O, r, sharp: false, a1, a2, ccw }
}

function strokeRoundCorner(
  ctx: CanvasRenderingContext2D,
  g: CornerGeom,
) {
  if (g.sharp) return

  const start = g.a1
  let end = g.a2
  if (g.ccw) {
    while (end < start) end += 2 * Math.PI
  } else {
    while (end > start) end -= 2 * Math.PI
  }
  ctx.arc(g.O.x, g.O.y, g.r, start, end, g.ccw)
}

/**
 * 在当前四角形下，各角能容纳的最大圆角半径（取四角最小值）。
 */
export function maxSafeCornerRadius(quad: ProductQuad): number {
  const pts = [...quad] as Point[]
  let minR = Infinity
  for (let i = 0; i < 4; i++) {
    const Pp = pts[(i + 3) % 4]!
    const V = pts[i]!
    const Pn = pts[(i + 1) % 4]!
    const e1 = Math.hypot(V.x - Pp.x, V.y - Pp.y)
    const e2 = Math.hypot(Pn.x - V.x, Pn.y - V.y)
    if (e1 < 1e-6 || e2 < 1e-6) continue
    const w1 = { x: (Pp.x - V.x) / e1, y: (Pp.y - V.y) / e1 }
    const w2 = { x: (Pn.x - V.x) / e2, y: (Pn.y - V.y) / e2 }
    const phi = Math.acos(clamp(w1.x * w2.x + w1.y * w2.y, -1, 1))
    if (phi < 1e-4 || Math.abs(phi - Math.PI) < 1e-4) continue
    const tMax = Math.min(e1, e2) * 0.48
    minR = Math.min(minR, tMax * Math.tan(phi / 2))
  }
  return Number.isFinite(minR) ? minR : 0
}

/**
 * 圆角凸四边形裁剪：拐角为真实圆弧，避免 `arcTo` 在透视四边形上自交导致整图被裁掉。
 */
export function applyRoundedQuadClip(
  ctx: CanvasRenderingContext2D,
  quad: ProductQuad,
  radius: number,
) {
  traceRoundedQuadPath(ctx, quad, radius)
  ctx.clip()
}

export function getQuadBounds(quad: ProductQuad): {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
} {
  const xs = quad.map((p) => p.x)
  const ys = quad.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  }
}

/**
 * Traces a rounded quad path without mutating clip state.
 */
export function traceRoundedQuadPath(
  ctx: CanvasRenderingContext2D,
  quad: ProductQuad,
  radius: number,
) {
  const pts = [...quad] as Point[]
  const centroid = quadCentroid(quad)
  const rIn = Math.max(0, radius)

  ctx.beginPath()

  if (rIn < 0.25) {
    ctx.moveTo(pts[0]!.x, pts[0]!.y)
    for (let i = 1; i < 4; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y)
    ctx.closePath()
    ctx.clip()
    return
  }

  const geoms: CornerGeom[] = []
  for (let i = 0; i < 4; i++) {
    const Pp = pts[(i + 3) % 4]!
    const V = pts[i]!
    const Pn = pts[(i + 1) % 4]!
    const g =
      cornerGeometry(Pp, V, Pn, rIn, centroid, quad) ??
      ({
        T1: { ...V },
        T2: { ...V },
        O: { ...V },
        r: 0,
        sharp: true,
        a1: 0,
        a2: 0,
        ccw: false,
      } satisfies CornerGeom)
    geoms.push(g)
  }

  ctx.moveTo(geoms[0]!.T1.x, geoms[0]!.T1.y)

  for (let i = 0; i < 4; i++) {
    const g = geoms[i]!
    const Pi = pts[i]!

    if (g.sharp) {
      ctx.lineTo(Pi.x, Pi.y)
    } else {
      strokeRoundCorner(ctx, g)
    }

    const ni = (i + 1) % 4
    const nextT1 = geoms[ni]!.T1
    ctx.lineTo(nextT1.x, nextT1.y)
  }

  ctx.closePath()
}
