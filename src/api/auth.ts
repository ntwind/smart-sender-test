import { getFingerprint } from '../fingerprint'
import {
  clearClientState,
  getDeviceSessionToken,
  request,
  setDeviceSessionToken,
  type SessionResponse,
} from './client'

export { rotateSession } from './client'

const CAPTCHA_HEADER = 'X-Captcha-Token'

export type LoginCredentials = { email: string; password: string }

type LoginResponse = { device_session_token: string }

function getCaptchaToken() {
  return 'dev-captcha-token'
}

export async function login({ email, password }: LoginCredentials) {
  const { device_session_token } = await request<LoginResponse>('POST', '/auth/login', {
    body: { email, password, fingerprint: getFingerprint() },
    headers: { [CAPTCHA_HEADER]: getCaptchaToken() },
  })
  setDeviceSessionToken(device_session_token)
  await issueSession()
}

export function issueSession() {
  return request<SessionResponse>('POST', '/auth/token/issue', {
    body: { device_session_token: getDeviceSessionToken(), fingerprint: getFingerprint() },
  })
}

export async function logout() {
  try {
    await request<void>('POST', '/auth/token/revoke', { body: { fingerprint: getFingerprint() } })
  } finally {
    clearClientState()
  }
}
