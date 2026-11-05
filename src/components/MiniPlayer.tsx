import { formatTime } from '../lib/format'
import type { Track } from '../lib/types'
import { MusicIcon, NextIcon, PauseIcon, PlayIcon } from './Icons'

type Props = {
  track: Track
  isPlaying: boolean
  position: number
  duration: number
  onOpen: () => void
  onTogglePlay: () => void
  onNext: () => void
}

export function MiniPlayer({ track, isPlaying, position, duration, onOpen, onTogglePlay, onNext }: Props) {
  const progress = duration > 0 ? Math.min(1, position / duration) : 0

  return (
    <div className="mini glass glass--thick" data-playing={isPlaying}>
      <button className="mini__main" onClick={onOpen} aria-label="Apri il lettore">
        <span className="mini__art">
          {track.artUrl ? <img src={track.artUrl} alt="" /> : <MusicIcon size={20} />}
        </span>
        <span className="mini__text">
          <span className="mini__title">{track.title}</span>
          <span className="mini__artist">
            {track.artist}
            {duration > 0 && <span className="mini__time"> · {formatTime(position)}</span>}
          </span>
        </span>
      </button>
      <div className="mini__actions">
        <button className="mini__btn" onClick={onTogglePlay} aria-label={isPlaying ? 'Pausa' : 'Riproduci'}>
          {isPlaying ? <PauseIcon size={22} /> : <PlayIcon size={22} />}
        </button>
        <button className="mini__btn" onClick={onNext} aria-label="Brano successivo">
          <NextIcon size={22} />
        </button>
      </div>
      <span className="mini__progress" aria-hidden="true">
        <i style={{ transform: `scaleX(${progress})` }} />
      </span>
    </div>
  )
}
