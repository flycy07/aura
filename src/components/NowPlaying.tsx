import { formatTime } from '../lib/format'
import type { RepeatMode, Track } from '../lib/types'
import { GlassSlider } from './GlassSlider'
import {
  ChevronDownIcon,
  MusicIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PrevIcon,
  QueueIcon,
  RepeatIcon,
  ShuffleIcon,
} from './Icons'

type Props = {
  track: Track
  isPlaying: boolean
  position: number
  duration: number
  shuffle: boolean
  repeat: RepeatMode
  volume: number
  onClose: () => void
  onTogglePlay: () => void
  onNext: () => void
  onPrevious: () => void
  onSeek: (value: number) => void
  onSetVolume: (value: number) => void
  onToggleShuffle: () => void
  onCycleRepeat: () => void
  onOpenQueue: () => void
  /** diretta radio: niente seek, il brano non ha durata */
  live?: boolean
}

export function NowPlaying({
  track,
  isPlaying,
  position,
  duration,
  shuffle,
  repeat,
  volume,
  onClose,
  onTogglePlay,
  onNext,
  onPrevious,
  onSeek,
  onSetVolume,
  onToggleShuffle,
  onCycleRepeat,
  onOpenQueue,
  live,
}: Props) {
  const remaining = Math.max(duration - position, 0)

  return (
    <section className="np" aria-label="In riproduzione">
      <div
        className="np__bg"
        style={track.artUrl ? { backgroundImage: `url(${track.artUrl})` } : undefined}
        aria-hidden="true"
      />
      <div className="np__scrim" aria-hidden="true" />

      <header className="np__head">
        <button className="icon-btn glass glass--circle" onClick={onClose} aria-label="Chiudi il lettore">
          <ChevronDownIcon size={22} />
        </button>
        <div className="np__head-label">
          <span className="np__eyebrow">In riproduzione</span>
          <span className="np__album">{track.album}</span>
        </div>
        <button
          className="icon-btn glass glass--circle"
          onClick={onOpenQueue}
          aria-label="Coda di riproduzione"
        >
          <QueueIcon size={22} />
        </button>
      </header>

      <div className="np__art-wrap">
        <div className={`np__art ${isPlaying ? 'is-playing' : ''}`}>
          {track.artUrl ? (
            <img src={track.artUrl} alt={`Copertina di ${track.album}`} />
          ) : (
            <div className="np__art-fallback">
              <MusicIcon size={58} />
            </div>
          )}
          <span className="np__sheen" aria-hidden="true" />
        </div>
      </div>

      <div className="np__meta">
        <h2 className="np__title">{track.title}</h2>
        <p className="np__artist">{track.artist}</p>
      </div>

      {live ? (
        <div className="np__live">
          <span className="np__live-dot" aria-hidden="true" />
          Diretta
        </div>
      ) : (
        <div className="np__seek">
          <GlassSlider
            value={position}
            max={duration}
            onChange={onSeek}
            label="Posizione del brano"
            formatValue={formatTime}
          />
          <div className="np__times">
            <span>{formatTime(position)}</span>
            <span>-{formatTime(remaining)}</span>
          </div>
        </div>
      )}

      <div className="np__controls glass glass--thick">
        <button
          className={`np__btn np__btn--side ${shuffle ? 'is-on' : ''}`}
          onClick={onToggleShuffle}
          aria-pressed={shuffle}
          aria-label="Riproduzione casuale"
        >
          <ShuffleIcon size={21} />
        </button>
        <button className="np__btn" onClick={onPrevious} aria-label="Brano precedente">
          <PrevIcon size={27} />
        </button>
        <button
          className="np__play glass glass--circle"
          onClick={onTogglePlay}
          aria-label={isPlaying ? 'Pausa' : 'Riproduci'}
        >
          {isPlaying ? <PauseIcon size={30} /> : <PlayIcon size={30} />}
        </button>
        <button className="np__btn" onClick={onNext} aria-label="Brano successivo">
          <NextIcon size={27} />
        </button>
        <button
          className={`np__btn np__btn--side ${repeat !== 'off' ? 'is-on' : ''}`}
          onClick={onCycleRepeat}
          aria-label={`Ripetizione: ${repeat === 'off' ? 'disattivata' : repeat === 'all' ? 'tutta la coda' : 'brano singolo'}`}
        >
          <RepeatIcon size={21} repeatOne={repeat === 'one'} />
        </button>
      </div>

      <div className="np__volume">
        <GlassSlider
          value={volume}
          max={1}
          onChange={onSetVolume}
          live
          compact
          label="Volume"
        />
      </div>
    </section>
  )
}
