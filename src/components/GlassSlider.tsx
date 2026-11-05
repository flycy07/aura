import { useCallback, useRef, useState } from 'react'

type Props = {
  value: number
  max: number
  onChange: (value: number) => void
  /** fire onChange continuously while dragging (volume) instead of on release (seek) */
  live?: boolean
  label: string
  formatValue?: (value: number) => string
  compact?: boolean
}

export function GlassSlider({ value, max, onChange, live, label, formatValue, compact }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const [localValue, setLocalValue] = useState(0)
  const safeMax = max > 0 ? max : 1
  const shown = dragging ? localValue : value
  const ratio = Math.min(1, Math.max(0, shown / safeMax))

  const valueFromClientX = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect()
      if (!rect || rect.width === 0) return 0
      const relative = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
      return relative * safeMax
    },
    [safeMax],
  )

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    const next = valueFromClientX(event.clientX)
    setDragging(true)
    setLocalValue(next)
    if (live) onChange(next)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    const next = valueFromClientX(event.clientX)
    setLocalValue(next)
    if (live) onChange(next)
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    setDragging(false)
    onChange(valueFromClientX(event.clientX))
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = safeMax / 40
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault()
      onChange(Math.min(safeMax, value + step))
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault()
      onChange(Math.max(0, value - step))
    }
  }

  return (
    <div
      ref={trackRef}
      className={`slider ${compact ? 'slider--compact' : ''} ${dragging ? 'is-dragging' : ''}`}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(safeMax)}
      aria-valuenow={Math.round(shown)}
      aria-valuetext={formatValue?.(shown)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
    >
      <div className="slider__rail">
        <div className="slider__fill" style={{ transform: `scaleX(${ratio})` }} />
        <div className="slider__knob" style={{ left: `${ratio * 100}%` }} />
      </div>
    </div>
  )
}
