import { useMemo, useState } from 'react'
import { pluralise } from '../lib/format'
import type { Track } from '../lib/types'
import type { ImportProgress } from '../hooks/useLibrary'
import { MusicIcon, PlusIcon, SearchIcon } from '../components/Icons'
import { TrackRow } from '../components/TrackRow'

type Props = {
  tracks: Track[]
  currentTrackId?: string
  isPlaying: boolean
  importing: ImportProgress
  query: string
  onQueryChange: (value: string) => void
  onImport: () => void
  onPlay: (track: Track, list: Track[]) => void
  onMenu: (track: Track) => void
}

type Sort = 'recent' | 'alpha'

export function TracksView({
  tracks,
  currentTrackId,
  isPlaying,
  importing,
  query,
  onQueryChange,
  onImport,
  onPlay,
  onMenu,
}: Props) {
  const [sort, setSort] = useState<Sort>('recent')

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const filtered = needle
      ? tracks.filter((track) =>
          [track.title, track.artist, track.album].some((field) =>
            field.toLowerCase().includes(needle),
          ),
        )
      : [...tracks]
    if (sort === 'alpha') {
      filtered.sort((a, b) => a.title.localeCompare(b.title, 'it', { sensitivity: 'base' }))
    } else {
      filtered.sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0))
    }
    return filtered
  }, [query, sort, tracks])

  if (tracks.length === 0) {
    return (
      <div className="empty">
        <div className="empty__orb" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <h2 className="empty__title">La tua musica, solo tua</h2>
        <p className="empty__text">
          Importa i file audio dal tuo iPhone. Restano salvati sul dispositivo, si ascoltano senza
          connessione, senza pubblicità e senza account.
        </p>
        <button className="primary-btn glass glass--thick" onClick={onImport}>
          <PlusIcon size={20} />
          Scegli i file
        </button>
        <p className="empty__hint">MP3, M4A, FLAC, WAV, ALAC, OGG</p>
        {importing && (
          <div className="progress glass">
            <span className="progress__label">
              Importazione {importing.done}/{importing.total}
            </span>
            <span className="progress__bar">
              <i style={{ transform: `scaleX(${importing.done / Math.max(importing.total, 1)})` }} />
            </span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="tracks">
      <div className="search glass">
        <SearchIcon size={18} />
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Cerca brani, artisti, album"
          aria-label="Cerca nella libreria"
          spellCheck={false}
        />
        {query && (
          <button className="search__clear" onClick={() => onQueryChange('')} aria-label="Cancella ricerca">
            ×
          </button>
        )}
      </div>

      <div className="tracks__bar">
        <span className="tracks__count">
          {query ? `${visible.length} risultati` : pluralise(tracks.length, 'brano', 'brani')}
        </span>
        <div className="segmented glass">
          <button
            className={sort === 'recent' ? 'is-active' : ''}
            onClick={() => setSort('recent')}
            aria-pressed={sort === 'recent'}
          >
            Recenti
          </button>
          <button
            className={sort === 'alpha' ? 'is-active' : ''}
            onClick={() => setSort('alpha')}
            aria-pressed={sort === 'alpha'}
          >
            A–Z
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="tracks__none">
          <MusicIcon size={20} /> Nessun brano per “{query}”.
        </p>
      ) : (
        <div className="list glass glass--thick">
          {visible.map((track) => (
            <TrackRow
              key={track.id}
              track={track}
              active={track.id === currentTrackId}
              playing={isPlaying}
              onPlay={() => onPlay(track, visible)}
              onMenu={() => onMenu(track)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
