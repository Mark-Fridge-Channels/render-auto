/** Destination rect for CSS `object-fit: cover` inside a fixed container. */
export type ObjectCoverRect = {
  dx: number
  dy: number
  dw: number
  dh: number
}

/**
 * Matches `object-cover` on a container — scale uniformly to fill, center, crop overflow.
 */
export function getObjectCoverDestRect(
  containerW: number,
  containerH: number,
  imageW: number,
  imageH: number,
): ObjectCoverRect {
  const iw = Math.max(1, imageW)
  const ih = Math.max(1, imageH)
  const scale = Math.max(containerW / iw, containerH / ih)
  const dw = iw * scale
  const dh = ih * scale
  return {
    dx: (containerW - dw) / 2,
    dy: (containerH - dh) / 2,
    dw,
    dh,
  }
}

/** Draw `image` into the canvas the same way as `<img class="object-cover">`. */
export function drawImageObjectCover(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  imageW: number,
  imageH: number,
  containerW?: number,
  containerH?: number,
): void {
  const cw = containerW ?? ctx.canvas.width
  const ch = containerH ?? ctx.canvas.height
  const { dx, dy, dw, dh } = getObjectCoverDestRect(cw, ch, imageW, imageH)
  ctx.drawImage(image, 0, 0, imageW, imageH, dx, dy, dw, dh)
}
