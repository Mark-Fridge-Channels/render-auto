import type { DecorFrameConfig, PosterConfig } from '../types/render'

/** Defaults for `decorFrame` and for merging older saved templates that omit it. */
export const defaultDecorFrame: DecorFrameConfig = {
  enabled: false,
  width: 2800,
  height: 2800,
  cornerRadius: 40,
  borderWidth: 6,
  color: '#ffffff',
  fillColor: '#000000',
  fillOpacity: 0.35,
}

/**
 * Sensible starter values — replace `backgroundImageUrl` with your own asset as needed.
 * Prefer URLs that send `Access-Control-Allow-Origin` when exporting via canvas/html-to-image.
 */
export const defaultPosterConfig: PosterConfig = {
  canvas: {
    width: 3000,
    height: 3000,
  },
  backgroundImageUrl:
    'https://images.unsplash.com/photo-1550684848-facff4328478?auto=format&fit=crop&w=1600&q=80',
  export: {
    width: 3000,
    height: 3000,
  },
  product: {
    cornerRadius: 0,
    realismEnabled: false,
    realismStrength: 65,
    quadInnerShadowEnabled: false,
    quadInnerShadowOpacity: 0.35,
    quadInnerShadowBlur: 14,
  },
  title: {
    text: 'A smarter home prompt tool',
    x: 120,
    y: 140,
    width: 700,
    fontSize: 72,
    color: '#111111',
  },
  logo: {
    x: 120,
    y: 60,
    width: 180,
  },
  decorFrame: { ...defaultDecorFrame },
}

/** Fill `decorFrame` when loading legacy templates that predate this field. */
export function withDecorFrameDefaults(cfg: PosterConfig): PosterConfig {
  return {
    ...cfg,
    decorFrame: { ...defaultDecorFrame, ...cfg.decorFrame },
  }
}
