# Aura

Lettore musicale per iPhone sotto forma di PWA: cataloghi aperti, player YouTube ufficiale, i tuoi file, nessuna pubblicità e nessun tracciamento. Interfaccia in stile *Liquid Glass* (superfici traslucide, riflesso che segue il puntatore, tinta d'accento presa dalla copertina in ascolto).

**Demo:** https://site-07451e1ae83f477fb825d72f765944f1.freebuff.page — apri in Safari, *Condividi* → *Aggiungi a Home*.

## Cosa fa

- **Scopri** — quattro sorgenti in un'unica ricerca e nelle liste per genere:
  - **Audius**: cataloghi aperti, streaming e cache offline (CORS `*`, verificato).
  - **Jamendo**: Creative Commons, con preset "Italiane".
  - **Radio**: stazioni da radio-browser, brani interi in diretta.
  - **YouTube**: ricerca tramite un Worker che custodisce la chiave, riproduzione con la IFrame Player API ufficiale.
- **Brani** — importi MP3, M4A/ALAC, FLAC, WAV, AIFF, OGG/Opus dal selettore file di iOS; tag e copertine letti da un parser ID3v2.3/2.4, MP4 e FLAC scritto a mano. Restano in IndexedDB, niente upload.
- **Album e playlist** — album raggruppati per copertina; playlist create a mano che possono contenere **sia brani sia video YouTube**.
- **Offline automatico** — non c'è un pulsante di download: ogni brano che avvii viene copiato in IndexedDB in sottofondo (copertina inclusa) e dalla volta dopo suona senza rete. Tetto 500 MB con rimozione LRU. L'interfaccia funziona offline dopo il primo caricamento.
- **Player** — coda, shuffle, ripetizione, seek, volume, Media Session (comandi da schermo bloccato e Centro di Controllo), mini barra. I video YouTube hanno una coda propria e avanzano da soli a fine video; il player si può ridurre continuando la riproduzione.

## Perché niente pubblicità e niente estrazione audio

Aura non scarica audio da YouTube e non nasconde né copre il player: i video si guardano nel player ufficiale, annunci inclusi (con YouTube Premium non ci sono). Estrarre l'audio o oscurare gli annunci violerebbe i Termini di servizio della piattaforma. Per la musica senza pubblicità ci sono Audius, Jamendo e le radio, che distribuiscono brani interi per scelta.

Conseguenza dichiarata: **con lo schermo spento suonano i brani e le radio, non i video YouTube** (limite della piattaforma, non dell'app).

## Stack

React 19 + TypeScript strict + Vite 7, `vite-plugin-pwa` (Workbox, `autoUpdate`). Nessuna dipendenza runtime oltre a React: niente framework CSS, niente librerie di player, parser dei tag scritto a mano.

Il backend è un unico Cloudflare Worker (`deploy/worker.js`) che serve i file di build e espone `GET /api/youtube-search?q=…`. La chiave YouTube Data API v3 vive in un secret (`YOUTUBE_API_KEY`) e **non arriva mai al browser**: nessuna chiave nel bundle, quindi niente chiave visibile in console. L'endpoint accetta solo richieste same-origin, valida `Origin`/`Sec-Fetch-Site`, limita a 30 richieste al minuto per IP e restituisce solo `{ id, title, channel, seconds, thumb }`.

## Sviluppo

```bash
npm install
npm run dev       # http://localhost:3001
npm run build     # typecheck + build + service worker in dist/
npm run preview   # serve dist/
npm run icons     # rigenera le icone PWA da public/icons/icon.svg (sharp)
```

Configurazione: copia `.env.example` in `.env`.

| Variabile | Dove serve | Note |
| --- | --- | --- |
| `VITE_JAMENDO_CLIENT_ID` | build del client | Identificatore pubblico dell'app, finisce nel bundle. Se manca, l'app lo chiede e lo salva solo sul dispositivo. |
| `YOUTUBE_API_KEY` | solo Worker | Chiave di YouTube Data API v3. In locale nel `.env` per il Worker, in produzione come secret. |

`.env` e `youtube-key.txt` sono in `.gitignore`: non finiscono nel repo.

## Deploy su Cloudflare Workers

Il Worker serve sia le API sia gli asset statici di `dist/`. Una configurazione Wrangler minima:

```jsonc
{
  "name": "aura",
  "main": "deploy/worker.js",
  "compatibility_date": "2026-11-01",
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application"
  }
}
```

```bash
npm run build
npx wrangler deploy
npx wrangler secret put YOUTUBE_API_KEY   # incolla la chiave al prompt, non nel codice
```

`deploy-manifest.json` descrive lo stesso pacchetto (Worker + `dist/`) per il deployer di Freebuff Sites, se lo usi.

## Cosa resta offline

| Cosa | Serve rete? |
| --- | --- |
| Interfaccia (`dist/sw.js`) | No, dopo il primo caricamento |
| Brani Audius già ascoltati | No |
| Brani Jamendo già ascoltati | **Sì**: dipende dalle intestazioni CORS del loro CDN |
| Brani importati da File | No |
| Streaming non ancora in cache, ricerca, YouTube | Sì |

La cache automatica è un `fetch` dal browser: funziona se il CDN manda `Access-Control-Allow-Origin`. Su un campione di 10 brani Jamendo, 9 rispondevano `200 audio/mpeg` con CORS riflesso e 1 era un file assente sul CDN: in quel caso l'app mostra un avviso invece di restare in silenzio.

## Note e limiti

- È una PWA, non un'app nativa: non è pubblicabile su App Store così com'è, servirebbe un progetto SwiftUI o un wrapper Capacitor firmato.
- Se cancelli i dati del sito da Safari, la libreria locale e la cache spariscono: tieni una copia dei file importati.
- L'API Audius è pubblica e può rallentare o rispondere con errore: in quel caso l'app mostra "Riprova" e i file locali restano utilizzabili.

## Struttura

```
src/
  App.tsx                  composizione UI, sessione YouTube, coda, avvisi
  lib/audius.ts            catalogo Audius (trending, ricerca, stream)
  lib/jamendo.ts           catalogo Jamendo
  lib/radio.ts             stazioni radio-browser
  lib/youtube.ts           client dell'endpoint /api/youtube-search
  lib/cache.ts, lib/db.ts  IndexedDB della libreria e cache offline (LRU 500 MB)
  lib/tags.ts              parser ID3 / MP4 / FLAC
  lib/colors.ts            colore dominante dalla copertina
  hooks/useLibrary.ts      libreria, import, playlist miste
  hooks/useAudioPlayer.ts  coda, shuffle, repeat, Media Session
  hooks/useOfflineCache.ts cache automatica dei brani in ascolto
  views/                   Scopri, Brani, Album, Playlist
  components/              NowPlaying, MiniPlayer, TabBar, Sheet, YouTube
  styles.css               sistema Liquid Glass
deploy/worker.js           Worker: /api/youtube-search + asset statici
```

## Crediti

Catalogo e streaming: [Audius](https://audius.co), [Jamendo](https://www.jamendo.com), [radio-browser](https://www.radio-browser.info). Ricerca e riproduzione video: YouTube Data API v3 e IFrame Player API. Aura non è affiliata a nessuno di questi servizi.
