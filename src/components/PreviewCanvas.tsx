import type { RefObject } from 'react'
import type {
  LogoConfig,
  Point,
  PosterConfig,
  ProductBrushShadow,
  ProductQuad,
  TitleConfig,
} from '../types/render'
import { shouldUseAnonymousCrossOrigin } from '../utils/mediaCrossOrigin'
import { BrushShadowOverlay } from './BrushShadowOverlay'
import { LogoLayer } from './LogoLayer'
import { ProductWarpCanvas } from './ProductWarpCanvas'
import { QuadInteractionOverlay } from './QuadInteractionOverlay'
import { TitleLayer } from './TitleLayer'
import { TitleLogoDragOverlay } from './TitleLogoDragOverlay'

type Props = {
  exportRef: RefObject<HTMLDivElement | null>
  config: PosterConfig
  /** Effective `<img src>` — local / fetched blob URLs take precedence over remote URL text. */
  backgroundSrc: string
  productUrl: string | null
  logoUrl: string | null
  logoNaturalWidth: number
  logoNaturalHeight: number
  productQuad: ProductQuad | null
  quadDraft: Point[]
  quadDrawing: boolean
  backgroundFailed: boolean
  onBackgroundError: () => void
  onBackgroundLoad: () => void
  onAddQuadPoint: (p: Point) => void
  onMoveQuadCorner: (index: number, p: Point) => void
  productBrushShadow: ProductBrushShadow | null
  brushDraftPoints: Point[]
  brushDrawing: boolean
  onAppendBrushPoint: (p: Point) => void
  onFinishBrushStroke: () => void
  onCancelBrushStroke: () => void
  /** When set with `showInteraction`, title/logo can be dragged and resized on canvas. */
  onPatchTitle?: (partial: Partial<TitleConfig>) => void
  onPatchLogo?: (partial: Partial<LogoConfig>) => void
  showInteraction?: boolean
  renderRootAttr?: boolean
  decorated?: boolean
}

/**
 * Absolute-positioned poster board — this subtree is fed to `html-to-image`.
 * Interactive handles live in `QuadInteractionOverlay` and are filtered out at export time.
 */
export function PreviewCanvas({
  exportRef,
  config,
  backgroundSrc,
  productUrl,
  logoUrl,
  logoNaturalWidth,
  logoNaturalHeight,
  productQuad,
  quadDraft,
  quadDrawing,
  backgroundFailed,
  onBackgroundError,
  onBackgroundLoad,
  onAddQuadPoint,
  onMoveQuadCorner,
  productBrushShadow,
  brushDraftPoints,
  brushDrawing,
  onAppendBrushPoint,
  onFinishBrushStroke,
  onCancelBrushStroke,
  onPatchTitle,
  onPatchLogo,
  showInteraction = true,
  renderRootAttr = false,
  decorated = true,
}: Props) {
  const w = config.canvas.width
  const h = config.canvas.height
  const useCors = shouldUseAnonymousCrossOrigin(backgroundSrc)

  return (
    <div
      ref={exportRef}
      data-render-root={renderRootAttr ? 'true' : undefined}
      className={
        decorated
          ? 'relative overflow-hidden bg-white shadow-2xl ring-1 ring-slate-200'
          : 'relative overflow-hidden bg-white'
      }
      style={{ width: w, height: h }}
    >
      {backgroundFailed || !backgroundSrc ? (
        <div className="absolute inset-0 z-10 bg-white" aria-hidden />
      ) : (
        <img
          src={backgroundSrc}
          alt=""
          crossOrigin={useCors ? 'anonymous' : undefined}
          className="pointer-events-none absolute inset-0 z-10 h-full w-full object-cover"
          onError={onBackgroundError}
          onLoad={onBackgroundLoad}
        />
      )}

      <ProductWarpCanvas
        width={w}
        height={h}
        imageUrl={productUrl}
        quad={productQuad}
        cornerRadius={config.product.cornerRadius}
        realismEnabled={config.product.realismEnabled}
        realismStrength={config.product.realismStrength}
        brushShadow={productBrushShadow}
        quadInnerShadowEnabled={
          config.product.quadInnerShadowEnabled ?? false
        }
        quadInnerShadowOpacity={
          config.product.quadInnerShadowOpacity ?? 0.35
        }
        quadInnerShadowBlur={config.product.quadInnerShadowBlur ?? 14}
      />

      <TitleLayer title={config.title} />

      <LogoLayer
        logo={config.logo}
        src={logoUrl}
        naturalWidth={logoNaturalWidth}
        naturalHeight={logoNaturalHeight}
      />

      {showInteraction ? (
        <>
          <QuadInteractionOverlay
            width={w}
            height={h}
            drawing={quadDrawing}
            draft={quadDraft}
            quad={productQuad}
            onAddCorner={onAddQuadPoint}
            onMoveCorner={onMoveQuadCorner}
            passive={brushDrawing}
          />
          {onPatchTitle && onPatchLogo ? (
            <TitleLogoDragOverlay
              containerRef={exportRef}
              logicalWidth={w}
              logicalHeight={h}
              title={config.title}
              logo={config.logo}
              hasLogo={Boolean(logoUrl)}
              logoNaturalWidth={logoNaturalWidth}
              logoNaturalHeight={logoNaturalHeight}
              passive={quadDrawing || brushDrawing}
              onPatchTitle={onPatchTitle}
              onPatchLogo={onPatchLogo}
            />
          ) : null}
          {productQuad ? (
            <BrushShadowOverlay
              width={w}
              height={h}
              active={brushDrawing}
              draftPoints={brushDraftPoints}
              onAppendPoint={onAppendBrushPoint}
              onFinishStroke={onFinishBrushStroke}
              onCancelStroke={onCancelBrushStroke}
            />
          ) : null}
        </>
      ) : null}
    </div>
  )
}
