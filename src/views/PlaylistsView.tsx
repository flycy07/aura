import { useState } from 'react'
import { formatTime, pluralise } from '../lib/format'
import type { Playlist, PlaylistVideo, Track } from '../lib/types'
import { ChevronLeftIcon, ListIcon, PlayIcon, PlusIcon, TrashIcon } from '../components/Icons'
import { TrackRow } from '../components/TrackRow'

type Props = {
  playlists: Playlist[]
  tracks: Track[]
  currentTrackId?: string
  isPlaying: boolean
  onPlay: (track: Track, list: Track[]) => void
  onMenu: (track: Track) => void
  onCreate: (name: string) => Promise<Playlist>
  onToggleVideo: (playlistId: string, video: PlaylistVideo) => void
  onRemoveFromPlaylist: (playlistId: string, trackId: string) => void
  /** Apre la schermata player YouTube sulla coda scelta. */
  onOpenVideo: (videos: PlaylistVideo[], index: number) => void
}

export function PlaylistsView({
  playlists,
  tracks,
  currentTrackId,
  isPlaying,
  onPlay,
  onMenu,
  onCreate,
  onToggleVideo,
  onRemoveFromPlaylist,
  onOpenVideo,
}: Props) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  const byId = new Map(tracks.map((track) => [track.id, track]))
  const playlist = openId ? playlists.find((item) => item.id === openId) : undefined
  const playlistTracks = playlist
    ? playlist.trackIds.map((id) => byId.get(id)).filter((track): track is Track => Boolean(track))
    : []
  const playlistVideos = playlist?.videos ?? []
  const total = playlistTracks.length + playlistVideos.length

  const submit = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    await onCreate(trimmed)
    setName('')
    setCreating(false)
  }

  if (playlist) {
    return (
      <div className="playlist-detail">
        <button className="back-btn glass" onClick={() => setOpenId(null)}>
          <ChevronLeftIcon size={18} /> Playlist
        </button>
        <div className="playlist-hero">
          <div className="playlist-hero__art">
            {playlistTracks[0]?.artUrl ? (
              <img src={playlistTracks[0].artUrl} alt="" />
            ) : playlistVideos[0]?.thumb ? (
              <img src={playlistVideos[0].thumb} alt="" />
            ) : (
              <ListIcon size={44} />
            )}
          </div>
          <h2 className="playlist-hero__name">{playlist.name}</h2>
          <p className="playlist-hero__meta">
            {pluralise(total, 'brano', 'brani')}
            {playlistVideos.length > 0 && playlistTracks.length > 0
              ? ` · ${playlistVideos.length} da YouTube`
              : ''}
          </p>
          {total > 0 && (
            <button
              className="primary-btn glass glass--thick"
              onClick={() => {
                if (playlistTracks.length > 0) onPlay(playlistTracks[0], playlistTracks)
                else onOpenVideo(playlistVideos, 0)
              }}
            >
              <PlayIcon size={18} /> Riproduci
            </button>
          )}
        </div>

        {total === 0 ? (
          <p className="tracks__none">
            Playlist vuota: aggiungi brani dal menu <strong>···</strong> e video dal pulsante{' '}
            <strong>+</strong> del player YouTube.
          </p>
        ) : (
          <>
            {playlistTracks.length > 0 && (
              <div className="list glass glass--thick">
                {playlistTracks.map((track) => (
                  <div key={track.id} className="playlist-row">
                    <TrackRow
                      track={track}
                      active={track.id === currentTrackId}
                      playing={isPlaying}
                      onPlay={() => onPlay(track, playlistTracks)}
                      onMenu={() => onMenu(track)}
                    />
                    <button
                      className="row__more"
                      onClick={() => onRemoveFromPlaylist(playlist.id, track.id)}
                      aria-label={`Togli ${track.title} dalla playlist`}
                    >
                      <TrashIcon size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {playlistVideos.length > 0 && (
              <div className="list glass glass--thick">
                {playlistVideos.map((item, index) => (
                  <div key={item.id} className="playlist-row">
                    <button
                      className="yt-row"
                      onClick={() => onOpenVideo(playlistVideos, index)}
                      aria-label={`Riproduci ${item.title} su YouTube`}
                    >
                      <img className="yt-row__thumb" src={item.thumb} alt="" loading="lazy" />
                      <span className="yt-row__text">
                        <span className="yt-row__title">{item.title}</span>
                        <span className="yt-row__sub">
                          {item.channel}
                          {item.seconds ? ` · ${formatTime(item.seconds)}` : ''}
                        </span>
                      </span>
                    </button>
                    <button
                      className="row__more"
                      onClick={() => onToggleVideo(playlist.id, item)}
                      aria-label={`Togli ${item.title} dalla playlist`}
                    >
                      <TrashIcon size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <div className="playlists">
      {creating ? (
        <div className="create-card glass glass--thick">
          <input
            autoFocus
            className="create-card__input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void submit()
              if (event.key === 'Escape') setCreating(false)
            }}
            placeholder="Nome della playlist"
            aria-label="Nome della playlist"
            maxLength={60}
          />
          <div className="create-card__actions">
            <button className="ghost-btn" onClick={() => setCreating(false)}>
              Annulla
            </button>
            <button className="primary-btn primary-btn--small" onClick={() => void submit()}>
              Crea
            </button>
          </div>
        </div>
      ) : (
        <button className="create-row glass" onClick={() => setCreating(true)}>
          <span className="create-row__icon">
            <PlusIcon size={20} />
          </span>
          <span>
            <span className="create-row__title">Nuova playlist</span>
            <span className="create-row__sub">Raggruppa brani e video YouTube</span>
          </span>
        </button>
      )}

      {playlists.length === 0 ? (
        <p className="tracks__none">
          <ListIcon size={20} /> Non hai ancora playlist.
        </p>
      ) : (
        <div className="playlist-grid">
          {playlists.map((item) => {
            const first = item.trackIds.map((id) => byId.get(id)).find(Boolean)
            const cover = first?.artUrl ?? item.videos[0]?.thumb
            return (
              <button key={item.id} className="playlist-card" onClick={() => setOpenId(item.id)}>
                <span className="playlist-card__art">
                  {cover ? <img src={cover} alt="" loading="lazy" /> : <ListIcon size={30} />}
                </span>
                <span className="playlist-card__name">{item.name}</span>
                <span className="playlist-card__meta">
                  {pluralise(item.trackIds.length + item.videos.length, 'brano', 'brani')}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
