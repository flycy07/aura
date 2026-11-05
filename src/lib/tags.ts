export type Tags = {
  title?: string
  artist?: string
  album?: string
  year?: string
  trackNo?: number
  art?: Blob
}

/** Tags and cover art sit at the start of the file; reading 8 MB keeps big files fast. */
const HEAD_BYTES = 8 * 1024 * 1024

export async function readTags(file: File): Promise<Tags> {
  const head = await file.slice(0, Math.min(file.size, HEAD_BYTES)).arrayBuffer()
  const bytes = new Uint8Array(head)
  try {
    if (bytes.length > 10 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
      return parseId3(bytes)
    }
    if (bytes.length > 12 && ascii(bytes, 4, 4) === 'ftyp') return parseMp4(bytes)
    if (bytes.length > 8 && ascii(bytes, 0, 4) === 'fLaC') return parseFlac(bytes)
  } catch {
    // A malformed tag block should never stop an import.
  }
  return {}
}

/* ---------------------------------------------------------------- helpers */

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  let out = ''
  for (let i = 0; i < length; i++) {
    const byte = bytes[offset + i]
    if (byte === undefined) break
    out += String.fromCharCode(byte)
  }
  return out
}

function view(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
}

function uint32be(bytes: Uint8Array, offset: number): number {
  return view(bytes).getUint32(offset, false)
}

function uint32le(bytes: Uint8Array, offset: number): number {
  return view(bytes).getUint32(offset, true)
}

function uint64be(bytes: Uint8Array, offset: number): number {
  return Number(view(bytes).getBigUint64(offset, false))
}

function syncsafe(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] & 0x7f) << 21) |
    ((bytes[offset + 1] & 0x7f) << 14) |
    ((bytes[offset + 2] & 0x7f) << 7) |
    (bytes[offset + 3] & 0x7f)
  )
}

function indexOfZero(bytes: Uint8Array, from: number, to: number): number {
  for (let i = from; i < to; i++) if (bytes[i] === 0) return i
  return -1
}

/* ------------------------------------------------------------------- ID3v2 */

function parseId3(bytes: Uint8Array): Tags {
  const version = bytes[3]
  if (version < 3) return {}
  const flags = bytes[5]
  const size = syncsafe(bytes, 6)
  let pos = 10
  if (flags & 0x40) {
    const extended = version === 4 ? syncsafe(bytes, pos) : uint32be(bytes, pos)
    pos += Math.max(extended, 4)
  }
  const end = Math.min(bytes.length, 10 + size)
  const tags: Tags = {}

  while (pos + 10 <= end) {
    const id = ascii(bytes, pos, 4)
    if (!/^[A-Z0-9]{4}$/.test(id)) break
    const frameSize = version === 4 ? syncsafe(bytes, pos + 4) : uint32be(bytes, pos + 4)
    if (frameSize <= 0 || pos + 10 + frameSize > end) break
    const frameFlags = (bytes[pos + 8] << 8) | bytes[pos + 9]
    const payload = bytes.subarray(pos + 10, pos + 10 + frameSize)
    // Skip compressed / encrypted / unsynchronised frames: we cannot read them safely.
    if (frameFlags & 0x00c0 || (version === 4 && frameFlags & 0x000c)) {
      pos += 10 + frameSize
      continue
    }

    switch (id) {
      case 'TIT2':
        tags.title = decodeText(payload)
        break
      case 'TPE1':
        tags.artist = decodeText(payload)
        break
      case 'TALB':
        tags.album = decodeText(payload)
        break
      case 'TYER':
      case 'TDRC':
        tags.year = decodeText(payload)?.slice(0, 4)
        break
      case 'TRCK': {
        const n = Number.parseInt(decodeText(payload) ?? '', 10)
        if (n > 0) tags.trackNo = n
        break
      }
      case 'APIC': {
        const art = parseApic(payload)
        if (art && !tags.art) tags.art = art
        break
      }
    }
    pos += 10 + frameSize
  }
  return tags
}

function decodeText(payload: Uint8Array): string | undefined {
  if (payload.length < 1) return undefined
  const encoding = payload[0]
  const body = payload.subarray(1)
  let text = ''
  if (encoding === 0) {
    text = new TextDecoder('latin1').decode(body)
  } else if (encoding === 1) {
    const bigEndian = body[0] === 0xfe && body[1] === 0xff
    const littleEndian = body[0] === 0xff && body[1] === 0xfe
    const start = bigEndian || littleEndian ? 2 : 0
    text = new TextDecoder(bigEndian ? 'utf-16be' : 'utf-16le').decode(body.subarray(start))
  } else if (encoding === 2) {
    text = new TextDecoder('utf-16be').decode(body)
  } else {
    text = new TextDecoder('utf-8').decode(body)
  }
  return text.replace(/\0+$/, '').trim() || undefined
}

function parseApic(payload: Uint8Array): Blob | undefined {
  if (payload.length < 4) return undefined
  const encoding = payload[0]
  let i = 1
  const mimeEnd = indexOfZero(payload, i, payload.length)
  if (mimeEnd < 0) return undefined
  const mime = ascii(payload, i, mimeEnd - i) || 'image/jpeg'
  i = mimeEnd + 1 + 1 // mime terminator + picture type

  if (encoding === 1 || encoding === 2) {
    while (i + 1 < payload.length && !(payload[i] === 0 && payload[i + 1] === 0)) i += 2
    i += 2
  } else {
    const descEnd = indexOfZero(payload, i, payload.length)
    if (descEnd < 0) return undefined
    i = descEnd + 1
  }
  if (i >= payload.length) return undefined
  const data = payload.slice(i)
  if (data.length < 64) return undefined
  return new Blob([data], { type: normalizeImageMime(mime) })
}

