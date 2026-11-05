import { useCallback, useEffect, useMemo, useState } from 'react'
import { searchTracks, trendingTracks } from '../lib/audius'
import {
  getJamendoClientId,
  jamendoItalian,
  jamendoPopular,
  jamendoSearch,
  setJamendoClientId,
} from '../lib/jamendo'
import { popularItalianStations, searchStations } from '../lib/radio'
import { searchYouTube } from '../lib/youtube'
import type { YouTubeVideo } from '../lib/youtube'
import type { Track } from '../lib/types'
import { CheckIcon, MusicIcon, QueueIcon, SearchIcon } from '../components/Icons'
import { TrackRow } from '../components/TrackRow'
import { formatTime } from '../lib/format'

type Props = {
  currentTrackId?: string
  isPlaying: boolean
  cachedIds: Set<string>
  onTracksLoaded: (tracks: Track[]) => void
  onPlay: (track: Track, list: Track[]) => void
  onMenu: (track: Track) => void
  /** Mette il video in fondo alla coda YouTube senza interrompere l'ascolto. */
  onEnqueueVideo: (video: YouTubeVideo) => void
  /** Apre la schermata player YouTube (sessione gestita dall'app). */
  onOpenVideo: (videos: YouTubeVideo[], index: number) => void
}

type Provider = 'audius' | 'jamendo' | 'radio' | 'youtube'
type JamendoMode = 'popular' | 'italian'
type Status = 'loading' | 'ready' | 'error' | 'unconfigured'
type YtStatus = 'idle' | 'loading' | 'ready' | 'error'

const PROVIDERS: { id: Provider; label: string }[] = [
  { id: 'audius', label: 'Audius' },
  { id: 'jamendo', label: 'Jamendo' },
  { id: 'radio', label: 'Radio' },
  { id: 'youtube', label: 'YouTube' },
]

