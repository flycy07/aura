/**
 * Verifica la client id Jamendo senza stamparla mai.
 * Controlla: presenza nel .env, validità sull'API, preset "Italiane",
 * e che il valore sia finito nel bundle di build.
 *
 * Uso: node scripts/verify-jamendo.mjs   (dopo `npm run build`)
 */
import { readFileSync, readdirSync } from 'node:fs'

const env = readFileSync('.env', 'utf8')
const match = env.match(/^VITE_JAMENDO_CLIENT_ID=(.*)$/m)
const clientId = (match?.[1] ?? '').trim()

console.log(`key_present=${Boolean(clientId)} length=${clientId.length}`)
if (!clientId) {
  console.error('Nessuna client id nel .env: compila VITE_JAMENDO_CLIENT_ID=')
  process.exit(1)
}

const API = 'https://api.jamendo.com/v3.0'

async function call(params) {
  const url = `${API}/tracks/?${new URLSearchParams({
    client_id: clientId,
    format: 'json',
    limit: '5',
    ...params,
  })}`
  const response = await fetch(url)
  const payload = await response.json()
  return {
    http: response.status,
    status: payload.headers?.status,
    error: payload.headers?.error_message,
    results: payload.results ?? [],
  }
}

const popular = await call({ order: 'popularity_month' })
console.log(
  `audit: http=${popular.http} envelope=${popular.status} results=${popular.results.length}`,
)
if (popular.status !== 'success') console.log(`audit_error=${popular.error}`)
for (const track of popular.results.slice(0, 3)) {
  console.log('  •', `${track.artist_name} — ${track.name}`)
}
if (popular.results[0]) {
  const first = popular.results[0]
  console.log(
    `sample_fields: audio=${Boolean(first.audio)} download_allowed=${Boolean(first.audiodownload_allowed)} image=${Boolean(first.album_image || first.image)}`,
  )
}

const italianQueries = ['italiano', 'italiana', 'italian']
const italian = []
for (const query of italianQueries) {
  const response = await call({ search: query })
  console.log(`italian["${query}"]: results=${response.results.length}`)
  for (const track of response.results.slice(0, 2)) {
    console.log('    ·', `${track.artist_name} — ${track.name}`)
  }
  italian.push(...response.results)
}

const uniqueItalian = new Set(italian.map((track) => track.id)).size
console.log(`italian_merged_unique=${uniqueItalian}`)

const bundleFile = readdirSync('dist/assets').find(
  (file) => file.startsWith('index-') && file.endsWith('.js'),
)
if (bundleFile) {
  const bundle = readFileSync(`dist/assets/${bundleFile}`, 'utf8')
  console.log(`bundle=${bundleFile} bundle_contains_key=${bundle.includes(clientId)}`)
} else {
  console.log('bundle non trovato: esegui prima npm run build')
}
