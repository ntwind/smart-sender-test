import { delay, http, HttpResponse } from 'msw'
import { apiErrorBody, type ApiErrorStatus, type ValidationPayload } from '../api/errors'
import type { Webhook, WebhookList } from '../api/webhooks'
import { USERS } from './users'
import { WEBHOOKS, type MockWebhook } from './webhooks'

const CSRF_HEADER = 'X-CSRF-TOKEN'
const CSRF_TOKEN = 'mock-csrf-token-5f2c9a1e'
const CAPTCHA_HEADER = 'X-Captcha-Token'
const FINGERPRINT_RE = /^[0-9a-f]{32}$/
const SESSION_TTL_SEC = 30
const DATA_LATENCY_MS = 600

type DeviceSession = { userId: number; fingerprint: string }
type Session = { userId: number; fingerprint: string; expiresAt: number }

// In-memory backend state; resets on page reload.
const state = {
  deviceSessions: new Map<string, DeviceSession>(),
  // Stands in for the HttpOnly session cookie: the browser holds one session and the client never sees it.
  session: null as Session | null,
  webhooks: WEBHOOKS.map((w) => ({ ...w })) as MockWebhook[],
}

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 100

function toWebhook({ id, name, url, active, created_at }: MockWebhook): Webhook {
  return { id, name, url, active, created_at }
}

function positiveInt(value: string | null, fallback: number) {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : fallback
}

function findWebhook(userId: number, id: string) {
  return state.webhooks.find((w) => w.user_id === userId && String(w.id) === id)
}

