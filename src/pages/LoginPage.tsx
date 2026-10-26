import { useState, type FormEvent } from 'react'
import { ApiError } from '../api/errors'
import type { LoginCredentials } from '../api/auth'
import './pages.css'

type Props = {
  onSubmit: (credentials: LoginCredentials) => Promise<void>
}

type FieldErrors = Partial<Record<keyof LoginCredentials, string>>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate({ email, password }: LoginCredentials): FieldErrors {
  const errors: FieldErrors = {}
  if (!email) errors.email = 'Email is required.'
  else if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address.'
  if (!password) errors.password = 'Password is required.'
  return errors
}

function describeError(err: unknown): { form: string | null; fields: FieldErrors } {
  if (!(err instanceof ApiError)) {
    return { form: 'Network error. Check your connection and try again.', fields: {} }
  }

  switch (err.type) {
    case 'ValidationException': {
      const fields: FieldErrors = { email: err.fieldError('email'), password: err.fieldError('password') }
      const other = Object.keys(err.payload ?? {}).filter((key) => key !== 'email' && key !== 'password')
      return { form: other.length ? err.message : null, fields }
    }
    case 'TokenMismatchException':
      return { form: 'Your session expired. Please try again.', fields: {} }
    case 'BadRequestException':
      return { form: 'Request was rejected. Please reload the page and try again.', fields: {} }
    default:
      return { form: 'Something went wrong. Please try again.', fields: {} }
  }
}

export function LoginPage({ onSubmit }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const credentials = { email: email.trim(), password }
    const clientErrors = validate(credentials)
    setFormError(null)
    setFieldErrors(clientErrors)
    if (Object.keys(clientErrors).length) return

    setIsSubmitting(true)
    try {
      await onSubmit(credentials)
    } catch (err) {
      const { form, fields } = describeError(err)
      setFormError(form)
      setFieldErrors(fields)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="page">
      <h1>Log in</h1>
      <form className="form" onSubmit={handleSubmit} noValidate>
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            aria-invalid={!!fieldErrors.email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {fieldErrors.email && <small className="field-error">{fieldErrors.email}</small>}
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            aria-invalid={!!fieldErrors.password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {fieldErrors.password && <small className="field-error">{fieldErrors.password}</small>}
        </label>
        {formError && <p className="form-error" role="alert">{formError}</p>}
        <button className="button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </section>
  )
}
