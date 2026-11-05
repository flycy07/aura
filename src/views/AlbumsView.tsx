import { useMemo, useState } from 'react'
import { pluralise } from '../lib/format'
import type { Track } from '../lib/types'
import { ChevronLeftIcon, MusicIcon, PlayIcon } from '../components/Icons'
import { TrackRow } from '../components/TrackRow'

type Album = {
  key: string
  name: string
  artist: string
  artUrl?: string
  tracks: Track[]
  year?: string
}

type Props = {
  tracks: Track[]
  currentTrackId?: string
  isPlaying: boolean
  onPlay: (track: Track, list: Track[]) => void
  onMenu: (track: Track) => void
}

export function AlbumsView({ tracks, currentTrackId, isPlaying, onPlay, onMenu }: Props) {
  const [openKey, setOpenKey] = useState<string | null>(null)

  const albums = useMemo(() => {
    const map = new Map<string, Album>()
    for (const track of tracks) {
      const key = `${track.album.toLowerCase()}|||${track.artist.toLowerCase()}`
      const existing = map.get(key)
      if (existing) {
        existing.tracks.push(track)
        existing.artUrl ??= track.artUrl
      } else {
        map.set(key, {
          key,
          name: track.album,
          artist: track.artist,
          artUrl: track.artUrl,
          year: track.year,
          tracks: [track],
        })
      }
    }
    return [...map.values()]
      .map((album) => ({
        ...album,
        tracks: album.tracks.sort((a, b) => (a.trackNo ?? 0) - (b.trackNo ?? 0)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'it', { sensitivity: 'base' }))
  }, [tracks])

  const album = openKey ? albums.find((item) => item.key === openKey) : undefined

  if (album) {
    return (
      <div className="album-detail">
        <button className="back-btn glass" onClick={() => setOpenKey(null)}>
          <ChevronLeftIcon size={18} /> Album
        </button>
        <div className="album-hero">
          <div className="album-hero__art">
            {album.artUrl ? <img src={album.artUrl} alt="" /> : <MusicIcon size={48} />}
          </div>
          <h2 className="album-hero__name">{album.name}</h2>
          <p className="album-hero__artist">
            {album.artist}
            {album.year ? ` · ${album.year}` : ''}
          </p>
          <p className="album-hero__meta">{pluralise(album.tracks.length, 'brano', 'brani')}</p>
          <button
            className="primary-btn glass glass--thick"
            onClick={() => album.tracks[0] && onPlay(album.tracks[0], album.tracks)}
          >
            <PlayIcon size={18} /> Riproduci
          </button>
        </div>
        <div className="list glass glass--thick">
          {album.tracks.map((track) => (
            <TrackRow
              key={track.id}
              track={track}
              active={track.id === currentTrackId}
              playing={isPlaying}
              onPlay={() => onPlay(track, album.tracks)}
              onMenu={() => onMenu(track)}
              meta={track.artist}
            />
          ))}
        </div>
      </div>
    )
  }

  if (albums.length === 0) {
    return (
      <div className="empty">
        <div className="empty__orb" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <h2 className="empty__title">Nessun album</h2>
        <p className="empty__text">Quando importi dei brani, gli album si raggruppano qui.</p>
      </div>
    )
  }

  return (
    <div className="albums">
      {albums.map((item) => (
        <button key={item.key} className="album-card" onClick={() => setOpenKey(item.key)}>
          <span className="album-card__art">
            {item.artUrl ? <img src={item.artUrl} alt="" loading="lazy" /> : <MusicIcon size={34} />}
            <span className="album-card__sheen" aria-hidden="true" />
          </span>
          <span className="album-card__name">{item.name}</span>
          <span className="album-card__artist">{item.artist}</span>
        </button>
      ))}
    </div>
  )
}
