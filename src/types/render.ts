/**
 * MVP render model: fixed canvas, URL background, single-line title, logo by width only,
 * product placement exclusively via a four-corner quad in canvas coordinates (TL, TR, BR, BL).
 */

export type Point = { x: number; y: number }

/** Committed quad: top-left, top-right, bottom-right, bottom-left — canvas pixel space. */
export type ProductQuad = readonly [Point, Point, Point, Point]

export type TitleConfig = {
  text: string
  x: number
  y: number
  width: number
  fontSize: number
  color: string
}

export type LogoConfig = {
  x: number
  y: number
  /** Height is derived from natural aspect ratio × width. */
  width: number
}

/** Closed hand-drawn region for per-template local shadow (canvas pixel space). */
export type ProductBrushShadowMode = 'inner' | 'outer'

export type ProductBrushShadow = {
  /** Simplified polygon vertices in order; path is implicitly closed (last → first). */
  points: Point[]
  mode: ProductBrushShadowMode
  /** Gaussian-style shadow blur radius in logical canvas px (export scales uniformly). */
  blur: number
  /** 0–1; outer = shadowColor alpha, inner = stroke darkening strength. */
  opacity: number
  offsetX: number
  offsetY: number
  /** Any `canvas.fillStyle`-compatible string; hex preferred in UI. */
  color: string
}

export type ProductStyleConfig = {
  /** Rounded corners on the perspective quad (canvas px), clamped to facet geometry. */
  cornerRadius: number
  /** Enables realism pass: shadow, lighting, tone mapping, noise and subtle shear. */
  realismEnabled: boolean
  /** Unified realism strength (0-100), scales all realism passes together. */
  realismStrength: number
  /**
   * Inset shadow on the entire rounded quad (independent of hand-drawn brush regions).
   * Drawn before brush shadows so both compound with `source-over`.
   * Optional for older saved templates; UI/runtime treat missing as disabled + defaults.
   */
  quadInnerShadowEnabled?: boolean
  /** 0–1 darkening strength along the inner perimeter. */
  quadInnerShadowOpacity?: number
  /** Band width ~ `blur * 2` stroke (canvas px); scales with export in `render.ts`. */
  quadInnerShadowBlur?: number
}

export type PosterConfig = {
  canvas: {
    width: number
    height: number
  }
  /** Remote background URL — used when no local file / fetched blob override is active. */
  backgroundImageUrl: string
  /** Logical export size — defaults to canvas size; editable in the control panel. */
  export: {
    width: number
    height: number
  }
  /** Four-point product warp styling. */
  product: ProductStyleConfig
  title: TitleConfig
  logo: LogoConfig
}
