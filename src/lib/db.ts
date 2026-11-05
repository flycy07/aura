import type { Playlist, StoredTrack } from './types'

const DB_NAME = 'aura-library'
const DB_VERSION = 1
const TRACKS = 'tracks'
const PLAYLISTS = 'playlists'

let connection: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (connection) return connection
  connection = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(TRACKS)) {
        db.createObjectStore(TRACKS, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(PLAYLISTS)) {
        db.createObjectStore(PLAYLISTS, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Impossibile aprire il database'))
    request.onblocked = () => reject(new Error('Database bloccato da un altra scheda'))
  })
  return connection
}

function run<T>(
  store: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode)
        const request = action(tx.objectStore(store))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error ?? new Error('Operazione sul database fallita'))
        tx.onabort = () => reject(tx.error ?? new Error('Transazione annullata'))
      }),
  )
}

export function allTracks(): Promise<StoredTrack[]> {
  return run<StoredTrack[]>(TRACKS, 'readonly', (s) => s.getAll() as IDBRequest<StoredTrack[]>).then(
    (tracks) => tracks.sort((a, b) => b.addedAt - a.addedAt),
  )
}

export function putTrack(track: StoredTrack): Promise<IDBValidKey> {
  return run(TRACKS, 'readwrite', (s) => s.put(track))
}

export function deleteTrack(id: string): Promise<void> {
  return run<undefined>(TRACKS, 'readwrite', (s) => s.delete(id) as IDBRequest<undefined>)
}

export function allPlaylists(): Promise<Playlist[]> {
  return run<Playlist[]>(PLAYLISTS, 'readonly', (s) => s.getAll() as IDBRequest<Playlist[]>).then(
    (list) => list.sort((a, b) => a.createdAt - b.createdAt),
  )
}

export function putPlaylist(playlist: Playlist): Promise<IDBValidKey> {
  return run(PLAYLISTS, 'readwrite', (s) => s.put(playlist))
}

export function deletePlaylist(id: string): Promise<void> {
  return run<undefined>(PLAYLISTS, 'readwrite', (s) => s.delete(id) as IDBRequest<undefined>)
}

export async function clearPlaylists(): Promise<void> {
  await run<undefined>(PLAYLISTS, 'readwrite', (s) => s.clear() as IDBRequest<undefined>)
}

/** Rough check so the UI can warn before iOS silently refuses a huge library. */
export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null
  const { usage = 0, quota = 0 } = await navigator.storage.estimate()
  return { usage, quota }
}
