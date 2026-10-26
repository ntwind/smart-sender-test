import { useEffect, useState, type FormEvent } from 'react'
import { Spinner } from './Spinner'

type Props = {
  value: string
  onSearch: (value: string) => void
  placeholder?: string
  debounceMs?: number
  isLoading?: boolean
}

export function SearchBox({ value, onSearch, placeholder, debounceMs = 300, isLoading = false }: Props) {
  const [input, setInput] = useState(value)
  const [syncedValue, setSyncedValue] = useState(value)
  const [lastSent, setLastSent] = useState(value)

  // Value changed from outside (e.g. Back/Forward) — reflect it in the input.
  if (value !== syncedValue) {
    setSyncedValue(value)
    if (value !== lastSent.trim()) setInput(value)
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setLastSent(input)
      onSearch(input)
    }, debounceMs)
    return () => clearTimeout(timer)
  }, [input, onSearch, debounceMs])

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLastSent(input)
    onSearch(input)
  }

  return (
    <form className="search-box" role="search" onSubmit={handleSubmit}>
      <input
        type="search"
        aria-label={placeholder ?? 'Search'}
        placeholder={placeholder}
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />
      {isLoading && <Spinner size={16} label="Searching" className="search-box-spinner" />}
    </form>
  )
}
