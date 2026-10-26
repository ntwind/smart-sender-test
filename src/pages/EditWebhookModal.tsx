import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ApiError } from '../api/errors'
import { getWebhook, updateWebhook, type Webhook, type WebhookUpdate } from '../api/webhooks'
import { Spinner } from './Spinner'

type Props = {
  id: number
  onClose: () => void
  onSaved: (webhook: Webhook) => void
}

type FieldErrors = Partial<Record<keyof WebhookUpdate, string>>

type Loaded = { id: number; webhook?: Webhook; error?: unknown }

export function EditWebhookModal({ id, onClose, onSaved }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [form, setForm] = useState<WebhookUpdate>({ name: '', url: '' })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  useEffect(() => {
    let cancelled = false
    getWebhook(id).then(
      (webhook) => {
        if (cancelled) return
        setLoaded({ id, webhook })
        setForm({ name: webhook.name, url: webhook.url })
      },
      (error) => !cancelled && setLoaded({ id, error }),
    )
    return () => {
      cancelled = true
    }
  }, [id])

  const current = loaded?.id === id ? loaded : null

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFieldErrors({})
    setFormError(null)
    setIsSaving(true)
    try {
      onSaved(await updateWebhook(id, form))
    } catch (err) {
      if (err instanceof ApiError && err.type === 'ValidationException') {
        setFieldErrors({ name: err.fieldError('name'), url: err.fieldError('url') })
      } else if (err instanceof ApiError && err.type === 'NotFoundException') {
        setFormError('This webhook no longer exists.')
      } else {
        setFormError('Could not save changes. Please try again.')
      }
    } finally {
      setIsSaving(false)
    }
  }

  const setField = (field: keyof WebhookUpdate, value: string) => {
    setForm((f) => ({ ...f, [field]: value }))
    setFieldErrors((errors) => ({ ...errors, [field]: undefined }))
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      aria-labelledby="edit-webhook-title"
      onCancel={(e) => {
        e.preventDefault()
        if (!isSaving) onClose()
      }}
    >
      <header className="modal-header">
        <h2 id="edit-webhook-title">Edit webhook</h2>
        <button className="modal-close" type="button" aria-label="Close" onClick={onClose} disabled={isSaving}>
          ×
        </button>
      </header>

      {!current ? (
        <div className="list-status" role="status">
          <Spinner size={28} label="" />
          <span>Loading webhook…</span>
        </div>
      ) : current.error ? (
        <div className="list-status">
          <p className="form-error" role="alert">
            {current.error instanceof ApiError && current.error.type === 'NotFoundException'
              ? 'Webhook not found.'
              : "Couldn't load this webhook."}
          </p>
          <button className="button button-secondary" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      ) : (
        <form className="form modal-form" onSubmit={handleSubmit} noValidate>
          <label className="field">
            <span>Name</span>
            <input
              name="name"
              value={form.name}
              aria-invalid={!!fieldErrors.name}
              disabled={isSaving}
              onChange={(e) => setField('name', e.target.value)}
              autoFocus
            />
            {fieldErrors.name && <small className="field-error">{fieldErrors.name}</small>}
          </label>
          <label className="field">
            <span>URL</span>
            <input
              name="url"
              type="url"
              inputMode="url"
              value={form.url}
              aria-invalid={!!fieldErrors.url}
              disabled={isSaving}
              onChange={(e) => setField('url', e.target.value)}
            />
            {fieldErrors.url && <small className="field-error">{fieldErrors.url}</small>}
          </label>
          {formError && <p className="form-error" role="alert">{formError}</p>}
          <div className="modal-actions">
            <button className="button button-secondary" type="button" onClick={onClose} disabled={isSaving}>
              Cancel
            </button>
            <button className="button" type="submit" disabled={isSaving}>
              {isSaving ? (
                <span className="button-busy">
                  <Spinner size={14} label="" /> Saving…
                </span>
              ) : (
                'Save'
              )}
            </button>
          </div>
        </form>
      )}
    </dialog>
  )
}
