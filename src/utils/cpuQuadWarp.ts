import type { Point, ProductQuad } from '../types/render'

type Mat3 = [number, number, number, number, number, number, number, number, number]

function solveLinearSystem8(a: number[][], b: number[]): number[] | null {
  const n = 8
  const m = a.map((row, i) => [...row, b[i]])
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r
    }
    if (Math.abs(m[pivot][col]) < 1e-12) return null
    if (pivot !== col) {
      const t = m[col]
      m[col] = m[pivot]
      m[pivot] = t
    }
    const div = m[col][col]
    for (let c = col; c <= n; c++) m[col][c] /= div
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const factor = m[r][col]
      for (let c = col; c <= n; c++) m[r][c] -= factor * m[col][c]
    }
  }
  return m.map((row) => row[n])
}

function homographyFrom4Points(src: Point[], dst: Point[]): Mat3 | null {
  const a: number[][] = []
  const b: number[] = []
  for (let i = 0; i < 4; i++) {
    const x = src[i].x
    const y = src[i].y
    const X = dst[i].x
    const Y = dst[i].y
    a.push([x, y, 1, 0, 0, 0, -x * X, -y * X])
    b.push(X)
    a.push([0, 0, 0, x, y, 1, -x * Y, -y * Y])
    b.push(Y)
  }
  const h = solveLinearSystem8(a, b)
  if (!h) return null
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1]
}

function invertMat3(m: Mat3): Mat3 | null {
  const [a, b, c, d, e, f, g, h, i] = m
  const A = e * i - f * h
  const B = -(d * i - f * g)
  const C = d * h - e * g
  const D = -(b * i - c * h)
  const E = a * i - c * g
  const F = -(a * h - b * g)
  const G = b * f - c * e
  const H = -(a * f - c * d)
  const I = a * e - b * d
  const det = a * A + b * B + c * C
  if (Math.abs(det) < 1e-12) return null
  const k = 1 / det
  return [A * k, D * k, G * k, B * k, E * k, H * k, C * k, F * k, I * k]
}

function edgeSign(p1: Point, p2: Point, p3: Point): number {
  return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y)
}

function inTriangle(p: Point, a: Point, b: Point, c: Point): boolean {
  const d1 = edgeSign(p, a, b)
  const d2 = edgeSign(p, b, c)
  const d3 = edgeSign(p, c, a)
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0
  return !(hasNeg && hasPos)
}

function inQuad(p: Point, q: ProductQuad): boolean {
  return inTriangle(p, q[0], q[1], q[2]) || inTriangle(p, q[0], q[2], q[3])
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

function sampleBilinear(src: Uint8ClampedArray, sw: number, sh: number, x: number, y: number): [number, number, number, number] {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.min(sw - 1, x0 + 1)
  const y1 = Math.min(sh - 1, y0 + 1)
  const fx = x - x0
  const fy = y - y0

  const i00 = (y0 * sw + x0) * 4
  const i10 = (y0 * sw + x1) * 4
  const i01 = (y1 * sw + x0) * 4
  const i11 = (y1 * sw + x1) * 4

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t
  const c0r = lerp(src[i00], src[i10], fx)
  const c0g = lerp(src[i00 + 1], src[i10 + 1], fx)
  const c0b = lerp(src[i00 + 2], src[i10 + 2], fx)
  const c0a = lerp(src[i00 + 3], src[i10 + 3], fx)
  const c1r = lerp(src[i01], src[i11], fx)
  const c1g = lerp(src[i01 + 1], src[i11 + 1], fx)
  const c1b = lerp(src[i01 + 2], src[i11 + 2], fx)
  const c1a = lerp(src[i01 + 3], src[i11 + 3], fx)

  return [
    lerp(c0r, c1r, fy),
    lerp(c0g, c1g, fy),
    lerp(c0b, c1b, fy),
    lerp(c0a, c1a, fy),
  ]
}

/**
 * CPU single-pass perspective warp (inverse homography + bilinear sampling).
 * Used as a robust no-mesh fallback when WebGL is unavailable.
 */
export function renderWarpedImageInQuadCpu(
  img: CanvasImageSource,
  srcWidth: number,
  srcHeight: number,
  outWidth: number,
  outHeight: number,
  quad: ProductQuad,
): HTMLCanvasElement | null {
  const sw = Math.max(1, Math.floor(srcWidth))
  const sh = Math.max(1, Math.floor(srcHeight))
  if (!Number.isFinite(sw) || !Number.isFinite(sh)) return null

  const srcCanvas = document.createElement('canvas')
  srcCanvas.width = sw
  srcCanvas.height = sh
  const sctx = srcCanvas.getContext('2d', { willReadFrequently: true })
  if (!sctx) return null
  sctx.clearRect(0, 0, sw, sh)
  sctx.drawImage(img, 0, 0, sw, sh)
  const srcData = sctx.getImageData(0, 0, sw, sh).data

  const srcPts: Point[] = [
    { x: 0, y: 0 },
    { x: sw - 1, y: 0 },
    { x: sw - 1, y: sh - 1 },
    { x: 0, y: sh - 1 },
  ]
  const dstPts: Point[] = [quad[0], quad[1], quad[2], quad[3]]
  const h = homographyFrom4Points(srcPts, dstPts)
  if (!h) return null
  const hInv = invertMat3(h)
  if (!hInv) return null

  const minX = clamp(Math.floor(Math.min(...quad.map((p) => p.x))), 0, outWidth - 1)
  const maxX = clamp(Math.ceil(Math.max(...quad.map((p) => p.x))), 0, outWidth - 1)
  const minY = clamp(Math.floor(Math.min(...quad.map((p) => p.y))), 0, outHeight - 1)
  const maxY = clamp(Math.ceil(Math.max(...quad.map((p) => p.y))), 0, outHeight - 1)
  const bw = maxX - minX + 1
  const bh = maxY - minY + 1
  if (bw <= 0 || bh <= 0) return null

  const outCanvas = document.createElement('canvas')
  outCanvas.width = outWidth
  outCanvas.height = outHeight
  const octx = outCanvas.getContext('2d')
  if (!octx) return null
  const out = octx.createImageData(bw, bh)
  const d = out.data

  for (let yy = 0; yy < bh; yy++) {
    const y = minY + yy + 0.5
    for (let xx = 0; xx < bw; xx++) {
      const x = minX + xx + 0.5
      const p = { x, y }
      if (!inQuad(p, quad)) continue

      const sxh = hInv[0] * x + hInv[1] * y + hInv[2]
      const syh = hInv[3] * x + hInv[4] * y + hInv[5]
      const swh = hInv[6] * x + hInv[7] * y + hInv[8]
      if (Math.abs(swh) < 1e-8) continue
      const sx = sxh / swh
      const sy = syh / swh
      if (sx < 0 || sy < 0 || sx > sw - 1 || sy > sh - 1) continue

      const [r, g, b, a] = sampleBilinear(srcData, sw, sh, sx, sy)
      const di = (yy * bw + xx) * 4
      d[di] = r
      d[di + 1] = g
      d[di + 2] = b
      d[di + 3] = a
    }
  }

  octx.putImageData(out, minX, minY)
  return outCanvas
}
