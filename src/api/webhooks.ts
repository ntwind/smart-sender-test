import { request } from './client'

export type Webhook = {
  id: number
  name: string
  url: string
  active: boolean
  created_at: string
}

export type Paging = {
  pages: { current: number; last: number }
  results: { total: number; limitation: number }
}

export type WebhookList = {
  data: Webhook[]
  paging: Paging
}

export type WebhookUpdate = Pick<Webhook, 'name' | 'url'>

export type WebhookListQuery = { page?: number; limit?: number; search?: string }

export function listWebhooks({ page = 1, limit = 10, search }: WebhookListQuery = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (search) params.set('search', search)
  return request<WebhookList>('GET', `/v1/webhooks?${params}`, { auth: true })
}

export function getWebhook(id: number) {
  return request<Webhook>('GET', `/v1/webhooks/${id}`, { auth: true })
}

export function updateWebhook(id: number, data: WebhookUpdate) {
  return request<Webhook>('PUT', `/v1/webhooks/${id}`, { auth: true, body: data })
}
