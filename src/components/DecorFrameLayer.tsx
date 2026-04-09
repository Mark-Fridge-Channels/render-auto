import type { DecorFrameConfig } from '../types/render'

type Props = {
  canvasWidth: number
  canvasHeight: number
  frame: DecorFrameConfig
}

/**
 * Rounded-rect border + optional semi-transparent fill inside, centered on the board.
 */
export function DecorFrameLayer({ canvasWidth, canvasHeight, frame }: Props) {
  if (!frame.enabled) return null

  const w = Math.min(Math.max(1, frame.width), canvasWidth)
  const h = Math.min(Math.max(1, frame.height), canvasHeight)
  const left = (canvasWidth - w) / 2
  const top = (canvasHeight - h) / 2
  const bw = Math.max(0, frame.borderWidth)
  const fillAlpha = Math.min(1, Math.max(0, frame.fillOpacity))
  const fillPct = Math.round(fillAlpha * 100)
  const backgroundColor =
    fillPct > 0
      ? `color-mix(in srgb, ${frame.fillColor} ${fillPct}%, transparent)`
      : 'transparent'

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-[45] box-border"
      style={{
        left,
        top,
        width: w,
        height: h,
        borderRadius: Math.max(0, frame.cornerRadius),
        backgroundColor,
        border: bw > 0 ? `${bw}px solid ${frame.color}` : undefined,
        boxSizing: 'border-box',
      }}
    />
  )
}
