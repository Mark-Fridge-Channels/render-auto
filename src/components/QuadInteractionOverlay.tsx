import { useEffect, useRef } from 'react'
import type { Point, ProductQuad } from '../types/render'

type Props = {
  width: number
  height: number
  drawing: boolean
  draft: Point[]
  quad: ProductQuad | null
  onAddCorner: (p: Point) => void
  onMoveCorner: (index: number, p: Point) => void
  /** When true, quad handles are visual-only (brush session owns pointer events). */
  passive?: boolean
}

const HANDLE_RADIUS = 8
const HIT_PX = 18
const DRAG_THRESHOLD = 4

function clamp(p: Point, w: number, h: number): Point {
  return {
    x: Math.min(w, Math.max(0, p.x)),
    y: Math.min(h, Math.max(0, p.y)),
  }
}

function dist(a: Point, b: Point) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.hypot(dx, dy)
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
 * UI layer for quad authoring: polyline preview, draggable handles, exportignored via `data-*` hook.
 */
export function QuadInteractionOverlay({
  width,
  height,
  drawing,
  draft,
  quad,
  onAddCorner,
  onMoveCorner,
  passive = false,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const dragIndex = useRef<number | null>(null)
  const dragMoved = useRef(false)
  const start = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, width, height)
    const pts = (quad ? [...quad] : draft) as Point[]
    if (pts.length === 0) return

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.95)'
    ctx.fillStyle = 'rgba(14, 165, 233, 0.95)'
    ctx.lineWidth = 2
    ctx.setLineDash([6, 4])

    ctx.beginPath()
    pts.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y)
      else ctx.lineTo(p.x, p.y)
    })
    if (pts.length === 4) ctx.closePath()
    ctx.stroke()
    ctx.setLineDash([])

    pts.forEach((p) => {
      ctx.beginPath()
      ctx.arc(p.x, p.y, HANDLE_RADIUS, 0, Math.PI * 2)
      ctx.fill()
    })
  }, [quad, draft, width, height])

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      data-poster-ignore-export="true"
      className={
        passive
          ? 'pointer-events-none absolute inset-0 z-50 cursor-crosshair touch-none'
          : 'absolute inset-0 z-50 cursor-crosshair touch-none'
      }
      onPointerDown={(e) => {
        if (passive) return
        const canvas = ref.current
        if (!canvas) return
        e.currentTarget.setPointerCapture(e.pointerId)

        const p = clamp(clientToCanvas(canvas, e.clientX, e.clientY), width, height)
        start.current = { x: e.clientX, y: e.clientY }
        dragMoved.current = false

        if (quad) {
          for (let i = 0; i < quad.length; i++) {
            if (dist(p, quad[i]) <= HIT_PX) {
              dragIndex.current = i
              return
            }
          }
        }

        dragIndex.current = null
      }}
      onPointerMove={(e) => {
        if (passive) return
        const canvas = ref.current
        if (!canvas) return

        if (dragIndex.current === null) {
          if (start.current) {
            const dx = e.clientX - start.current.x
            const dy = e.clientY - start.current.y
            if (Math.hypot(dx, dy) > DRAG_THRESHOLD) dragMoved.current = true
          }
          return
        }

        dragMoved.current = true
        const p = clamp(clientToCanvas(canvas, e.clientX, e.clientY), width, height)
        onMoveCorner(dragIndex.current, p)
      }}
      onPointerUp={(e) => {
        if (passive) return
        e.currentTarget.releasePointerCapture(e.pointerId)
        dragIndex.current = null
      }}
      onClick={(e) => {
        if (passive) return
        if (dragMoved.current) return
        if (!drawing) return
        if (quad) return
        if (draft.length >= 4) return

        const canvas = ref.current
        if (!canvas) return
        const p = clamp(clientToCanvas(canvas, e.clientX, e.clientY), width, height)
        onAddCorner(p)
      }}
    />
  )
}
