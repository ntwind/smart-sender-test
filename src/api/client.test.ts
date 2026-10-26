// @vitest-environment happy-dom
import { delay, http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { apiErrorBody } from './errors'
import { getMe } from './user'
import { listWebhooks } from './webhooks'

const FINGERPRINT = 'a'.repeat(32)
const CSRF_TOKEN = 'csrf-token'

vi.mock('../fingerprint', () => ({ getFingerprint: () => FINGERPRINT }))

let sessionValid = false
const calls: string[] = []
const requests: Request[] = []

const server = setupServer(
  http.get('/csrf', () => new HttpResponse(null, { status: 204, headers: { 'X-CSRF-TOKEN': CSRF_TOKEN } })),

  http.post('/auth/token/rotate', async ({ request }) => {
    calls.push('rotate')
    const body = (await request.json()) as { fingerprint?: string }
    if (request.headers.get('X-CSRF-TOKEN') !== CSRF_TOKEN) return HttpResponse.json(apiErrorBody(419), { status: 419 })
    if (body.fingerprint !== FINGERPRINT) return HttpResponse.json(apiErrorBody(400), { status: 400 })
    await delay(50)
    sessionValid = true
    return HttpResponse.json({ expires_in: 30 })
  }),

  http.get('/v1/me', () => {
    calls.push(`me:${sessionValid ? 200 : 401}`)
    if (!sessionValid) return HttpResponse.json(apiErrorBody(401), { status: 401 })
    return HttpResponse.json({ id: 1, email: 'admin@mail.com', first_name: 'Admin', last_name: 'User', name: 'Admin User' })
  }),

  http.get('/v1/webhooks', () => {
    calls.push(`webhooks:${sessionValid ? 200 : 401}`)
    if (!sessionValid) return HttpResponse.json(apiErrorBody(401), { status: 401 })
    return HttpResponse.json({
      data: [],
      paging: { pages: { current: 1, last: 1 }, results: { total: 0, limitation: 10 } },
    })
  }),
)

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' })
  server.events.on('request:start', ({ request }) => requests.push(request))
})
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('protected requests', () => {
  it('rotates the session once when two requests get 401, then both succeed', async () => {
    const [me, webhooks] = await Promise.all([getMe(), listWebhooks()])

    expect(me.email).toBe('admin@mail.com')
    expect(webhooks.paging.results.total).toBe(0)

    expect(calls.filter((c) => c === 'rotate')).toHaveLength(1)
    expect(calls.filter((c) => c.endsWith(':401')).sort()).toEqual(['me:401', 'webhooks:401'])
    expect(calls.filter((c) => c.endsWith(':200')).sort()).toEqual(['me:200', 'webhooks:200'])
    expect(calls.indexOf('rotate')).toBeGreaterThan(Math.max(calls.indexOf('me:401'), calls.indexOf('webhooks:401')))
    expect(calls.indexOf('rotate')).toBeLessThan(Math.min(calls.indexOf('me:200'), calls.indexOf('webhooks:200')))

    for (const request of requests) {
      expect(request.headers.get('X-Requested-With')).toBe('XMLHttpRequest')
    }
    const protectedUrls = requests.map((r) => new URL(r.url)).filter((url) => url.pathname.startsWith('/v1/'))
    expect(protectedUrls).toHaveLength(4)
    for (const url of protectedUrls) expect(url.searchParams.has('fingerprint')).toBe(false)
  })
})
