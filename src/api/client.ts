import { getFingerprint } from '../fingerprint'
import { ApiError } from './errors'

const CSRF_HEADER = 'X-CSRF-TOKEN'
const REQUESTED_WITH_HEADER = 'X-Requested-With'

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

type RequestOptions = {
  body?: unknown
  headers?: Record<string, string>
  auth?: boolean
}

export type SessionResponse = { expires_in: number }

let csrfToken: string | null = null
let csrfRequest: Promise<string> | null = null
let deviceSessionToken: string | null = null
let rotateRequest: Promise<SessionResponse> | null = null
let sessionGeneration = 0
const sessionEndedListeners = new Set<() => void>()

export function onSessionEnded(listener: () => void) {
  sessionEndedListeners.add(listener)
  return () => {
    sessionEndedListeners.delete(listener)
  }
}

export function getDeviceSessionToken() {
  return deviceSessionToken
}

export function setDeviceSessionToken(token: string | null) {
  deviceSessionToken = token
}

export function clearClientState() {
  deviceSessionToken = null
  csrfToken = null
}

function endSession() {
  clearClientState()
  sessionEndedListeners.forEach((listener) => listener())
}

async function fetchCsrfToken(): Promise<string> {
  const init: RequestInit = { credentials: 'same-origin', headers: { [REQUESTED_WITH_HEADER]: 'XMLHttpRequest' } }
  let response = await fetch('/csrf', init)
  if (response.status === 419) response = await fetch('/csrf', init)
  if (!response.ok) throw await ApiError.fromResponse(response)
  const token = response.headers.get(CSRF_HEADER)
  if (!token) throw new ApiError(response.status, null)
  return token
}

function getCsrfToken(): Promise<string> {
  if (csrfToken) return Promise.resolve(csrfToken)
  csrfRequest ??= fetchCsrfToken()
    .then((token) => (csrfToken = token))
    .finally(() => (csrfRequest = null))
  return csrfRequest
}

async function send(method: Method, path: string, { body, headers = {} }: RequestOptions) {
  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    [REQUESTED_WITH_HEADER]: 'XMLHttpRequest',
    ...headers,
  }
  if (body !== undefined) finalHeaders['Content-Type'] = 'application/json'
  if (method !== 'GET') finalHeaders[CSRF_HEADER] = await getCsrfToken()

  return fetch(path, {
    method,
    headers: finalHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  })
}

async function execute<T>(method: Method, path: string, options: RequestOptions): Promise<T> {
  let response = await send(method, path, options)

  // Stale CSRF token: fetch a fresh one and retry once.
  if (response.status === 419) {
    csrfToken = null
    response = await send(method, path, options)
  }

  if (!response.ok) throw await ApiError.fromResponse(response)
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export function rotateSession(): Promise<SessionResponse> {
  rotateRequest ??= execute<SessionResponse>('POST', '/auth/token/rotate', {
    body: { fingerprint: getFingerprint() },
  })
    .then((result) => {
      sessionGeneration++
      return result
    })
    .catch((err) => {
      endSession()
      throw err
    })
    .finally(() => (rotateRequest = null))
  return rotateRequest
}

export async function request<T>(method: Method, path: string, options: RequestOptions = {}): Promise<T> {
  const generation = sessionGeneration
  try {
    return await execute<T>(method, path, options)
  } catch (err) {
    if (!options.auth || !(err instanceof ApiError) || err.status !== 401) throw err
  }

  // A 401 that arrives after another request already rotated just needs a retry.
  if (generation === sessionGeneration) await rotateSession()
  try {
    return await execute<T>(method, path, options)
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) endSession()
    throw err
  }
}
