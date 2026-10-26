import { useEffect } from 'react'
import type { User } from '../api/user'
import type { Paging } from '../api/webhooks'
import { useListParams } from '../useListParams'
import { useWebhooks } from '../useWebhooks'
import { EditWebhookModal } from './EditWebhookModal'
import { SearchBox } from './SearchBox'
import { Spinner } from './Spinner'
import './pages.css'

type Props = {
  user: User
  onLogout?: () => void
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export function DataListPage({ user, onLogout }: Props) {
  const { page, search, edit, setPage, setSearch, openEdit, closeEdit } = useListParams()
  const { data, error, isLoading, retry } = useWebhooks(page, search)

  const last = data?.paging.pages.last
  useEffect(() => {
    if (!isLoading && last && page > last) setPage(last, { replace: true })
  }, [isLoading, last, page, setPage])

  return (
    <section className="page">
      <header className="page-header">
        <h1>Webhooks</h1>
        <div className="user-badge">
          <div className="user-info">
            <span className="user-name">{user.name}</span>
            <span className="user-email">{user.email}</span>
          </div>
          {onLogout && (
            <button className="button button-secondary" type="button" onClick={onLogout}>
              Log out
            </button>
          )}
        </div>
      </header>

      <SearchBox
        value={search}
        onSearch={setSearch}
        placeholder="Search by name or URL"
        isLoading={isLoading && !!data}
      />

      {error ? (
        <div className="list-status">
          <p className="form-error" role="alert">Couldn't load webhooks.</p>
          <button className="button" type="button" onClick={retry}>
            Try again
          </button>
        </div>
      ) : !data || (isLoading && data.data.length === 0) ? (
        <div className="list-status" role="status">
          <Spinner size={32} label="" />
          <span>Loading webhooks…</span>
        </div>
      ) : data.data.length === 0 ? (
        <p className="list-status">
          {search ? `No webhooks match “${search}”.` : 'No webhooks yet.'}
        </p>
      ) : (
        <div className="data-list-wrap">
          {isLoading && (
            <div className="data-list-overlay">
              <Spinner size={32} label="Loading webhooks" />
            </div>
          )}
          <ul className="data-list" aria-busy={isLoading}>
            {data.data.map((webhook) => (
              <li key={webhook.id}>
                <div className="data-row">
                  <span className="data-title">{webhook.name}</span>
                  <div className="data-row-actions">
                    <span className={`status-badge ${webhook.active ? 'is-active' : ''}`}>
                      {webhook.active ? 'Active' : 'Inactive'}
                    </span>
                    <button
                      className="button button-secondary button-small"
                      type="button"
                      aria-label={`Edit ${webhook.name}`}
                      onClick={() => openEdit(webhook.id)}
                    >
                      Edit
                    </button>
                  </div>
                </div>
                <code className="data-url">{webhook.url}</code>
                <time className="data-meta" dateTime={webhook.created_at}>
                  Created {dateFormat.format(new Date(webhook.created_at))}
                </time>
              </li>
            ))}
          </ul>
          <Pagination paging={data.paging} disabled={isLoading} onChange={setPage} />
        </div>
      )}

      {edit && (
        <EditWebhookModal
          key={edit}
          id={edit}
          onClose={closeEdit}
          onSaved={() => {
            closeEdit()
            retry()
          }}
        />
      )}
    </section>
  )
}

type PaginationProps = {
  paging: Paging
  disabled: boolean
  onChange: (page: number) => void
}

function Pagination({ paging, disabled, onChange }: PaginationProps) {
  const { current: page, last } = paging.pages
  const { total, limitation } = paging.results
  const from = (page - 1) * limitation + 1
  const to = Math.min(page * limitation, total)

  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        className="button button-secondary"
        type="button"
        disabled={disabled || page <= 1}
        onClick={() => onChange(page - 1)}
      >
        ← Previous
      </button>
      <span className="pagination-info">
        {disabled ? (
          <>
            <Spinner size={14} label="" />
            Loading…
          </>
        ) : (
          `Page ${page} of ${last} · ${from}–${to} of ${total}`
        )}
      </span>
      <button
        className="button button-secondary"
        type="button"
        disabled={disabled || page >= last}
        onClick={() => onChange(page + 1)}
      >
        Next →
      </button>
    </nav>
  )
}