export function DiscoverView({
  currentTrackId,
  isPlaying,
  cachedIds,
  onTracksLoaded,
  onPlay,
  onMenu,
  onEnqueueVideo,
  onOpenVideo,
}: Props) {
  const [provider, setProvider] = useState<Provider>('audius')
  const [jamendoMode, setJamendoMode] = useState<JamendoMode>('popular')
  const [clientId, setClientIdState] = useState(() => getJamendoClientId())
  const [pendingKey, setPendingKey] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Track[]>([])
  const [status, setStatus] = useState<Status>('loading')

  const [ytVideos, setYtVideos] = useState<YouTubeVideo[]>([])
  const [ytActiveId, setYtActiveId] = useState<string | null>(null)
  const [ytStatus, setYtStatus] = useState<YtStatus>('idle')
  const [ytMessage, setYtMessage] = useState('')

  const hasClientId = Boolean(clientId)
  const trimmed = query.trim()
  const isYouTube = provider === 'youtube'

  const load = useCallback(
    async (value: string, signal: { cancelled: boolean }) => {
      const text = value.trim()
      setStatus('loading')
      try {
        let list: Track[]
        if (provider === 'audius') {
          list = text ? await searchTracks(text) : await trendingTracks()
        } else if (provider === 'jamendo') {
          if (!hasClientId) {
            setResults([])
            setStatus('unconfigured')
            return
          }
          if (text) list = await jamendoSearch(text)
          else if (jamendoMode === 'italian') list = await jamendoItalian()
          else list = await jamendoPopular()
        } else {
          list = text ? await searchStations(text) : await popularItalianStations()
        }
        if (signal.cancelled) return
        setResults(list)
        onTracksLoaded(list)
        setStatus('ready')
      } catch {
        if (!signal.cancelled) setStatus('error')
      }
    },
    [hasClientId, jamendoMode, onTracksLoaded, provider],
  )

  useEffect(() => {
    if (isYouTube) return
    const signal = { cancelled: false }
    const timer = window.setTimeout(() => void load(query, signal), query ? 420 : 0)
    return () => {
      signal.cancelled = true
      window.clearTimeout(timer)
    }
  }, [isYouTube, load, query])

  const sourceLabel = useMemo(() => {
    if (trimmed) return `Risultati per “${trimmed}”`
    if (provider === 'audius') return 'Di tendenza questa settimana'
    if (provider === 'radio') return 'Radio italiane in diretta'
    return jamendoMode === 'italian' ? 'Musica italiana su Jamendo' : 'I più ascoltati su Jamendo'
  }, [jamendoMode, provider, trimmed])

  const providerLabel: Record<Provider, string> = {
    audius: 'Audius · senza annunci',
    jamendo: 'Jamendo · Creative Commons',
    radio: 'Radio · gratis, con gli spot',
    youtube: 'YouTube · player ufficiale',
  }

  const activateJamendo = () => {
    const value = pendingKey.trim()
    if (!value) return
    setJamendoClientId(value)
    setClientIdState(value)
    setPendingKey('')
  }

  const runYouTubeSearch = async (term: string) => {
    const text = term.trim()
    if (!text) return
    setQuery(text)
    setYtStatus('loading')
    setYtMessage('')
    try {
      const videos = await searchYouTube(text)
      setYtVideos(videos)
      // Niente autoplay: prima l'elenco dei brani, il player solo quando scegli tu.
      setYtActiveId(null)
      setYtStatus('ready')
      if (!videos.length) setYtMessage('Nessun video trovato per questa ricerca.')
    } catch (error) {
      setYtStatus('error')
      setYtMessage(error instanceof Error ? error.message : 'Ricerca non riuscita.')
    }
  }

  return (
    <div className="discover">
      <div className="search glass">
        <SearchIcon size={18} />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && isYouTube) void runYouTubeSearch(query)
          }}
          placeholder={
            isYouTube ? 'Cerca un artista o un brano su YouTube' : 'Cerca artisti, brani, generi, stazioni'
          }
          aria-label="Cerca nel catalogo"
          spellCheck={false}
        />
        {query && (
          <button className="search__clear" onClick={() => setQuery('')} aria-label="Cancella ricerca">
            ×
          </button>
        )}
      </div>

      <div className="chips">
        {PROVIDERS.map((item) => (
          <button
            key={item.id}
            className={`chip ${provider === item.id ? 'is-active' : ''}`}
            onClick={() => setProvider(item.id)}
            aria-pressed={provider === item.id}
          >
            {item.label}
          </button>
        ))}
      </div>

      {isYouTube ? (
        <>
          {ytStatus === 'loading' && (
            <div className="list glass glass--thick">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="skeleton-row">
                  <span className="skeleton skeleton--art" />
                  <span className="skeleton-lines">
                    <span className="skeleton skeleton--line" />
                    <span className="skeleton skeleton--line skeleton--short" />
                  </span>
                </div>
              ))}
            </div>
          )}

          {ytStatus === 'error' && (
            <div className="discover__error glass">
              <p>{ytMessage}</p>
              <button className="ghost-btn" onClick={() => void runYouTubeSearch(query)}>
                Riprova
              </button>
            </div>
          )}

          {ytVideos.length > 0 && ytStatus !== 'loading' && (
            <div className="list glass glass--thick">
              {ytVideos.map((video, index) => (
                <div key={video.id} className="playlist-row">
                  <button
                    className={`yt-row ${ytActiveId === video.id ? 'is-active' : ''}`}
                    onClick={() => {
                      setYtActiveId(video.id)
                      onOpenVideo(ytVideos, index)
                    }}
                  >
                    <img className="yt-row__thumb" src={video.thumb} alt="" loading="lazy" />
                    <span className="yt-row__text">
                      <span className="yt-row__title">{video.title}</span>
                      <span className="yt-row__sub">
                        {video.channel}
                        {video.seconds ? ` · ${formatTime(video.seconds)}` : ''}
                      </span>
                    </span>
                  </button>
                  <button
                    className="row__more"
                    onClick={() => onEnqueueVideo(video)}
                    aria-label={`Metti in coda ${video.title}`}
                  >
                    <QueueIcon size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {ytStatus === 'idle' && (
            <p className="tracks__none">
              <MusicIcon size={20} /> Scrivi un artista e premi Invio per cercare su YouTube.
            </p>
          )}

          {ytStatus === 'ready' && ytVideos.length === 0 && ytMessage && (
            <p className="tracks__none">
              <MusicIcon size={20} /> {ytMessage}
            </p>
          )}
        </>
      ) : (
        <>
          {provider === 'jamendo' && hasClientId && (
            <div className="chips">
              <button
                className={`chip chip--sub ${jamendoMode === 'popular' ? 'is-active' : ''}`}
                onClick={() => setJamendoMode('popular')}
                aria-pressed={jamendoMode === 'popular'}
              >
                Popolari
              </button>
              <button
                className={`chip chip--sub ${jamendoMode === 'italian' ? 'is-active' : ''}`}
                onClick={() => setJamendoMode('italian')}
                aria-pressed={jamendoMode === 'italian'}
              >
                Italiane
              </button>
            </div>
          )}

          {status !== 'unconfigured' && (
            <p className="discover__source">
              <span className="discover__dot" aria-hidden="true" />
              {sourceLabel}
              <span className="discover__provider">{providerLabel[provider]}</span>
            </p>
          )}

          {status === 'unconfigured' && (
            <div className="setup glass glass--thick">
              <h3 className="setup__title">Attiva il catalogo Jamendo</h3>
              <p className="setup__text">
                Jamendo dà accesso a musica Creative Commons, italiana compresa. Serve una{' '}
                <strong>client ID</strong> gratuita: creala su developer.jamendo.com e incollala qui
                sotto.
              </p>
              <div className="setup__row">
                <input
                  className="setup__input"
                  value={pendingKey}
                  onChange={(event) => setPendingKey(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') activateJamendo()
                  }}
                  placeholder="client_id"
                  aria-label="Client ID Jamendo"
                  spellCheck={false}
                  autoCapitalize="none"
                  autoCorrect="off"
                />
                <button
                  className="primary-btn primary-btn--small"
                  onClick={activateJamendo}
                  disabled={!pendingKey.trim()}
                >
                  Attiva
                </button>
              </div>
              <p className="setup__note">
                Resta salvata solo su questo dispositivo. Non è una password, ma non incollarla in
                chat: inseriscila direttamente qui.
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="discover__error glass">
              <p>La sorgente non risponde o ha rifiutato la richiesta. Controlla la connessione e riprova.</p>
              <button className="ghost-btn" onClick={() => void load(query, { cancelled: false })}>
                Riprova
              </button>
            </div>
          )}

          {status === 'loading' && results.length === 0 && (
            <div className="list glass glass--thick">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="skeleton-row">
                  <span className="skeleton skeleton--art" />
                  <span className="skeleton-lines">
                    <span className="skeleton skeleton--line" />
                    <span className="skeleton skeleton--line skeleton--short" />
                  </span>
                </div>
              ))}
            </div>
          )}

          {results.length > 0 && status !== 'unconfigured' && (
            <div className={`list glass glass--thick ${status === 'loading' ? 'is-refreshing' : ''}`}>
              {results.map((track) => {
                const live = track.source === 'radio'
                const cached = cachedIds.has(track.id)
                return (
                  <TrackRow
                    key={track.id}
                    track={track}
                    active={track.id === currentTrackId}
                    playing={isPlaying}
                    meta={live ? track.album : `${track.artist} · ${track.album}`}
                    onPlay={() => onPlay(track, results)}
                    onMenu={() => onMenu(track)}
                    action={
                      live ? (
                        <span className="source-badge is-live">LIVE</span>
                      ) : cached ? (
                        <span className="cached-badge" title="Disponibile anche offline">
                          <CheckIcon size={13} /> Offline
                        </span>
                      ) : null
                    }
                  />
                )
              })}
            </div>
          )}

          {status === 'ready' && results.length === 0 && (
            <p className="tracks__none">
              <MusicIcon size={20} /> Nessun risultato.
            </p>
          )}
        </>
      )}

      <p className="discover__legal">
        {provider === 'audius' &&
          'Catalogo pubblico Audius, senza annunci. Ogni brano che ascolti viene messo da parte in automatico (fino a 500 MB) e poi suona anche senza connessione.'}
        {provider === 'jamendo' &&
          'Catalogo Jamendo su licenza Creative Commons, senza annunci. Anche qui la cache è automatica: ascolti una volta e il brano resta disponibile offline, copertina compresa.'}
        {provider === 'radio' &&
          'Radio italiane in diretta: brani interi, gratis, con gli spot dell’emittente. Nessun abbonamento e nessun annuncio aggiunto dall’app. La diretta richiede connessione.'}
        {provider === 'youtube' &&
          'Ricerca tramite il server di Aura: la chiave YouTube resta sul server e non compare nel browser. La riproduzione avviene nel player ufficiale di YouTube, con i suoi annunci.'}
      </p>
    </div>
  )
}
