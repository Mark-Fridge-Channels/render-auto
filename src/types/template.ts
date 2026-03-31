import type { PosterConfig, ProductBrushShadow, ProductQuad } from './render'

/**
 * Persisted template payload: all poster params + committed four-point geometry.
 */
export type TemplatePayload = {
  config: PosterConfig
  productQuad: ProductQuad | null
  /** Optional closed brush region + shadow params; same coordinate space as `productQuad`. */
  productBrushShadow?: ProductBrushShadow | null
}

export type TemplateItem = {
  id: string
  name: string
  order: number
  enabled: boolean
  payload: TemplatePayload
  createdAt: string
  updatedAt: string
}

export type BatchRenderResult = {
  templateName: string
  s3Url: string | null
  error: string | null
}
