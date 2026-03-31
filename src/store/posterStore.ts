import { create } from 'zustand'
import type {
  Point,
  PosterConfig,
  ProductBrushShadow,
  ProductQuad,
} from '../types/render'
import {
  dedupeConsecutive,
  polygonArea,
  simplifyPolyline,
} from '../utils/polylineSimplify'
import { defaultPosterConfig } from '../config/defaultConfig'
import { fetchImageBlob } from '../utils/fetchImageBlob'

function clampToCanvas(p: Point, w: number, h: number): Point {
  return {
    x: Math.min(w, Math.max(0, p.x)),
    y: Math.min(h, Math.max(0, p.y)),
  }
}

type PosterStore = {
  config: PosterConfig

  productObjectUrl: string | null
  logoObjectUrl: string | null
  logoNaturalWidth: number
  logoNaturalHeight: number

  /** Final quad used for Canvas warp — `null` until four corners are committed. */
  productQuad: ProductQuad | null
  /** Partial points while the user is clicking the sequence. */
  quadDraft: Point[]
  /** When true, canvas clicks append to `quadDraft`.button starts a fresh session. */
  quadDrawing: boolean

  /**
   * Optional closed hand-drawn region (auto-closes on pointer-up) for inner/outer shadow inside the product quad.
   */
  productBrushShadow: ProductBrushShadow | null
  /** Dense samples while drawing; finalized into `productBrushShadow` on pointer-up. */
  brushDraftPoints: Point[]
  brushDrawing: boolean
  /** Defaults / live params merged on commit; also edited when no committed shadow yet. */
  brushTool: Omit<ProductBrushShadow, 'points'>

  /** Background image failed to load — preview falls back to white (spec). */
  backgroundLoadFailed: boolean

  /**
   * Background overrides — blob URLs are same-origin, avoiding export taint.
   * Priority: `backgroundFileUrl` → `backgroundFetchedUrl` → `config.backgroundImageUrl`.
   */
  backgroundFileUrl: string | null
  /** Populated after a successful `fetchImageBlob` + `URL.createObjectURL`. */
  backgroundFetchedUrl: string | null

  /** Revoke old blob URLs when replacing files. */
  setProductFile: (file: File | null) => void
  setLogoFile: (file: File | null) => void
  setBackgroundFile: (file: File | null) => void
  /** Drops fetched blob (e.g. URL text changed). */
  revokeBackgroundFetched: () => void
  /** Clears both local upload and fetched blob. */
  clearBackgroundOverrides: () => void
  /** Fetches current remote URL with CORS and promotes it to a blob URL for display/export. */
  fetchBackgroundBlobFromUrl: (url: string) => Promise<void>

  setLogoNaturalSize: (width: number, height: number) => void
  patchConfig: (partial: Partial<PosterConfig>) => void
  setConfig: (next: PosterConfig) => void
  patchNested: <K extends keyof PosterConfig>(
    key: K,
    partial: Partial<PosterConfig[K]>,
  ) => void

  setBackgroundLoadFailed: (failed: boolean) => void

  /**
   * Starts / restarts quad capture — clears any committed quad and draft per MVP UX.
   */
  beginQuadDrawingSession: () => void

  /** Append a corner while drawing — auto-commits on the fourth point. */
  addDraftQuadPoint: (point: Point) => void

  /** Drag-adjust a committed corner by index (0…3). */
  moveQuadCorner: (index: number, point: Point) => void
  setProductQuad: (quad: ProductQuad | null) => void

  setProductBrushShadow: (shadow: ProductBrushShadow | null) => void
  patchProductBrushShadow: (partial: Partial<Omit<ProductBrushShadow, 'points'>>) => void
  patchBrushTool: (partial: Partial<Omit<ProductBrushShadow, 'points'>>) => void
  beginBrushDrawingSession: () => void
  cancelBrushDrawing: () => void
  appendBrushDraftPoint: (point: Point) => void
  finishBrushDrawing: () => void
  clearProductBrushShadow: () => void
}

