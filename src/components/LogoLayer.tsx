import type { LogoConfig } from '../types/render'
import { shouldUseAnonymousCrossOrigin } from '../utils/mediaCrossOrigin'
import { usePosterStore } from '../store/posterStore'

type Props = {
  logo: LogoConfig
  src: string | null
  naturalWidth: number
  naturalHeight: number
}

/**
 * Brand mark — width drives layout; height follows intrinsic aspect ratio (enforced ratio).
 */
export function LogoLayer({ logo, src, naturalWidth, naturalHeight }: Props) {
  const setLogoNaturalSize = usePosterStore((s) => s.setLogoNaturalSize)

  if (!src) return null

  const ratio = naturalHeight / naturalWidth
  const heightPx = logo.width * ratio
  const useCors = shouldUseAnonymousCrossOrigin(src)

  return (
    <img
      src={src}
      alt=""
      crossOrigin={useCors ? 'anonymous' : undefined}
      className="pointer-events-none absolute z-40 select-none"
      draggable={false}
      onLoad={(e) =>
        setLogoNaturalSize(
          e.currentTarget.naturalWidth,
          e.currentTarget.naturalHeight,
        )
      }
      style={{
        left: logo.x,
        top: logo.y,
        width: logo.width,
        height: heightPx,
      }}
    />
  )
}
