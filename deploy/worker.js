// Aura è un'app statica: il Worker serve i file di build e, per la ricerca
// musicale, fa da tramite verso YouTube Data API v3 custodendo la chiave in un
// secret (env.YOUTUBE_API_KEY). La chiave non arriva mai al browser.

const API = 'https://www.googleapis.com/youtube/v3'
const LIMIT_PER_MINUTE = 30

const hits = new Map()

function rateLimited(ip) {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((time) => now - time < 60_000)
  recent.push(now)
  hits.set(ip, recent)
  if (hits.size > 5000) hits.clear()
  return recent.length > LIMIT_PER_MINUTE
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

/** PT3M27S → 207 */
function parseDuration(value) {
  const match = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value ?? '')
  if (!match) return 0
  return (
    Number(match[1] ?? 0) * 86400 +
    Number(match[2] ?? 0) * 3600 +
    Number(match[3] ?? 0) * 60 +
    Number(match[4] ?? 0)
  )
}

async function call(path, params) {
  const response = await fetch(`${API}/${path}?${new URLSearchParams(params)}`)
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const reason = payload?.error?.errors?.[0]?.reason ?? ''
    return { error: reason || `http_${response.status}` }
  }
  return { data: payload }
}

async function searchYouTube(key, term) {
  const base = {
    part: 'snippet',
    type: 'video',
    maxResults: '25',
    regionCode: 'IT',
    q: term,
    key,
  }

  let found = await call('search', { ...base, videoCategoryId: '10' })
  if (found.error) return found
  let items = found.data?.items ?? []

  // Alcuni artisti non hanno video classificati come Musica.
  if (!items.length) {
    found = await call('search', base)
    if (found.error) return found
    items = found.data?.items ?? []
  }

  const ids = items.map((item) => item.id?.videoId).filter(Boolean)
  if (!ids.length) return { data: { videos: [] } }

  const details = await call('videos', {
    part: 'contentDetails',
    id: ids.join(','),
    maxResults: '50',
    key,
  })
  if (details.error) return details

  const durations = new Map(
    (details.data?.items ?? []).map((item) => [item.id, parseDuration(item.contentDetails?.duration)]),
  )

  return {
    data: {
      videos: items
        .filter((item) => item.id?.videoId)
        .map((item) => ({
          id: item.id.videoId,
          title: item.snippet?.title ?? 'Senza titolo',
          channel: item.snippet?.channelTitle ?? '',
          seconds: durations.get(item.id.videoId) ?? 0,
          thumb: item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? '',
        })),
    },
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname === '/api/youtube-search') {
      if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405)

      const origin = request.headers.get('origin')
      if (origin) {
        try {
          if (new URL(origin).host !== url.host) return json({ error: 'forbidden_origin' }, 403)
        } catch {
          return json({ error: 'forbidden_origin' }, 403)
        }
      }
      const site = request.headers.get('sec-fetch-site')
      if (site && site !== 'same-origin' && site !== 'none') return json({ error: 'forbidden_origin' }, 403)

      const ip = request.headers.get('cf-connecting-ip') ?? 'anonimo'
      if (rateLimited(ip)) return json({ error: 'rate_limited' }, 429)

      const key = (env.YOUTUBE_API_KEY ?? '').trim()
      if (!key) return json({ error: 'missing_key' }, 503)

      const term = (url.searchParams.get('q') ?? '').trim().slice(0, 120)
      if (!term) return json({ error: 'missing_query' }, 400)

      const result = await searchYouTube(key, term)
      if (result.error) {
        if (result.error === 'quotaExceeded') return json({ error: 'quota_exceeded' }, 429)
        if (result.error === 'keyInvalid' || result.error === 'badRequest') return json({ error: 'invalid_key' }, 502)
        if (result.error === 'ipRefererBlocked') return json({ error: 'referer_blocked' }, 502)
        return json({ error: 'upstream_error' }, 502)
      }
      return json(result.data)
    }

    return env.ASSETS.fetch(request)
  },
}
