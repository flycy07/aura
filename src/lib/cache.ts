/** Cache audio automatica: nessun download esplicito, solo ciò che hai ascoltato. */
const DB_NAME = 'aura-cache'
const STORE = 'audio'
const DB_VERSION = 1

export type CacheEntry = {
  id: string
  audio: Blob
  art?: Blob
  size: number
  lastUsed: number
}

export type CacheIndexEntry = Pick<CacheEntry, 'id' | 'size' | 'lastUsed' | 'art'>

let connection: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (connection) return connection
  connection = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Cache non disponibile'))
  })
  return connection
}

function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        const request = action(tx.objectStore(STORE))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error ?? new Error('Operazione cache fallita'))
      }),
  )
}

export function listCache(): Promise<CacheIndexEntry[]> {
  return run('readonly', (store) => store.getAll() as IDBRequest<CacheIndexEntry[]>)
}

export async function getCachedAudio(id: string): Promise<Blob | undefined> {
  const entry = (await run('readonly', (store) => store.get(id) as IDBRequest<CacheEntry | undefined>))
  return entry?.audio
}

export async function isCached(id: string): Promise<boolean> {
  const key = (await run('readonly', (store) => store.getKey(id) as IDBRequest<IDBValidKey | undefined>))
  return key !== undefined
}

export function touchCache(id: string): Promise<unknown> {
  return run('readwrite', (store) => {
    const get = store.get(id) as IDBRequest<CacheEntry | undefined>
    get.onsuccess = () => {
      const entry = get.result
      if (entry) store.put({ ...entry, lastUsed: Date.now() })
    }
    return get
  })
}

export function putCache(entry: CacheEntry): Promise<IDBValidKey> {
  return run('readwrite', (store) => store.put(entry))
}

export function deleteCache(id: string): Promise<unknown> {
  return run('readwrite', (store) => store.delete(id) as unknown as IDBRequest<unknown>)
}

/** Rimuove i brani meno usati finché lo spazio occupato non rientra nel budget. */
export async function pruneCache(maxBytes: number): Promise<number> {
  const entries = await listCache()
  let total = entries.reduce((sum, entry) => sum + entry.size, 0)
  if (total <= maxBytes) return total

  const oldestFirst = [...entries].sort((a, b) => a.lastUsed - b.lastUsed)
  for (const entry of oldestFirst) {
    if (total <= maxBytes) break
    await deleteCache(entry.id)
    total -= entry.size
  }
  return Math.max(total, 0)
}
