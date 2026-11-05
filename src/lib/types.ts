export type TrackSource = 'local' | 'audius' | 'jamendo' | 'radio'

export type Track = {
  id: string
  title: string
  artist: string
  album: string
  year?: string
  trackNo?: number
  duration: number
  /** cover image URL: object URL for local files, remote URL for streams */
  artUrl?: string
  artColor?: string
  /** local file, present on library tracks */
  audio?: Blob
  /** remote stream; present on catalogue tracks that were not saved yet */
  streamUrl?: string
  remoteId?: string
  source?: TrackSource
  size?: number
  mime?: string
  /** milliseconds since epoch, library tracks only */
  addedAt?: number
}

export type StoredTrack = Track & {
  audio: Blob
  size: number
  addedAt: number
  /** name + size (local) or provider id, used to skip duplicates */
  fingerprint: string
  fileName: string
  art?: Blob
}

/** Video YouTube salvato in una playlist: si riproduce nel player ufficiale. */
export type PlaylistVideo = {
  id: string
  title: string
  channel: string
  seconds: number
  thumb: string
}

export type Playlist = {
  id: string
  name: string
  trackIds: string[]
  /** Video YouTube della playlist, oltre ai brani della libreria. */
  videos: PlaylistVideo[]
  createdAt: number
  updatedAt: number
}

export type Tab = 'discover' | 'tracks' | 'albums' | 'playlists'
export type RepeatMode = 'off' | 'all' | 'one'
