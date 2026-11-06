import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useAudioPlayer } from './hooks/useAudioPlayer'
import { useLibrary } from './hooks/useLibrary'
import { useOfflineCache } from './hooks/useOfflineCache'
import type { Playlist, Tab, Track } from './lib/types'
import { MiniPlayer } from './components/MiniPlayer'
import { NowPlaying } from './components/NowPlaying'
import { QueueSheet } from './components/QueueSheet'
import { Sheet } from './components/Sheet'
import { TabBar } from './components/TabBar'
import {
  CheckIcon,
  CloseIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  QueueIcon,
  ShareIcon,
  TrashIcon,
} from './components/Icons'
import { AlbumsView } from './views/AlbumsView'
import { DiscoverView } from './views/DiscoverView'
import { PlaylistsView } from './views/PlaylistsView'
import { TracksView } from './views/TracksView'
import { YouTubeScreen } from './components/YouTubeScreen'
import type { YouTubePlayerHandle } from './components/YouTubePlayer'
import { searchYouTube } from './lib/youtube'
import type { YouTubeVideo } from './lib/youtube'
import { spotifyQuery, toYouTubeVideo } from './lib/spotify'

const TAB_TITLES: Record<Tab, string> = {
  discover: 'Scopri',
  tracks: 'Brani',
  albums: 'Album',
  playlists: 'Playlist',
}

function readInstallHint(): boolean {
  try {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    return isIOS && !standalone && localStorage.getItem('aura-install-hint') !== 'dismissed'
  } catch {
    return false
  }
}