export const usePosterStore = create<PosterStore>((set, get) => ({
  config: structuredClone(defaultPosterConfig),

  productObjectUrl: null,
  logoObjectUrl: null,
  logoNaturalWidth: 1,
  logoNaturalHeight: 1,

  productQuad: null,
  quadDraft: [],
  quadDrawing: false,

  productBrushShadow: null,
  brushDraftPoints: [],
  brushDrawing: false,
  brushTool: {
    mode: 'outer',
    blur: 14,
    opacity: 0.4,
    offsetX: 0,
    offsetY: 3,
    color: '#000000',
  },

  backgroundLoadFailed: false,

  backgroundFileUrl: null,
  backgroundFetchedUrl: null,

  setProductFile: (file) =>
    set((s) => {
      if (s.productObjectUrl) URL.revokeObjectURL(s.productObjectUrl)
      return {
        productObjectUrl: file ? URL.createObjectURL(file) : null,
      }
    }),

  setLogoFile: (file) =>
    set((s) => {
      if (s.logoObjectUrl) URL.revokeObjectURL(s.logoObjectUrl)
      return {
        logoObjectUrl: file ? URL.createObjectURL(file) : null,
        logoNaturalWidth: 1,
        logoNaturalHeight: 1,
      }
    }),

  setBackgroundFile: (file) =>
    set((s) => {
      if (s.backgroundFileUrl) URL.revokeObjectURL(s.backgroundFileUrl)
      if (s.backgroundFetchedUrl) URL.revokeObjectURL(s.backgroundFetchedUrl)
      return {
        backgroundFileUrl: file ? URL.createObjectURL(file) : null,
        backgroundFetchedUrl: null,
      }
    }),

  revokeBackgroundFetched: () =>
    set((s) => {
      if (s.backgroundFetchedUrl) URL.revokeObjectURL(s.backgroundFetchedUrl)
      return { backgroundFetchedUrl: null }
    }),

  clearBackgroundOverrides: () =>
    set((s) => {
      if (s.backgroundFileUrl) URL.revokeObjectURL(s.backgroundFileUrl)
      if (s.backgroundFetchedUrl) URL.revokeObjectURL(s.backgroundFetchedUrl)
      return { backgroundFileUrl: null, backgroundFetchedUrl: null }
    }),

  fetchBackgroundBlobFromUrl: async (url) => {
    const blob = await fetchImageBlob(url)
    set((s) => {
      if (s.backgroundFetchedUrl) URL.revokeObjectURL(s.backgroundFetchedUrl)
      return { backgroundFetchedUrl: URL.createObjectURL(blob) }
    })
  },

  setLogoNaturalSize: (width, height) =>
    set({
      logoNaturalWidth: width || 1,
      logoNaturalHeight: height || 1,
    }),

  patchConfig: (partial) =>
    set((s) => ({ config: { ...s.config, ...partial } })),
  setConfig: (next) => set({ config: next }),

  patchNested: (key, partial) =>
    set((s) => ({
      config: {
        ...s.config,
        [key]: { ...(s.config[key] as object), ...partial },
      },
    })),

  setBackgroundLoadFailed: (failed) => set({ backgroundLoadFailed: failed }),

  beginQuadDrawingSession: () =>
    set({
      productQuad: null,
      quadDraft: [],
      quadDrawing: true,
      productBrushShadow: null,
      brushDraftPoints: [],
      brushDrawing: false,
    }),

  addDraftQuadPoint: (raw) => {
    const { config, quadDraft, quadDrawing } = get()
    if (!quadDrawing || quadDraft.length >= 4) return

    const p = clampToCanvas(raw, config.canvas.width, config.canvas.height)
    const next = [...quadDraft, p]
    if (next.length < 4) {
      set({ quadDraft: next })
      return
    }

    const quad: ProductQuad = [next[0]!, next[1]!, next[2]!, next[3]!]
    set({
      quadDraft: [],
      quadDrawing: false,
      productQuad: quad,
    })
  },

  moveQuadCorner: (index, raw) => {
    const { productQuad, config } = get()
    if (!productQuad) return
    if (index < 0 || index > 3) return

    const p = clampToCanvas(raw, config.canvas.width, config.canvas.height)
    const q = [...productQuad] as Point[]
    q[index] = p
    set({ productQuad: q as unknown as ProductQuad })
  },

  setProductQuad: (quad) => set({ productQuad: quad }),

  setProductBrushShadow: (shadow) => set({ productBrushShadow: shadow }),

  patchProductBrushShadow: (partial) =>
    set((s) => {
      if (!s.productBrushShadow) return s
      return {
        productBrushShadow: { ...s.productBrushShadow, ...partial },
      }
    }),

  patchBrushTool: (partial) =>
    set((s) => ({
      brushTool: { ...s.brushTool, ...partial },
    })),

  beginBrushDrawingSession: () =>
    set({
      brushDrawing: true,
      brushDraftPoints: [],
    }),

  cancelBrushDrawing: () =>
    set({
      brushDrawing: false,
      brushDraftPoints: [],
    }),

  appendBrushDraftPoint: (raw) => {
    const { config, brushDraftPoints, brushDrawing } = get()
    if (!brushDrawing) return
    const p = clampToCanvas(raw, config.canvas.width, config.canvas.height)
    if (brushDraftPoints.length === 0) {
      set({ brushDraftPoints: [p] })
      return
    }
    const last = brushDraftPoints[brushDraftPoints.length - 1]!
    if (Math.hypot(p.x - last.x, p.y - last.y) < 3) return
    set({ brushDraftPoints: [...brushDraftPoints, p] })
  },

  finishBrushDrawing: () => {
    const { brushDraftPoints, brushDrawing, brushTool } = get()
    if (!brushDrawing) return

    let chain = dedupeConsecutive(brushDraftPoints, 1)
    if (chain.length >= 2) {
      const a = chain[0]!
      const b = chain[chain.length - 1]!
      if (Math.hypot(a.x - b.x, a.y - b.y) < 1) chain = chain.slice(0, -1)
    }

    if (chain.length < 3) {
      set({ brushDrawing: false, brushDraftPoints: [] })
      return
    }

    const simplified = simplifyPolyline(chain, 2.5)
    if (simplified.length < 3) {
      set({ brushDrawing: false, brushDraftPoints: [] })
      return
    }

    if (polygonArea(simplified) < 0.75) {
      set({ brushDrawing: false, brushDraftPoints: [] })
      return
    }

    const productBrushShadow: ProductBrushShadow = {
      points: simplified,
      ...brushTool,
    }
    set({
      productBrushShadow,
      brushDrawing: false,
      brushDraftPoints: [],
    })
  },

  clearProductBrushShadow: () => set({ productBrushShadow: null }),
}))
