import { useEffect, useState } from 'react'
import { formatTime, pluralise } from '../lib/format'
import { MAX_TRACKS, fetchSpotifyLink, normaliseSpotifyLink, parseTracklist } from '../lib/spotify'
import type { SpotifyLinkInfo } from '../lib/spotify'
import type { Playlist, PlaylistVideo, SpotifyTrack, Track } from '../lib/types'
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
  /** Importa la lista incollata da Spotify (link + tracce). */
  onImportSpotify: (input: {
    name: string
    url?: string
    artUrl?: string
    tracks: SpotifyTrack[]
  }) => Promise<Playlist>
  /** Riproduce un brano importato da Spotify: la ricerca YouTube la fa l'app. */
  onPlaySpotify: (playlist: Playlist, index: number) => void
  /** Elimina la playlist (i brani della libreria non si toccano). */
  onDeletePlaylist: (playlistId: string) => void
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
  onImportSpotify,
  onPlaySpotify,
  onDeletePlaylist,
}: Props) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [importLink, setImportLink] = useState('')
  const [importName, setImportName] = useState('')
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState('')
  const [importing, setImporting] = useState(false)
  const [linkInfo, setLinkInfo] = useState<SpotifyLinkInfo | null>(null)
  const [linkBusy, setLinkBusy] = useState(false)

  const byId = new Map(tracks.map((track) => [track.id, track]))
  const playlist = openId ? playlists.find((item) => item.id === openId) : undefined
  const playlistTracks = playlist
    ? playlist.trackIds.map((id) => byId.get(id)).filter((track): track is Track => Boolean(track))
    : []
  const playlistVideos = playlist?.videos ?? []
  const spotifyTracks = playlist?.spotify?.tracks ?? []
  const total = playlistTracks.length + playlistVideos.length + spotifyTracks.length
  const parsed = importOpen ? parseTracklist(importText) : []

  // Dal link arrivano subito nome e copertina; i brani no (vedi submitImport).
  useEffect(() => {
    const link = normaliseSpotifyLink(importLink)
    setLinkInfo(null)
    if (!link) {
      setLinkBusy(false)
      return
    }
    let cancelled = false
    setLinkBusy(true)
    const timer = window.setTimeout(() => {
      void fetchSpotifyLink(link).then((info) => {
        if (cancelled) return
        setLinkInfo(info)
        setLinkBusy(false)
        if (info?.name) setImportName((current) => current.trim() || info.name)
      })
    }, 400)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [importLink])

  const submit = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    await onCreate(trimmed)
    setName('')
    setCreating(false)
  }

  const submitImport = async () => {
    setImportError('')
    const link = normaliseSpotifyLink(importLink)
    if (importLink.trim() && !link) {
      setImportError('Il link non sembra una playlist Spotify: incolla un indirizzo open.spotify.com/playlist/…')
      return
    }
    if (!parsed.length) {
      setImportError(
        link
          ? 'Dal link leggo nome e copertina, ma non la scaletta: Spotify restituisce i brani solo a chi possiede la playlist. Incollala qui sopra, una riga per brano.'
          : 'Nessun brano riconosciuto: scrivi una riga per brano, ad esempio “Artista - Titolo”.',
      )
      return
    }
    setImporting(true)
    try {
      const created = await onImportSpotify({
        name: importName.trim() || linkInfo?.name || 'Playlist Spotify',
        url: link || undefined,
        artUrl: linkInfo?.artUrl,
        tracks: parsed,
      })
      setImportOpen(false)
      setImportLink('')
      setImportName('')
      setImportText('')
      setOpenId(created.id)
    } catch {
      setImportError('Importazione non riuscita: riprova.')
    } finally {
      setImporting(false)
    }
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
            ) : spotifyTracks[0]?.thumb ? (
              <img src={spotifyTracks[0].thumb} alt="" />
            ) : playlist.spotify?.artUrl ? (
              <img src={playlist.spotify.artUrl} alt="" />
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
            {spotifyTracks.length > 0 ? ` · ${spotifyTracks.length} da Spotify` : ''}
          </p>
          {total > 0 && (
            <button
              className="primary-btn glass glass--thick"
              onClick={() => {
                if (playlistTracks.length > 0) onPlay(playlistTracks[0], playlistTracks)
                else if (playlistVideos.length > 0) onOpenVideo(playlistVideos, 0)
                else onPlaySpotify(playlist, 0)
              }}
            >
              <PlayIcon size={18} /> Riproduci
            </button>
          )}
          <button
            className="ghost-btn playlist-hero__delete"
            onClick={() => {
              if (window.confirm(`Eliminare “${playlist.name}”? I brani della libreria restano.`)) {
                onDeletePlaylist(playlist.id)
                setOpenId(null)
              }
            }}
          >
            <TrashIcon size={16} /> Elimina playlist
          </button>
          {playlist.spotify?.url && (
            <a
              className="ghost-btn playlist-hero__link"
              href={playlist.spotify.url.replace(/^spotify:playlist:/, 'https://open.spotify.com/playlist/')}
              target="_blank"
              rel="noreferrer"
            >
              Apri in Spotify
            </a>
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

            {spotifyTracks.length > 0 && (
              <div className="list glass glass--thick">
                <p className="sp-list__head">
                  <span className="sp-badge">Spotify</span>
                  Riproduzione tramite YouTube, cercata al primo ascolto
                </p>
                {spotifyTracks.map((item, index) => (
                  <button
                    key={item.id}
                    className="sp-row"
                    onClick={() => onPlaySpotify(playlist, index)}
                    aria-label={`Riproduci ${item.title} di ${item.artist}`}
                  >
                    <span className="sp-row__index">{index + 1}</span>
                    {item.thumb ? (
                      <img className="yt-row__thumb" src={item.thumb} alt="" loading="lazy" />
                    ) : (
                      <span className="yt-row__thumb sp-row__thumb-empty" aria-hidden="true" />
                    )}
                    <span className="yt-row__text">
                      <span className="yt-row__title">{item.title}</span>
                      <span className="yt-row__sub">
                        {item.artist || 'Artista non indicato'}
                        {item.seconds ? ` · ${formatTime(item.seconds)}` : ''}
                      </span>
                    </span>
                  </button>
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

      {importOpen ? (
        <div className="create-card glass glass--thick sp-import">
          <label className="sp-import__label" htmlFor="sp-link">
            Link della playlist Spotify
          </label>
          <input
            id="sp-link"
            className="create-card__input"
            value={importLink}
            onChange={(event) => setImportLink(event.target.value)}
            placeholder="https://open.spotify.com/playlist/…"
            inputMode="url"
            autoComplete="off"
          />
          {(linkBusy || linkInfo) && (
            <div className="sp-import__linkinfo">
              {linkInfo?.artUrl ? <img src={linkInfo.artUrl} alt="" /> : null}
              <span>{linkBusy ? 'Leggo il link…' : `Trovata: ${linkInfo?.name}`}</span>
            </div>
          )}
          <label className="sp-import__label" htmlFor="sp-tracks">
            Lista dei brani, una riga per brano
          </label>
          <textarea
            id="sp-tracks"
            className="create-card__input sp-import__area"
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            placeholder={'Artista - Titolo\nArtista - Titolo'}
            rows={7}
            spellCheck={false}
          />
          <p className="menu__hint">
            Dal link ricavo nome e copertina della playlist. La scaletta invece va incollata
            (massimo {MAX_TRACKS} brani): da febbraio 2026 Spotify restituisce i brani di una
            playlist solo a chi la possiede. Ogni brano viene cercato e riprodotto dal player
            YouTube ufficiale.
          </p>
          <input
            className="create-card__input"
            value={importName}
            onChange={(event) => setImportName(event.target.value)}
            placeholder="Nome della playlist (facoltativo)"
            aria-label="Nome della playlist importata"
            maxLength={60}
          />
          <div className="sp-import__foot">
            <span className="sp-import__count">
              {parsed.length ? `${pluralise(parsed.length, 'brano riconosciuto', 'brani riconosciuti')}` : '—'}
            </span>
            <div className="create-card__actions">
              <button
                className="ghost-btn"
                onClick={() => {
                  setImportOpen(false)
                  setImportError('')
                }}
              >
                Annulla
              </button>
              <button
                className="primary-btn primary-btn--small"
                onClick={() => void submitImport()}
                disabled={importing}
              >
                {importing ? 'Importo…' : 'Importa'}
              </button>
            </div>
          </div>
          {importError && <p className="sp-import__error">{importError}</p>}
        </div>
      ) : (
        <button className="create-row glass" onClick={() => setImportOpen(true)}>
          <span className="create-row__icon sp-badge-icon">S</span>
          <span>
            <span className="create-row__title">Importa da Spotify</span>
            <span className="create-row__sub">Link + lista dei brani, salvata sul telefono</span>
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
            const cover = first?.artUrl ?? item.videos[0]?.thumb ?? item.spotify?.tracks[0]?.thumb
            const count =
              item.trackIds.length + item.videos.length + (item.spotify?.tracks.length ?? 0)
            return (
              <button key={item.id} className="playlist-card" onClick={() => setOpenId(item.id)}>
                <span className="playlist-card__art">
                  {cover ? <img src={cover} alt="" loading="lazy" /> : <ListIcon size={30} />}
                </span>
                <span className="playlist-card__name">{item.name}</span>
                <span className="playlist-card__meta">{pluralise(count, 'brano', 'brani')}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
