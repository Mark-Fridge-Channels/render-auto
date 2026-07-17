import type { RefObject } from 'react'
import { useEffect, useRef } from 'react'
import type { ProductOcclusionMask } from '../types/render'
import { shouldUseAnonymousCrossOrigin } from '../utils/mediaCrossOrigin'
import { drawOcclusionComposite } from '../utils/occlusionComposite'

type Props = {
  width: number
  height: number
  backgroundSrc: string
  mask: ProductOcclusionMask | null
  productCanvasRef?: RefObject<HTMLCanvasElement | null>
}

function isProductReady(canvas: HTMLCanvasElement | null): boolean {
  return canvas?.dataset.productReady === 'true'
}

/**
 * Restores original-background foreground above the warped product with edge defringe
 * and contact shadow on the new card.
 */
export function OcclusionRestoreCanvas({
  width,
  height,
  backgroundSrc,
  mask,
  productCanvasRef,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const bgImageRef = useRef<HTMLImageElement | null>(null)
  const productReadyRef = useRef(false)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const markReady = (ready: boolean) => {
      if (ready) canvas.dataset.occlusionReady = 'true'
      else delete canvas.dataset.occlusionReady
    }

    let cancelled = false

    const paint = () => {
      if (cancelled) return
      ctx.clearRect(0, 0, width, height)

      if (!mask || mask.regions.length === 0 || !backgroundSrc) {
        markReady(true)
        return
      }

      const img = bgImageRef.current
      if (!img || !img.complete || img.naturalWidth === 0) return

      const product = productCanvasRef?.current ?? null
      if (!isProductReady(product)) return

      try {
        drawOcclusionComposite(
          ctx,
          img,
          img.naturalWidth,
          img.naturalHeight,
          mask,
          product,
        )
      } catch (err) {
        console.warn('[occlusion] composite failed (likely CORS/taint):', err)
      }
      markReady(true)
    }

    const requestPaint = () => {
      markReady(false)
      paint()
    }

    markReady(false)
    ctx.clearRect(0, 0, width, height)

    if (!mask || mask.regions.length === 0 || !backgroundSrc) {
      markReady(true)
      return
    }

    let img = bgImageRef.current
    if (!img || img.src !== backgroundSrc) {
      img = new Image()
      if (shouldUseAnonymousCrossOrigin(backgroundSrc)) {
        img.crossOrigin = 'anonymous'
      }
      img.onload = () => {
        if (cancelled) return
        bgImageRef.current = img
        requestPaint()
      }
      img.onerror = () => {
        if (cancelled) return
        console.warn('[occlusion] background image failed to load for restore')
        markReady(true)
      }
      img.src = backgroundSrc
      bgImageRef.current = img
      if (img.complete && img.naturalWidth > 0) requestPaint()
    } else if (img.complete) {
      requestPaint()
    }

    const productCanvas = productCanvasRef?.current ?? null
    let productObserver: MutationObserver | null = null

    const watchProduct = () => {
      const el = productCanvasRef?.current
      if (!el) {
        productReadyRef.current = false
        return
      }
      const ready = isProductReady(el)
      if (ready !== productReadyRef.current) {
        productReadyRef.current = ready
        if (ready) requestPaint()
      }
    }

    watchProduct()
    if (productCanvas) {
      productObserver = new MutationObserver(watchProduct)
      productObserver.observe(productCanvas, {
        attributes: true,
        attributeFilter: ['data-product-ready'],
      })
    }

    return () => {
      cancelled = true
      productObserver?.disconnect()
    }
  }, [backgroundSrc, mask, width, height, productCanvasRef])

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      className="pointer-events-none absolute inset-0 z-[21]"
      aria-hidden
    />
  )
}
