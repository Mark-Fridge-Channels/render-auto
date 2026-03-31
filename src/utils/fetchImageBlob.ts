/**
 * Fetches a remote image with CORS. When successful, the bytes become same-origin via Blob URL,
 * which avoids canvas export taint without a backend proxy.
 */
export async function fetchImageBlob(url: string): Promise<Blob> {
  const trimmed = url.trim()
  if (!trimmed) throw new Error('URL 为空')

  const res = await fetch(trimmed, {
    mode: 'cors',
    credentials: 'omit',
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const blob = await res.blob()
  if (!blob.type.startsWith('image/') && blob.size === 0) {
    throw new Error('响应体为空')
  }
  return blob
}