function normalizeImageMime(mime: string): string {
  const lower = mime.toLowerCase()
  if (lower === 'image/jpg' || lower === 'jpeg') return 'image/jpeg'
  if (lower === 'png') return 'image/png'
  return lower.startsWith('image/') ? lower : 'image/jpeg'
}

/* ------------------------------------------------------------------ MP4/M4A */

type Atom = { type: string; start: number; end: number }

function childAtoms(bytes: Uint8Array, from: number, to: number): Atom[] {
  const atoms: Atom[] = []
  let p = from
  while (p + 8 <= to) {
    let size = uint32be(bytes, p)
    const type = ascii(bytes, p + 4, 4)
    let header = 8
    if (size === 1) {
      if (p + 16 > to) break
      size = uint64be(bytes, p + 8)
      header = 16
    } else if (size === 0) {
      size = to - p
    }
    if (size < header || p + size > to) break
    atoms.push({ type, start: p + header, end: p + size })
    p += size
  }
  return atoms
}

function findPath(bytes: Uint8Array, from: number, to: number, path: string[]): Atom | null {
  let atoms = childAtoms(bytes, from, to)
  let current: Atom | null = null
  for (const step of path) {
    current = atoms.find((atom) => atom.type === step) ?? null
    if (!current) return null
    // `meta` carries a 4 byte version/flags field before its children.
    const nextFrom = step === 'meta' ? current.start + 4 : current.start
    atoms = childAtoms(bytes, nextFrom, current.end)
  }
  return current
}

function parseMp4(bytes: Uint8Array): Tags {
  const tags: Tags = {}
  const ilst = findPath(bytes, 0, bytes.length, ['moov', 'udta', 'meta', 'ilst'])
  if (!ilst) return tags

  for (const item of childAtoms(bytes, ilst.start, ilst.end)) {
    const data = childAtoms(bytes, item.start, item.end).find((atom) => atom.type === 'data')
    if (!data) continue
    const valueStart = data.start + 8 // 4 byte type flags + 4 byte locale
    if (valueStart > data.end) continue
    const value = bytes.subarray(valueStart, data.end)

    switch (item.type) {
      case '\u00A9nam':
        tags.title = decodeUtf8(value)
        break
      case '\u00A9ART':
        tags.artist = decodeUtf8(value)
        break
      case '\u00A9alb':
        tags.album = decodeUtf8(value)
        break
      case '\u00A9day':
        tags.year = decodeUtf8(value)?.slice(0, 4)
        break
      case 'trkn': {
        if (value.length >= 4) {
          const n = (value[2] << 8) | value[3]
          if (n > 0) tags.trackNo = n
        }
        break
      }
      case 'covr': {
        if (value.length > 64 && !tags.art) {
          const isPng = value[0] === 0x89 && value[1] === 0x50
          tags.art = new Blob([value.slice()], { type: isPng ? 'image/png' : 'image/jpeg' })
        }
        break
      }
    }
  }
  return tags
}

function decodeUtf8(value: Uint8Array): string | undefined {
  const text = new TextDecoder('utf-8').decode(value).replace(/\0+$/, '').trim()
  return text || undefined
}

/* --------------------------------------------------------------------- FLAC */

function parseFlac(bytes: Uint8Array): Tags {
  const tags: Tags = {}
  let pos = 4
  while (pos + 4 <= bytes.length) {
    const isLast = (bytes[pos] & 0x80) !== 0
    const type = bytes[pos] & 0x7f
    const length = (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3]
    const start = pos + 4
    const end = Math.min(bytes.length, start + length)
    if (end <= start) break

    if (type === 4) readVorbisComments(bytes, start, end, tags)
    else if (type === 6) readFlacPicture(bytes, start, end, tags)

    if (isLast) break
    pos = end
  }
  return tags
}

function readVorbisComments(bytes: Uint8Array, start: number, end: number, tags: Tags) {
  let p = start
  if (p + 4 > end) return
  const vendorLength = uint32le(bytes, p)
  p += 4 + vendorLength
  if (p + 4 > end) return
  const count = uint32le(bytes, p)
  p += 4
  for (let i = 0; i < count && p + 4 <= end; i++) {
    const length = uint32le(bytes, p)
    p += 4
    if (length <= 0 || p + length > end) break
    const entry = new TextDecoder('utf-8').decode(bytes.slice(p, p + length))
    p += length
    const separator = entry.indexOf('=')
    if (separator < 1) continue
    const key = entry.slice(0, separator).toUpperCase()
    const value = entry.slice(separator + 1).trim()
    if (!value) continue
    if (key === 'TITLE') tags.title = value
    else if (key === 'ARTIST') tags.artist ??= value
    else if (key === 'ALBUM') tags.album = value
    else if (key === 'DATE') tags.year = value.slice(0, 4)
    else if (key === 'TRACKNUMBER') {
      const n = Number.parseInt(value, 10)
      if (n > 0) tags.trackNo = n
    }
  }
}

function readFlacPicture(bytes: Uint8Array, start: number, end: number, tags: Tags) {
  let p = start + 4 // picture type
  if (p + 4 > end) return
  const mimeLength = uint32be(bytes, p)
  p += 4
  const mime = ascii(bytes, p, mimeLength) || 'image/jpeg'
  p += mimeLength
  if (p + 4 > end) return
  const descriptionLength = uint32be(bytes, p)
  p += 4 + descriptionLength + 16 // width, height, depth, colours
  if (p + 4 > end) return
  const dataLength = uint32be(bytes, p)
  p += 4
  if (dataLength <= 64 || p + dataLength > end) return
  tags.art = new Blob([bytes.slice(p, p + dataLength)], { type: normalizeImageMime(mime) })
}
