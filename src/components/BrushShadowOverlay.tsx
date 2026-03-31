import { useEffect, useRef } from 'react'
import type { Point } from '../types/render'

type Props = {
  width: number
  height: number
  active: boolean
  draftPoints: Point[]
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

/**
 * Captures pointer events for freehand closed regions (auto-close on pointer-up).
 * Ignored at PNG export via `data-poster-ignore-export`.
 */
export function BrushShadowOverlay({
  width,
  height,
  active,
  draftPoints,
  onAppendPoint,
  onFinishStroke,
  onCancelStroke,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, width, height)
    if (!active || draftPoints.length === 0) return

    ctx.strokeStyle = 'rgba(168, 85, 247, 0.9)'
    ctx.fillStyle = 'rgba(168, 85, 247, 0.15)'
    ctx.lineWidth = 2
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    draftPoints.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y)
      else ctx.lineTo(p.x, p.y)
    })
    if (draftPoints.length >= 3) {
      ctx.closePath()
      ctx.fill()
    }
    ctx.stroke()
    ctx.setLineDash([])
  }, [active, draftPoints, width, height])

  if (!active) return null

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      data-poster-ignore-export="true"
      className="absolute inset-0 z-[60] cursor-crosshair touch-none"
      onPointerDown={(e) => {
        e.preventDefault()
        const canvas = ref.current
        if (!canvas) return
        canvas.setPointerCapture(e.pointerId)
        drawing.current = true
        const p = clamp(clientToCanvas(canvas, e.clientX, e.clientY), width, height)
        onAppendPoint(p)
      }}
      onPointerMove={(e) => {
        if (!drawing.current) return
        const canvas = ref.current
        if (!canvas) return
        const p = clamp(clientToCanvas(canvas, e.clientX, e.clientY), width, height)
        onAppendPoint(p)
      }}
      onPointerUp={(e) => {
        const canvas = ref.current
        if (canvas && canvas.hasPointerCapture(e.pointerId)) {
          canvas.releasePointerCapture(e.pointerId)
        }
        drawing.current = false
        onFinishStroke()
      }}
      onPointerCancel={(e) => {
        const canvas = ref.current
        if (canvas && canvas.hasPointerCapture(e.pointerId)) {
          canvas.releasePointerCapture(e.pointerId)
        }
        drawing.current = false
        onCancelStroke()
      }}
    />
  )
}
