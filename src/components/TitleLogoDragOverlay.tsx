import type { RefObject } from 'react'
import { useCallback, useEffect, useRef } from 'react'
import type { LogoConfig, Point, TitleConfig } from '../types/render'

const HANDLE_DIAM = 18
const MIN_TITLE_W = 64
const MIN_TITLE_FONT = 12
const MIN_LOGO_W = 20

type DragState =
  | null
  | {
      kind: 'drag-title' | 'resize-title' | 'drag-logo' | 'resize-logo'
      pointerId: number
      startLogical: Point
      origTitleX: number
      origTitleY: number
      origTitleW: number
      origTitleFont: number
      origLogoX: number
      origLogoY: number
      origLogoW: number
    }

type Props = {
  containerRef: RefObject<HTMLElement | null>
  logicalWidth: number
  logicalHeight: number
  title: TitleConfig
  logo: LogoConfig
  hasLogo: boolean
  logoNaturalWidth: number
  logoNaturalHeight: number
  /** No hit targets while placing quad corners or drawing brush shadow. */
  passive: boolean
  onPatchTitle: (partial: Partial<TitleConfig>) => void
  onPatchLogo: (partial: Partial<LogoConfig>) => void
}

function toLogical(
  el: HTMLElement,
  clientX: number,
  clientY: number,
  lw: number,
  lh: number,
): Point {
  const r = el.getBoundingClientRect()
  return {
    x: ((clientX - r.left) / Math.max(1e-6, r.width)) * lw,
    y: ((clientY - r.top) / Math.max(1e-6, r.height)) * lh,
  }
}

function clamp(v: number, a: number, b: number) {
  return Math.min(b, Math.max(a, v))
}

/**
 * Draggable / resizable title + logo above the quad overlay (z 55). Export ignores this layer.
 */
