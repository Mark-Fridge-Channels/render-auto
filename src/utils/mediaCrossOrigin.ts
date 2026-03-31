/**
 * Only use `crossOrigin="anonymous"` for truly cross-origin image URLs.
 * Same-origin paths (e.g. `/uploads/...`) must not force CORS mode or static
 * files may fail to load/display when ACAO headers are absent.
 */
export function shouldUseAnonymousCrossOrigin(src: string): boolean {
  if (!src) return false
  if (src.startsWith('blob:') || src.startsWith('data:')) return false
  try {
    const url = new URL(src, window.location.href)
    return url.origin !== window.location.origin
  } catch {
    return false
  }
}
