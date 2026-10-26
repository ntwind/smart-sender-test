import { request } from './client'

export type User = {
  id: number
  email: string
  first_name: string
  last_name: string
  name: string
}

export function getMe() {
  return request<User>('GET', '/v1/me', { auth: true })
}
