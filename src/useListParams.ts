import { useCallback, useEffect, useState } from 'react'

export type ListParams = { page: number; search: string; edit: number | null }

function positiveInt(value: string | null) {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}

function readParams(): ListParams {
  const params = new URLSearchParams(window.location.search)
  return {
    page: positiveInt(params.get('page')) ?? 1,
    search: params.get('search')?.trim() ?? '',
    edit: positiveInt(params.get('edit')),
  }
}

type HistoryState = { modal?: boolean } | null

export function useListParams() {
  const [params, setParamsState] = useState(readParams)

  useEffect(() => {
    const onPopState = () => setParamsState(readParams())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const update = useCallback((next: ListParams, replace: boolean, state: HistoryState = null) => {
    const url = new URL(window.location.href)
    if (next.page > 1) url.searchParams.set('page', String(next.page))
    else url.searchParams.delete('page')
    if (next.search) url.searchParams.set('search', next.search)
    else url.searchParams.delete('search')
    if (next.edit) url.searchParams.set('edit', String(next.edit))
    else url.searchParams.delete('edit')
    if (url.href !== window.location.href) {
      window.history[replace ? 'replaceState' : 'pushState'](state, '', url)
    }
    setParamsState(next)
  }, [])

  const setPage = useCallback(
    (page: number, { replace = false } = {}) => update({ ...readParams(), page: Math.max(1, page) }, replace),
    [update],
  )

  const setSearch = useCallback(
    (search: string) => {
      const trimmed = search.trim()
      if (trimmed !== readParams().search) update({ ...readParams(), page: 1, search: trimmed }, true)
    },
    [update],
  )

  const openEdit = useCallback((id: number) => update({ ...readParams(), edit: id }, false, { modal: true }), [update])

  const closeEdit = useCallback(() => {
    // Opened in this tab: step back so the history has no duplicate list entry.
    if ((window.history.state as HistoryState)?.modal) window.history.back()
    else update({ ...readParams(), edit: null }, true)
  }, [update])

  return { ...params, setPage, setSearch, openEdit, closeEdit }
}
