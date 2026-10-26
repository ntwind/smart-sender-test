export type MockUser = {
  id: number
  email: string
  password: string
  first_name: string
  last_name: string
}

export const USERS: readonly MockUser[] = [
  { id: 1, email: 'admin@mail.com', password: 'admin123', first_name: 'UName', last_name: 'ULastName' },
]
