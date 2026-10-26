import { useEffect, useState } from 'react'
import './App.css'
import * as auth from './api/auth'
import { onSessionEnded } from './api/client'
import { getMe, type User } from './api/user'
import { LoginPage } from './pages/LoginPage'
import { DataListPage } from './pages/DataListPage'

function App() {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => onSessionEnded(() => setUser(null)), [])

  if (!user) {
    return (
      <LoginPage
        onSubmit={async (credentials) => {
          await auth.login(credentials)
          setUser(await getMe())
        }}
      />
    )
  }

  return (
    <DataListPage
      user={user}
      onLogout={() => {
        auth.logout()
          .catch((err) => console.warn('[logout] revoke failed', err))
          .finally(() => setUser(null))
      }}
    />
  )
}

export default App
