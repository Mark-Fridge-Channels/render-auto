import type { BatchRenderResult, TemplateItem, TemplatePayload } from '../types/template'

const API = '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return (await res.json()) as T
}

export async function listTemplates() {
  return request<{ templates: TemplateItem[] }>('/templates')
}

export async function getTemplateById(id: string) {
  return request<{ template: TemplateItem }>(`/templates/${id}`)
}

export async function createTemplate(input: {
  name: string
  payload: TemplatePayload
  enabled?: boolean
}) {
  return request<{ template: TemplateItem }>('/templates', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateTemplate(
  id: string,
  patch: Partial<{
    name: string
    order: number
    enabled: boolean
    payload: TemplatePayload
  }>,
) {
  return request<{ template: TemplateItem }>(`/templates/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export async function deleteTemplate(id: string) {
  return request<{ ok: true }>(`/templates/${id}`, { method: 'DELETE' })
}

export async function runBatch(productImageUrl: string) {
  return request<{ results: BatchRenderResult[] }>('/render/batch', {
    method: 'POST',
    body: JSON.stringify({ productImageUrl }),
  })
}

export async function runBatchByTemplate(productImageUrl: string, templateId: string) {
  return request<{ results: BatchRenderResult[] }>('/render/batch', {
    method: 'POST',
    body: JSON.stringify({ productImageUrl, templateId }),
  })
}

export async function runSingleByTemplate(productImageUrl: string, templateId: string) {
  return request<{ result: BatchRenderResult }>('/render/single', {
    method: 'POST',
    body: JSON.stringify({ productImageUrl, templateId }),
  })
}

export async function uploadBackgroundAsset(file: File) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${API}/assets/background`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return (await res.json()) as { path: string }
}