function isValidUrl(value: string) {
  try {
    const { protocol } = new URL(value)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

function isFingerprint(value: unknown): value is string {
  return typeof value === 'string' && FINGERPRINT_RE.test(value)
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  const body = await request.json().catch(() => null)
  return body && typeof body === 'object' ? body : null
}

function startSession(fingerprint: string, userId: number) {
  state.session = { userId, fingerprint, expiresAt: Date.now() + SESSION_TTL_SEC * 1000 }
  return HttpResponse.json({ expires_in: SESSION_TTL_SEC })
}

function authenticate(): number | null {
  const { session } = state
  return session && session.expiresAt > Date.now() ? session.userId : null
}

function errorResponse(status: Exclude<ApiErrorStatus, 422>) {
  return HttpResponse.json(apiErrorBody(status), { status })
}

function validationError(payload: ValidationPayload) {
  return HttpResponse.json(apiErrorBody(422, payload), { status: 422 })
}

function checkCsrf(request: Request) {
  if (request.headers.get(CSRF_HEADER) === CSRF_TOKEN) return null
  return errorResponse(419)
}

function checkCaptcha(request: Request) {
  if (request.headers.get(CAPTCHA_HEADER)?.trim()) return null
  return errorResponse(400)
}

function randomHex(bytes: number) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('')
}

type LoginBody = { email?: unknown; password?: unknown; fingerprint?: unknown }

export const handlers = [
  http.get('/csrf', () => new HttpResponse(null, { status: 204, headers: { [CSRF_HEADER]: CSRF_TOKEN } })),

  http.post<never, LoginBody>('/auth/login', async ({ request }) => {
    const rejected = checkCsrf(request) ?? checkCaptcha(request)
    if (rejected) return rejected

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') return errorResponse(400)
    const { email, password, fingerprint } = body

    const invalid: ValidationPayload = {}
    if (typeof email !== 'string' || !email.trim()) invalid.email = ['The email field is required.']
    if (typeof password !== 'string' || !password) invalid.password = ['The password field is required.']
    if (typeof fingerprint !== 'string' || !FINGERPRINT_RE.test(fingerprint)) {
      invalid.fingerprint = ['The fingerprint must be 32 hex characters.']
    }
    if (Object.keys(invalid).length) return validationError(invalid)

    const user = USERS.find(
      (u) => u.email === (email as string).trim().toLowerCase() && u.password === password,
    )
    if (!user) return validationError({ password: ['The provided credentials are incorrect.'] })

    const device_session_token = randomHex(32)
    state.deviceSessions.set(device_session_token, { userId: user.id, fingerprint: fingerprint as string })
    return HttpResponse.json({ device_session_token })
  }),

  http.post('/auth/token/issue', async ({ request }) => {
    const rejected = checkCsrf(request)
    if (rejected) return rejected

    const body = await readBody(request)
    if (!body) return errorResponse(400)
    const { device_session_token, fingerprint } = body

    const invalid: ValidationPayload = {}
    if (typeof device_session_token !== 'string' || !device_session_token) {
      invalid.device_session_token = ['The device session token field is required.']
    }
    if (!isFingerprint(fingerprint)) invalid.fingerprint = ['The fingerprint must be 32 hex characters.']
    if (Object.keys(invalid).length) return validationError(invalid)

    const deviceSession = state.deviceSessions.get(device_session_token as string)
    if (!deviceSession || deviceSession.fingerprint !== fingerprint) {
      return validationError({ device_session_token: ['The device session token is invalid.'] })
    }

    return startSession(fingerprint as string, deviceSession.userId)
  }),

  http.post('/auth/token/rotate', async ({ request }) => {
    const rejected = checkCsrf(request)
    if (rejected) return rejected

    const body = await readBody(request)
    if (!body || !isFingerprint(body.fingerprint)) return errorResponse(400)

    const { session } = state
    if (!session || session.fingerprint !== body.fingerprint) return errorResponse(400)

    return startSession(session.fingerprint, session.userId)
  }),

  http.post('/auth/token/revoke', async ({ request }) => {
    const rejected = checkCsrf(request)
    if (rejected) return rejected

    const body = await readBody(request)
    if (body && isFingerprint(body.fingerprint)) {
      const fingerprint = body.fingerprint
      if (state.session?.fingerprint === fingerprint) state.session = null
      for (const [token, device] of state.deviceSessions) {
        if (device.fingerprint === fingerprint) state.deviceSessions.delete(token)
      }
    }
    return new HttpResponse(null, { status: 204 })
  }),

  http.get('/v1/me', () => {
    const userId = authenticate()
    const user = userId && USERS.find((u) => u.id === userId)
    if (!user) return errorResponse(401)

    const { id, email, first_name, last_name } = user
    return HttpResponse.json({ id, email, first_name, last_name, name: `${first_name} ${last_name}` })
  }),

  http.get('/v1/webhooks', async ({ request }) => {
    await delay(DATA_LATENCY_MS)
    const userId = authenticate()
    if (!userId) return errorResponse(401)

    const params = new URL(request.url).searchParams
    const limit = Math.min(positiveInt(params.get('limit'), DEFAULT_LIMIT), MAX_LIMIT)
    const page = positiveInt(params.get('page'), 1)
    const search = params.get('search')?.trim().toLowerCase() ?? ''

    const matching = state.webhooks.filter(
      (w) =>
        w.user_id === userId &&
        (!search || w.name.toLowerCase().includes(search) || w.url.toLowerCase().includes(search)),
    )
    const start = (page - 1) * limit

    const body: WebhookList = {
      data: matching.slice(start, start + limit).map(toWebhook),
      paging: {
        pages: { current: page, last: Math.max(1, Math.ceil(matching.length / limit)) },
        results: { total: matching.length, limitation: limit },
      },
    }
    return HttpResponse.json(body)
  }),

  http.get<{ id: string }>('/v1/webhooks/:id', async ({ params }) => {
    await delay(DATA_LATENCY_MS)
    const userId = authenticate()
    if (!userId) return errorResponse(401)

    const webhook = findWebhook(userId, params.id)
    if (!webhook) return errorResponse(404)
    return HttpResponse.json(toWebhook(webhook))
  }),

  http.put<{ id: string }>('/v1/webhooks/:id', async ({ request, params }) => {
    await delay(DATA_LATENCY_MS)
    const rejected = checkCsrf(request)
    if (rejected) return rejected

    const userId = authenticate()
    if (!userId) return errorResponse(401)

    const webhook = findWebhook(userId, params.id)
    if (!webhook) return errorResponse(404)

    const body = await readBody(request)
    if (!body) return errorResponse(400)
    const { name, url } = body

    const invalid: ValidationPayload = {}
    if (typeof name !== 'string' || !name.trim()) invalid.name = ['The name field is required.']
    else if (name.trim().length > 255) invalid.name = ['The name may not be greater than 255 characters.']
    if (typeof url !== 'string' || !url.trim()) invalid.url = ['The url field is required.']
    else if (!isValidUrl(url.trim())) invalid.url = ['The url must be a valid URL.']
    if (Object.keys(invalid).length) return validationError(invalid)

    webhook.name = (name as string).trim()
    webhook.url = (url as string).trim()
    return HttpResponse.json(toWebhook(webhook))
  }),
]
