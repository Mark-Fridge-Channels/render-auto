import type { TitleConfig } from '../types/render'

type Props = {
  title: TitleConfig
}

/**
 * Headline overlay — single-line ellipsis per MVP overflow rules (system font stack inherits from page).
 */
export function TitleLayer({ title }: Props) {
  return (
    <div
      className="pointer-events-none absolute z-30 overflow-hidden text-ellipsis whitespace-nowrap font-semibold"
      style={{
        left: title.x,
        top: title.y,
        width: title.width,
        fontSize: title.fontSize,
        color: title.color,
        lineHeight: 1.1,
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {title.text}
    </div>
  )
}
