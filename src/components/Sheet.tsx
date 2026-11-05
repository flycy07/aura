import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { CloseIcon } from './Icons'

type Props = {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

export function Sheet({ open, onClose, title, children }: Props) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose, open])

  if (!open) return null

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={title ?? 'Opzioni'}>
      <button className="sheet__scrim" onClick={onClose} aria-label="Chiudi" />
      <div className="sheet__panel glass glass--thick">
        <span className="sheet__grab" aria-hidden="true" />
        <div className="sheet__head">
          {title ? <h2 className="sheet__title">{title}</h2> : <span />}
          <button className="icon-btn glass glass--circle sheet__close" onClick={onClose} aria-label="Chiudi">
            <CloseIcon size={18} />
          </button>
        </div>
        <div className="sheet__body">{children}</div>
      </div>
    </div>
  )
}
