import { formatTime } from '../lib/format'
import type { Track } from '../lib/types'
import type { ReactNode } from 'react'
import { MoreIcon, MusicIcon } from './Icons'

type Props = {
  track: Track
  active?: boolean
  playing?: boolean
  index?: number
  onPlay: () => void
  onMenu?: () => void
  meta?: string
  /** extra control shown before the overflow menu (e.g. save for offline) */
  action?: ReactNode
}

export function TrackRow({ track, active, playing, index, onPlay, onMenu, meta, action }: Props) {
  return (
    <div className={`row ${active ? 'is-active' : ''}`}>
      <button className="row__main" onClick={onPlay} aria-label={`Riproduci ${track.title}`}>
        {typeof index === 'number' && <span className="row__index">{index}</span>}
        <span className="row__art">
          {track.artUrl ? (
            <img src={track.artUrl} alt="" loading="lazy" />
          ) : (
            <span className="row__art-fallback">
              <MusicIcon size={18} />
            </span>
          )}
          {active && (
            <span className={`row__eq ${playing ? 'is-on' : ''}`} aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          )}
        </span>
        <span className="row__text">
          <span className="row__title">{track.title}</span>
          <span className="row__sub">{meta ?? `${track.artist} · ${track.album}`}</span>
        </span>
        <span className="row__time">{formatTime(track.duration)}</span>
      </button>
      {action}
      {onMenu && (
        <button className="row__more" onClick={onMenu} aria-label={`Opzioni per ${track.title}`}>
          <MoreIcon size={20} />
        </button>
      )}
    </div>
  )
}
