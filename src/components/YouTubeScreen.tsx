import { useEffect, useState } from 'react'
import type { RefObject } from 'react'
import type { Playlist } from '../lib/types'
import type { YouTubeVideo } from '../lib/youtube'
import { YouTubePlayer } from './YouTubePlayer'
import type { YouTubePlayerHandle } from './YouTubePlayer'
import { GlassSlider } from './GlassSlider'
import { Sheet } from './Sheet'
import {
  CheckIcon,
  ChevronDownIcon,
  MoreIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  PrevIcon,
} from './Icons'
import { formatTime } from '../lib/format'

type Props = {
  video: YouTubeVideo
  /** Copertina ufficiale del brano/album, quando la ricerca la trova. */
  coverUrl?: string
  /**
   * Ridotta nella barra in basso: il componente resta montato (solo opacità e
   * tocchi cambiano) così il player YouTube non si ricarica e continua a suonare.
   */
  minimized: boolean
  playing: boolean
  playerRef: RefObject<YouTubePlayerHandle | null>
  onTogglePlay: () => void
  onMinimize: () => void
  onPrevious?: () => void
  onNext?: () => void
  /** Video finito: l'app passa al successivo della coda. */
  onEnded?: () => void
  onPlayStateChange?: (playing: boolean) => void
  /** Playlist dell'utente: se presenti compare il pulsante “+”. */
  playlists?: Playlist[]
  onToggleVideo?: (playlistId: string, video: YouTubeVideo) => Promise<unknown> | void
  onCreatePlaylist?: (name: string) => Promise<Playlist>
}

export function YouTubeScreen({
  video,
  coverUrl,
  minimized,
  playing,
  playerRef,
  onTogglePlay,
  onMinimize,
  onPrevious,
  onNext,
  onEnded,
  onPlayStateChange,
  playlists = [],
  onToggleVideo,
  onCreatePlaylist,
}: Props) {
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(video.seconds)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onMinimize()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onMinimize])

  useEffect(() => {
    setPosition(0)
    setDuration(video.seconds)
  }, [video.id, video.seconds])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const api = playerRef.current
      if (!api) return
      setPosition(api.getTime())
      const total = api.getDuration()
      if (total > 0) setDuration(total)
    }, 500)
    return () => window.clearInterval(timer)
  }, [playerRef, video.id])

  const createWithVideo = async () => {
    const name = newName.trim()
    if (!name || !onCreatePlaylist) return
    const playlist = await onCreatePlaylist(name)
    if (onToggleVideo) await onToggleVideo(playlist.id, video)
    setNewName('')
    setFeedback(`Aggiunto a “${playlist.name}”`)
  }

  return (
    <section
      className={`ytnp ${minimized ? 'is-mini' : ''}`}
      aria-label={`Player YouTube: ${video.title}`}
      aria-hidden={minimized}
    >
      <header className="ytnp__head">
        <button
          className="icon-btn glass glass--circle"
          onClick={onMinimize}
          aria-label="Riduci il player: la riproduzione continua"
        >
          <ChevronDownIcon size={22} />
        </button>
        <span className="ytnp__badge">YouTube · player ufficiale</span>
      </header>

      <YouTubePlayer
        key={video.id}
        ref={playerRef}
        videoId={video.id}
        title={video.title}
        full
        onEnded={onEnded}
        onPlayStateChange={onPlayStateChange}
      />

      <div className="ytnp__row">
        {coverUrl && <img className="ytnp__art" src={coverUrl} alt="" />}
        <div className="ytnp__meta">
          <h2 className="ytnp__title">{video.title}</h2>
          <p className="ytnp__channel">{video.channel}</p>
        </div>
        <div className="ytnp__actions">
          {onToggleVideo && (
            <button
              className="icon-btn glass glass--circle"
              onClick={() => {
                setFeedback('')
                setSheetOpen(true)
              }}
              aria-label="Aggiungi a una playlist"
            >
              <PlusIcon size={22} />
            </button>
          )}
          <a
            className="icon-btn glass glass--circle"
            href={`https://www.youtube.com/watch?v=${video.id}`}
            target="_blank"
            rel="noreferrer"
            aria-label="Apri in YouTube"
          >
            <MoreIcon size={22} />
          </a>
        </div>
      </div>

      <div className="ytnp__seek">
        <GlassSlider
          value={position}
          max={duration || 1}
          onChange={(value) => {
            playerRef.current?.seekTo(value)
            setPosition(value)
          }}
          label="Posizione del brano"
          formatValue={formatTime}
        />
        <div className="ytnp__times">
          <span>{formatTime(position)}</span>
          <span>-{formatTime(Math.max(duration - position, 0))}</span>
        </div>
      </div>

      <div className="np__controls glass glass--thick">
        <button
          className="np__btn np__btn--side"
          onClick={onPrevious}
          disabled={!onPrevious}
          aria-label="Video precedente"
        >
          <PrevIcon size={25} />
        </button>
        <button
          className="np__play glass glass--circle"
          onClick={onTogglePlay}
          aria-label={playing ? 'Pausa' : 'Riproduci'}
        >
          {playing ? <PauseIcon size={28} /> : <PlayIcon size={28} />}
        </button>
        <button
          className="np__btn np__btn--side"
          onClick={onNext}
          disabled={!onNext}
          aria-label="Video successivo"
        >
          <NextIcon size={25} />
        </button>
      </div>

      <a
        className="ghost-btn ytnp__open"
        href={`https://www.youtube.com/watch?v=${video.id}`}
        target="_blank"
        rel="noreferrer"
      >
        Apri in YouTube
      </a>

      {onToggleVideo && (
        <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Aggiungi a playlist">
          <div className="menu">
            <p className="menu__hint">
              La playlist può contenere sia brani della libreria sia video YouTube.
            </p>
            {playlists.map((playlist) => {
              const has = playlist.videos.some((item) => item.id === video.id)
              return (
                <button
                  key={playlist.id}
                  className="menu__item"
                  onClick={() => {
                    setFeedback(has ? `Tolto da “${playlist.name}”` : `Aggiunto a “${playlist.name}”`)
                    void onToggleVideo(playlist.id, video)
                  }}
                >
                  <span className={`menu__check ${has ? 'is-on' : ''}`}>
                    {has ? <CheckIcon size={16} /> : <PlusIcon size={16} />}
                  </span>
                  <span className="menu__text">{playlist.name}</span>
                  <span className="menu__count">
                    {playlist.trackIds.length + playlist.videos.length}
                  </span>
                </button>
              )
            })}

            {onCreatePlaylist && (
              <div className="menu__create">
                <input
                  className="menu__input"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void createWithVideo()
                  }}
                  placeholder="Nuova playlist"
                  aria-label="Nome della nuova playlist"
                  maxLength={60}
                />
                <button
                  className="primary-btn primary-btn--small"
                  onClick={() => void createWithVideo()}
                  disabled={!newName.trim()}
                >
                  Crea
                </button>
              </div>
            )}

            {feedback && <p className="ytnp__feedback">{feedback}</p>}
          </div>
        </Sheet>
      )}
    </section>
  )
}