export function TitleLogoDragOverlay({
  containerRef,
  logicalWidth,
  logicalHeight,
  title,
  logo,
  hasLogo,
  logoNaturalWidth,
  logoNaturalHeight,
  passive,
  onPatchTitle,
  onPatchLogo,
}: Props) {
  const drag = useRef<DragState>(null)
  const titleLineH = 1.1
  const titleBoxH = title.fontSize * titleLineH
  const logoRatio =
    logoNaturalWidth > 0 ? logoNaturalHeight / logoNaturalWidth : 1
  const logoBoxH = logo.width * logoRatio

  const clearDrag = useCallback(() => {
    drag.current = null
  }, [])

  useEffect(() => () => {
    drag.current = null
  }, [])

  const onWindowPointerMove = useCallback(
    (e: PointerEvent) => {
      const d = drag.current
      const root = containerRef.current
      if (!d || e.pointerId !== d.pointerId || !root) return

      const p = toLogical(root, e.clientX, e.clientY, logicalWidth, logicalHeight)

      if (d.kind === 'drag-title') {
        const dx = p.x - d.startLogical.x
        const dy = p.y - d.startLogical.y
        const boxH = title.fontSize * titleLineH
        const nx = clamp(d.origTitleX + dx, 0, logicalWidth - title.width)
        const ny = clamp(d.origTitleY + dy, 0, logicalHeight - boxH)
        onPatchTitle({ x: nx, y: ny })
        return
      }

      if (d.kind === 'resize-title') {
        const dx = p.x - d.startLogical.x
        const nw = clamp(
          d.origTitleW + dx,
          MIN_TITLE_W,
          logicalWidth - d.origTitleX,
        )
        const nf = clamp(
          d.origTitleFont * (nw / d.origTitleW),
          MIN_TITLE_FONT,
          800,
        )
        onPatchTitle({ width: nw, fontSize: nf })
        return
      }

      if (d.kind === 'drag-logo') {
        const dx = p.x - d.startLogical.x
        const dy = p.y - d.startLogical.y
        const lh = logo.width * logoRatio
        const nx = clamp(d.origLogoX + dx, 0, logicalWidth - logo.width)
        const ny = clamp(d.origLogoY + dy, 0, logicalHeight - lh)
        onPatchLogo({ x: nx, y: ny })
        return
      }

      if (d.kind === 'resize-logo') {
        const dx = p.x - d.startLogical.x
        const nw = clamp(
          d.origLogoW + dx,
          MIN_LOGO_W,
          logicalWidth - d.origLogoX,
        )
        onPatchLogo({ width: nw })
      }
    },
    [
      containerRef,
      logicalWidth,
      logicalHeight,
      title.fontSize,
      title.width,
      logo.width,
      logoRatio,
      onPatchTitle,
      onPatchLogo,
    ],
  )

  const onWindowPointerUp = useCallback(
    (e: PointerEvent) => {
      const d = drag.current
      if (!d || e.pointerId !== d.pointerId) return
      clearDrag()
    },
    [clearDrag],
  )

  useEffect(() => {
    const move = (e: PointerEvent) => onWindowPointerMove(e)
    const up = (e: PointerEvent) => onWindowPointerUp(e)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [onWindowPointerMove, onWindowPointerUp])

  if (passive) return null

  const startResizeTitle = (e: React.PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const root = containerRef.current
    if (!root) return
    const p = toLogical(root, e.clientX, e.clientY, logicalWidth, logicalHeight)
    drag.current = {
      kind: 'resize-title',
      pointerId: e.pointerId,
      startLogical: p,
      origTitleX: title.x,
      origTitleY: title.y,
      origTitleW: title.width,
      origTitleFont: title.fontSize,
      origLogoX: logo.x,
      origLogoY: logo.y,
      origLogoW: logo.width,
    }
  }

  const startDragTitle = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-typo-handle="resize"]')) return
    e.preventDefault()
    const root = containerRef.current
    if (!root) return
    const p = toLogical(root, e.clientX, e.clientY, logicalWidth, logicalHeight)
    drag.current = {
      kind: 'drag-title',
      pointerId: e.pointerId,
      startLogical: p,
      origTitleX: title.x,
      origTitleY: title.y,
      origTitleW: title.width,
      origTitleFont: title.fontSize,
      origLogoX: logo.x,
      origLogoY: logo.y,
      origLogoW: logo.width,
    }
  }

  const startResizeLogo = (e: React.PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const root = containerRef.current
    if (!root) return
    const p = toLogical(root, e.clientX, e.clientY, logicalWidth, logicalHeight)
    drag.current = {
      kind: 'resize-logo',
      pointerId: e.pointerId,
      startLogical: p,
      origTitleX: title.x,
      origTitleY: title.y,
      origTitleW: title.width,
      origTitleFont: title.fontSize,
      origLogoX: logo.x,
      origLogoY: logo.y,
      origLogoW: logo.width,
    }
  }

  const startDragLogo = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-typo-handle="resize"]')) return
    e.preventDefault()
    const root = containerRef.current
    if (!root) return
    const p = toLogical(root, e.clientX, e.clientY, logicalWidth, logicalHeight)
    drag.current = {
      kind: 'drag-logo',
      pointerId: e.pointerId,
      startLogical: p,
      origTitleX: title.x,
      origTitleY: title.y,
      origTitleW: title.width,
      origTitleFont: title.fontSize,
      origLogoX: logo.x,
      origLogoY: logo.y,
      origLogoW: logo.width,
    }
  }

  const boxStyle =
    'pointer-events-none absolute inset-0 rounded-sm border-2 border-dashed border-sky-500/80'
  const handleClass =
    'pointer-events-auto absolute z-10 rounded-full border-2 border-white bg-sky-500 shadow-md touch-none'

  return (
    <div
      data-poster-ignore-export="true"
      className="pointer-events-none absolute inset-0 z-[55]"
    >
      <div
        className="pointer-events-auto absolute cursor-move touch-none select-none"
        style={{
          left: title.x,
          top: title.y,
          width: title.width,
          height: titleBoxH,
        }}
        onPointerDown={startDragTitle}
      >
        <div className={boxStyle} aria-hidden />
        <div
          data-typo-handle="resize"
          className={`${handleClass} cursor-nwse-resize`}
          style={{
            width: HANDLE_DIAM,
            height: HANDLE_DIAM,
            right: -HANDLE_DIAM / 2,
            bottom: -HANDLE_DIAM / 2,
          }}
          onPointerDown={startResizeTitle}
        />
      </div>

      {hasLogo ? (
        <div
          className="pointer-events-auto absolute cursor-move touch-none select-none"
          style={{
            left: logo.x,
            top: logo.y,
            width: logo.width,
            height: logoBoxH,
          }}
          onPointerDown={startDragLogo}
        >
          <div className={boxStyle} aria-hidden />
          <div
            data-typo-handle="resize"
            className={`${handleClass} cursor-nwse-resize`}
            style={{
              width: HANDLE_DIAM,
              height: HANDLE_DIAM,
              right: -HANDLE_DIAM / 2,
              bottom: -HANDLE_DIAM / 2,
            }}
            onPointerDown={startResizeLogo}
          />
        </div>
      ) : null}
    </div>
  )
}
