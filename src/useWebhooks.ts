import { useCallback, useEffect, useState } from 'react'
import { listWebhooks, type WebhookList } from './api/webhooks'

type Result = { key: string; data?: WebhookList; error?: unknown }

export function useWebhooks(page: number, search: string) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const key = JSON.stringify([page, search, attempt])

  useEffect(() => {
    let cancelled = false
    listWebhooks({ page, search }).then(
      (data) => !cancelled && setResult({ key, data }),
      (error) => !cancelled && setResult({ key, error }),
    )
    return () => {
      cancelled = true
    }
  }, [page, search, key])

  const isCurrent = result?.key === key
  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  return {
    data: result?.data,
    error: isCurrent ? result.error : undefined,
    isLoading: !isCurrent,
    retry,
  }
}
