type Props = {
  size?: number
  label?: string
  className?: string
}

export function Spinner({ size = 20, label = 'Loading', className = '' }: Props) {
  const style = { width: size, height: size }
  if (!label) return <span className={`spinner ${className}`} style={style} aria-hidden="true" />

  return (
    <span className={`spinner ${className}`} role="status" style={style}>
      <span className="visually-hidden">{label}</span>
    </span>
  )
}
