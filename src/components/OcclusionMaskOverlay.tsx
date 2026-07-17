import { useEffect, useRef } from 'react'
import type { Point, ProductOcclusionRegion } from '../types/render'
import { traceSmoothClosedPath } from '../utils/occlusionStroke'

type Props = {
  width: number
  height: number
  /** Interactive drawing mode. */
  active: boolean
  draftPoints: Point[]
  committedRegions: ProductOcclusionRegion[]
  onAppendPoint: (p: Point) => void
  onFinishStroke: () => void
  onCancelStroke: () => void
}

function clamp(p: Point, w: number, h: number): Point {
  return {
    x: Math.min(w, Math.max(0, p.x)),
    y: Math.min(h, Math.max(0, p.y)),
  }
}

function clientToCanvas(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): Point {
  const r = canvas.getBoundingClientRect()
  const sx = canvas.width / r.width
  const sy = canvas.height / r.height
  return {
    x: (clientX - r.left) * sx,
    y: (clientY - r.top) * sy,
  }
}

function drawRegion(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  opts: { stroke: string; fill: string; lineWidth: number; dashed: boolean },
) {
  if (points.length < 2) return
  ctx.strokeStyle = opts.stroke
  ctx.fillStyle = opts.fill
  ctx.lineWidth = opts.lineWidth
  if (opts.dashed) ctx.setLineDash([4, 4])
  else ctx.setLineDash([])

  traceSmoothClosedPath(ctx, points)
  if (points.length >= 3) ctx.fill()
  ctx.stroke()
  ctx.setLineDash([])
}

/**
 * Captures pointer events for occlusion regions; shows committed preview when idle.
 * Ignored at PNG export via `data-poster-ignore-export`.
 */
export function OcclusionMaskOverlay({
  width,
  height,
  active,
  draftPoints,
  committedRegions,
  onAppendPoint,
  onFinishStroke,
  onCancelStroke,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)

  const showPreview =
    !active && committedRegions.length > 0

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, width, height)

    if (active && draftPoints.length > 0) {
      drawRegion(ctx, draftPoints, {
        stroke: 'rgba(245, 158, 11, 0.95)',
        fill: 'rgba(245, 158, 11, 0.18)',
        lineWidth: 2,
        dashed: true,
      })
      return
    }

    if (showPreview) {
      for (const region of committedRegions) {
        drawRegion(ctx, region.points, {
          stroke: 'rgba(245, 158, 11, 0.55)',
          fill: 'rgba(245, 158, 11, 0.12)',
          lineWidth: 1.5,
          dashed: false,
        })
      }
    }
  }, [active, draftPoints, committedRegions, showPreview, width, height])

  if (!active && !showPreview) return null

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      data-poster-ignore-export="true"
      className={
        active
          ? 'absolute inset-0 z-[60] cursor-crosshair touch-none'
          : 'pointer-events-none absolute inset-0 z-[22]'
      }
      onPointerDown={
        active
          ? (e) => {
              e.preventDefault()
              const canvas = ref.current
              if (!canvas) return
              canvas.setPointerCapture(e.pointerId)
              drawing.current = true
              const p = clamp(
                clientToCanvas(canvas, e.clientX, e.clientY),
                width,
                height,
              )
              onAppendPoint(p)
            }
          : undefined
      }
      onPointerMove={
        active
          ? (e) => {
              if (!drawing.current) return
              const canvas = ref.current
              if (!canvas) return
              const p = clamp(
                clientToCanvas(canvas, e.clientX, e.clientY),
                width,
                height,
              )
              onAppendPoint(p)
            }
          : undefined
      }
      onPointerUp={
        active
          ? (e) => {
              const canvas = ref.current
              if (canvas && canvas.hasPointerCapture(e.pointerId)) {
                canvas.releasePointerCapture(e.pointerId)
              }
              drawing.current = false
              onFinishStroke()
            }
          : undefined
      }
      onPointerCancel={
        active
          ? (e) => {
              const canvas = ref.current
              if (canvas && canvas.hasPointerCapture(e.pointerId)) {
                canvas.releasePointerCapture(e.pointerId)
              }
              drawing.current = false
              onCancelStroke()
            }
          : undefined
      }
    />
  )
}