export default function App() {
  const library = useLibrary()
  const [tab, setTab] = useState<Tab>('discover')
  const [catalogue, setCatalogue] = useState<Track[]>([])
  const [query, setQuery] = useState('')
  const [playerOpen, setPlayerOpen] = useState(false)
  const [queueOpen, setQueueOpen] = useState(false)
  const [menuTrack, setMenuTrack] = useState<Track | null>(null)
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [installHint, setInstallHint] = useState(readInstallHint)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // La sessione YouTube vive qui: quando la schermata si chiude il player resta
  // montato (nascosto) e la riproduzione non si interrompe.
  const [yt, setYt] = useState<{ videos: YouTubeVideo[]; index: number } | null>(null)
  const [ytExpanded, setYtExpanded] = useState(true)
  const [ytPlaying, setYtPlaying] = useState(true)
  const ytPlayer = useRef<YouTubePlayerHandle | null>(null)
  const [notice, setNotice] = useState('')

  const offline = useOfflineCache()

  // Local files win over the streaming copy of the same track.
  const playableTracks = useMemo(() => {
    const map = new Map<string, Track>()
    for (const track of library.tracks) map.set(track.id, track)
    for (const track of catalogue) if (!map.has(track.id)) map.set(track.id, track)
    // Le copertine in cache funzionano anche senza rete.
    return [...map.values()].map((track) =>
      offline.artUrls[track.id] ? { ...track, artUrl: offline.artUrls[track.id] } : track,
    )
  }, [catalogue, library.tracks, offline.artUrls])

  const player = useAudioPlayer(playableTracks)

  const rememberCatalogueTracks = useCallback((incoming: Track[]) => {
    setCatalogue((previous) => {
      const map = new Map(previous.map((track) => [track.id, track]))
      for (const track of incoming) map.set(track.id, track)
      return [...map.values()]
    })
  }, [])

  const openPicker = useCallback(() => fileInputRef.current?.click(), [])

  const handleFiles = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? [])
      event.target.value = ''
      if (files.length) void library.importFiles(files)
    },
    [library],
  )

  // Specular highlight follows the pointer across every glass surface.
  useEffect(() => {
    let frame = 0
    const onPointerMove = (event: PointerEvent) => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        const target = event.target as HTMLElement | null
        const surface = target?.closest?.('.glass') as HTMLElement | null
        if (!surface) return
        const rect = surface.getBoundingClientRect()
        surface.style.setProperty('--mx', `${event.clientX - rect.left}px`)
        surface.style.setProperty('--my', `${event.clientY - rect.top}px`)
      })
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  const playTrack = useCallback(
    (track: Track, list: Track[]) => {
      // Un solo audio alla volta: il video YouTube in sottofondo va in pausa.
      if (yt && ytPlaying) {
        ytPlayer.current?.pause()
        setYtPlaying(false)
      }
      // Messa da parte in sottofondo: nessun pulsante, nessuna domanda.
      void offline.remember(track)
      player.playQueue(
        list.map((item) => item.id),
        track.id,
      )
    },
    [offline, player, yt, ytPlaying],
  )

  const createPlaylistWithTrack = useCallback(async () => {
    const name = newPlaylistName.trim()
    if (!name) return
    const playlist = await library.createPlaylist(name)
    if (menuTrack) await library.toggleTrackInPlaylist(playlist.id, menuTrack.id)
    setNewPlaylistName('')
    setMenuTrack(null)
  }, [library, menuTrack, newPlaylistName])

  const openYouTube = useCallback(
    (videos: YouTubeVideo[], index: number) => {
      if (!videos[index]) return
      setYt({ videos, index })
      setYtExpanded(true)
      setYtPlaying(true)
      // Un solo audio alla volta: la musica locale va in pausa.
      if (player.isPlaying) player.togglePlay()
    },
    [player],
  )

  const ytToggle = useCallback(() => {
    if (ytPlaying) {
      ytPlayer.current?.pause()
      setYtPlaying(false)
    } else {
      ytPlayer.current?.play()
      setYtPlaying(true)
    }
  }, [ytPlaying])

  const ytStep = useCallback(
    (direction: 1 | -1) => {
      if (!yt) return
      const index = yt.index + direction
      if (index < 0 || index >= yt.videos.length) return
      setYt({ ...yt, index })
      setYtPlaying(true)
    },
    [yt],
  )

  const closeYouTube = useCallback(() => {
    ytPlayer.current?.pause()
    setYt(null)
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 2200)
    return () => window.clearTimeout(timer)
  }, [notice])

  /** Coda dei video: si allunga la sessione, che poi avanza da sola. */
  const enqueueYouTube = useCallback(
    (video: YouTubeVideo) => {
      if (!yt) {
        openYouTube([video], 0)
        setNotice('Riproduco il video')
        return
      }
      if (yt.videos.some((item) => item.id === video.id)) {
        setNotice('Video già in coda')
        return
      }
      setYt({ ...yt, videos: [...yt.videos, video] })
      setNotice('Video aggiunto alla coda')
    },
    [openYouTube, yt],
  )

  /**
   * Brani importati da Spotify: non esiste un flusso Spotify da riprodurre, quindi
   * il brano viene cercato su YouTube la prima volta e il video trovato resta
   * salvato nella playlist (le volte dopo partono subito).
   */
  const playSpotifyTrack = useCallback(
    async (playlist: Playlist, index: number) => {
      const item = playlist.spotify?.tracks[index]
      if (!item) return

      const known = toYouTubeVideo(item)
      if (known) {
        openYouTube([known], 0)
        return
      }

      setNotice('Cerco il brano su YouTube…')
      try {
        const [video] = await searchYouTube(spotifyQuery(item))
        if (!video) {
          setNotice('Brano non trovato su YouTube')
          return
        }
        await library.rememberSpotifyVideo(playlist.id, item.id, video)
        openYouTube([video], 0)
      } catch (searchError) {
        setNotice(
          searchError instanceof Error ? searchError.message : 'Ricerca non disponibile ora.',
        )
      }
    },
    [library, openYouTube],
  )

  const accent =
    player.currentTrack?.artColor ?? library.tracks[0]?.artColor ?? 'hsl(248 62% 62%)'
  const ambientArt = player.currentTrack?.artUrl ?? library.tracks[0]?.artUrl
  const showPlayer = Boolean(player.currentTrack)
  const ytVideo = yt ? yt.videos[yt.index] : undefined
  const ytHasPrev = yt ? yt.index > 0 : false
  const ytHasNext = yt ? yt.index < yt.videos.length - 1 : false

  return (
    <div className="app" style={{ '--accent': accent } as CSSProperties}>
      <div className="ambient" aria-hidden="true">
        <div
          className="ambient__art"
          style={ambientArt ? { backgroundImage: `url(${ambientArt})` } : undefined}
        />
        <div className="ambient__glow" />
        <div className="ambient__veil" />
      </div>

      <div className="app__scroll">
        <header className="topbar">
          <div className="topbar__row">
            <div className="topbar__titles">
              <p className="eyebrow">Aura</p>
              <h1 className="topbar__title">{TAB_TITLES[tab]}</h1>
            </div>
            <button className="icon-btn glass glass--circle" onClick={openPicker} aria-label="Importa musica">
              <PlusIcon size={22} />
            </button>
          </div>
        </header>

        {installHint && (
          <div className="install glass glass--thick">
            <span className="install__icon">
              <ShareIcon size={20} />
            </span>
            <div className="install__text">
              <strong>Installa Aura sulla Home</strong>
              <span>
                Tocca Condividi, poi “Aggiungi a Home”: l’app resta offline e senza pubblicità.
              </span>
            </div>
            <button
              className="install__close"
              onClick={() => {
                setInstallHint(false)
                try {
                  localStorage.setItem('aura-install-hint', 'dismissed')
                } catch {
                  /* memoria non disponibile: il suggerimento ricomparirà */
                }
              }}
              aria-label="Chiudi il suggerimento"
            >
              <CloseIcon size={16} />
            </button>
          </div>
        )}

        {library.importing && library.tracks.length > 0 && (
          <div className="import-bar glass">
            <span className="import-bar__label">
              Importazione {library.importing.done}/{library.importing.total}
            </span>
            <span className="import-bar__track">
              <i
                style={{
                  transform: `scaleX(${library.importing.done / Math.max(library.importing.total, 1)})`,
                }}
              />
            </span>
          </div>
        )}

        <main className={`content content--${tab}`}>
          {tab === 'discover' && (
            <DiscoverView
              currentTrackId={player.currentTrackId}
              isPlaying={player.isPlaying}
              cachedIds={offline.cachedIds}
              onTracksLoaded={rememberCatalogueTracks}
              onPlay={playTrack}
              onMenu={setMenuTrack}
              onEnqueueVideo={enqueueYouTube}
              onOpenVideo={openYouTube}
            />
          )}
          {tab === 'tracks' && (
            <TracksView
              tracks={library.tracks}
              currentTrackId={player.currentTrackId}
              isPlaying={player.isPlaying}
              importing={library.importing}
              query={query}
              onQueryChange={setQuery}
              onImport={openPicker}
              onPlay={playTrack}
              onMenu={setMenuTrack}
            />
          )}
          {tab === 'albums' && (
            <AlbumsView
              tracks={library.tracks}
              currentTrackId={player.currentTrackId}
              isPlaying={player.isPlaying}
              onPlay={playTrack}
              onMenu={setMenuTrack}
            />
          )}
          {tab === 'playlists' && (
            <PlaylistsView
              playlists={library.playlists}
              tracks={library.tracks}
              currentTrackId={player.currentTrackId}
              isPlaying={player.isPlaying}
              onPlay={playTrack}
              onMenu={setMenuTrack}
              onCreate={library.createPlaylist}
              onToggleVideo={(playlistId, video) =>
                void library.toggleVideoInPlaylist(playlistId, video)
              }
              onOpenVideo={openYouTube}
              onImportSpotify={library.createSpotifyPlaylist}
              onPlaySpotify={(playlist, index) => void playSpotifyTrack(playlist, index)}
              onDeletePlaylist={(playlistId) => void library.removePlaylist(playlistId)}
              onRemoveFromPlaylist={(playlistId, trackId) =>
                void library.toggleTrackInPlaylist(playlistId, trackId)
              }
            />
          )}

          {library.loading && <p className="content__loading">Carico la libreria…</p>}
        </main>
      </div>

      <div className="bottom">
        {ytVideo && !ytExpanded && (
          <div className="mini mini--yt glass glass--thick">
            <button
              className="mini__main"
              onClick={() => setYtExpanded(true)}
              aria-label="Riapri il player YouTube"
            >
              <span className="mini__art">
                <img src={ytVideo.thumb} alt="" />
              </span>
              <span className="mini__text">
                <span className="mini__title">{ytVideo.title}</span>
                <span className="mini__artist">{ytVideo.channel}</span>
              </span>
            </button>
            <div className="mini__actions">
              <button
                className="mini__btn"
                onClick={ytToggle}
                aria-label={ytPlaying ? 'Pausa' : 'Riproduci'}
              >
                {ytPlaying ? <PauseIcon size={22} /> : <PlayIcon size={22} />}
              </button>
              <button
                className="mini__btn"
                onClick={() => ytStep(1)}
                disabled={!ytHasNext}
                aria-label="Video successivo"
              >
                <NextIcon size={22} />
              </button>
            </div>
            <button
              className="mini__close"
              onClick={closeYouTube}
              aria-label="Chiudi il player YouTube"
            >
              <CloseIcon size={14} />
            </button>
          </div>
        )}
        {showPlayer && player.currentTrack && (
          <MiniPlayer
            track={player.currentTrack}
            isPlaying={player.isPlaying}
            position={player.position}
            duration={player.duration}
            onOpen={() => setPlayerOpen(true)}
            onTogglePlay={player.togglePlay}
            onNext={player.next}
          />
        )}
        <TabBar active={tab} onChange={setTab} />
      </div>

      {playerOpen && player.currentTrack && (
        <NowPlaying
          track={player.currentTrack}
          isPlaying={player.isPlaying}
          position={player.position}
          duration={player.duration}
          shuffle={player.shuffle}
          repeat={player.repeat}
          volume={player.volume}
          onClose={() => setPlayerOpen(false)}
          onTogglePlay={player.togglePlay}
          onNext={player.next}
          onPrevious={player.previous}
          onSeek={player.seek}
          onSetVolume={player.setVolume}
          onToggleShuffle={player.toggleShuffle}
          onCycleRepeat={player.cycleRepeat}
          onOpenQueue={() => setQueueOpen(true)}
          live={player.currentTrack.source === 'radio'}
        />
      )}

      <QueueSheet
        open={queueOpen}
        onClose={() => setQueueOpen(false)}
        queue={player.queue
          .map((id) => playableTracks.find((track) => track.id === id))
          .filter((track): track is Track => Boolean(track))}
        currentTrackId={player.currentTrackId}
        isPlaying={player.isPlaying}
        onSelect={player.jumpTo}
      />

      {ytVideo && (
        <YouTubeScreen
          video={ytVideo}
          minimized={!ytExpanded}
          playing={ytPlaying}
          playerRef={ytPlayer}
          onTogglePlay={ytToggle}
          onMinimize={() => setYtExpanded(false)}
          onPrevious={ytHasPrev ? () => ytStep(-1) : undefined}
          onNext={ytHasNext ? () => ytStep(1) : undefined}
          onPlayStateChange={setYtPlaying}
          onEnded={() => {
            // Fine video: parte il successivo della coda, se c'è.
            if (ytHasNext) ytStep(1)
            else setYtPlaying(false)
          }}
          playlists={library.playlists}
          onToggleVideo={(playlistId, video) =>
            void library.toggleVideoInPlaylist(playlistId, video)
          }
          onCreatePlaylist={library.createPlaylist}
        />
      )}

      <Sheet open={Boolean(menuTrack)} onClose={() => setMenuTrack(null)} title={menuTrack?.title}>
        {menuTrack && (
          <div className="menu">
            <button
              className="menu__item"
              onClick={() => {
                setNotice(player.enqueue(menuTrack.id) ? 'Aggiunto alla coda' : 'Già in coda')
                setMenuTrack(null)
              }}
            >
              <span className="menu__check">
                <QueueIcon size={16} />
              </span>
              <span className="menu__text">Metti in coda</span>
            </button>

            <p className="menu__label">Aggiungi a playlist</p>
            {library.playlists.length === 0 && (
              <p className="menu__hint">Non hai playlist: creane una qui sotto.</p>
            )}
            {library.playlists.map((playlist) => {
              const has = playlist.trackIds.includes(menuTrack.id)
              return (
                <button
                  key={playlist.id}
                  className="menu__item"
                  onClick={() => void library.toggleTrackInPlaylist(playlist.id, menuTrack.id)}
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

            <div className="menu__create">
              <input
                className="menu__input"
                value={newPlaylistName}
                onChange={(event) => setNewPlaylistName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void createPlaylistWithTrack()
                }}
                placeholder="Nuova playlist"
                aria-label="Nome della nuova playlist"
                maxLength={60}
              />
              <button
                className="primary-btn primary-btn--small"
                onClick={() => void createPlaylistWithTrack()}
                disabled={!newPlaylistName.trim()}
              >
                Crea
              </button>
            </div>

            {library.tracks.some((track) => track.id === menuTrack.id) && (
              <button
                className="menu__item menu__item--danger"
                onClick={() => {
                  void library.removeTrack(menuTrack.id)
                  setMenuTrack(null)
                }}
              >
                <span className="menu__check">
                  <TrashIcon size={16} />
                </span>
                <span className="menu__text">Rimuovi dalla libreria</span>
              </button>
            )}
          </div>
        )}
      </Sheet>

      {notice && (
        <div className="toast glass glass--thick" role="status">
          <span>{notice}</span>
        </div>
      )}

      {player.playbackError && (
        <div className="toast glass glass--thick" role="status">
          <span>{player.playbackError}</span>
          <button onClick={player.dismissPlaybackError} aria-label="Chiudi messaggio">
            <CloseIcon size={16} />
          </button>
        </div>
      )}

      {library.error && (
        <div className="toast glass glass--thick" role="status">
          <span>{library.error}</span>
          <button onClick={library.dismissError} aria-label="Chiudi messaggio">
            <CloseIcon size={16} />
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.m4a,.m4b,.aac,.flac,.wav,.aiff,.aif,.ogg,.oga,.opus,.weba"
        multiple
        hidden
        onChange={handleFiles}
      />
    </div>
  )
}
