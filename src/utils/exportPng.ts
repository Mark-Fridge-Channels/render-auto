import { toPng } from 'html-to-image'

export type ExportOptions = {
  width: number
  height: number
}

/**
 * Rasterises the poster DOM subtree. Cross-origin media without CORS headers will throw —
 * callers should surface the error to users (per MVP spec).
 */
export async function exportPosterToPng(
  node: HTMLElement,
  { width, height }: ExportOptions,
): Promise<Blob> {
  const dataUrl = await toPng(node, {
    width,
    height,
    pixelRatio: 1,
    /**
     * 必须为 `false`：`html-to-image` 在 true 时会给每个资源 URL 拼接 `?timestamp`，
     * `blob:` 协议下会变成无效地址，`fetch` 失败导致整张导出中断。
     */
    cacheBust: false,
    filter: (el) => {
      if (!(el instanceof HTMLElement)) return true
      if (el.dataset.posterIgnoreExport === 'true') return false
      return true
    },
  })

  const res = await fetch(dataUrl)
  return res.blob()
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
