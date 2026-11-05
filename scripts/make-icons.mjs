import { mkdir, writeFile } from 'node:fs/promises'
import sharp from 'sharp'

const OUT = 'public/icons'
await mkdir(OUT, { recursive: true })

function svg({ size = 512, padding = 0, rounded = true }) {
  const s = size
  const inset = s * (padding / 100)
  const box = s - inset * 2
  const cx = s / 2
  const cy = s / 2
  const r = box * 0.36
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#9fd4ff"/>
      <stop offset="0.45" stop-color="#b7a4ff"/>
      <stop offset="0.75" stop-color="#ff9fd6"/>
      <stop offset="1" stop-color="#ffd7a8"/>
    </linearGradient>
    <radialGradient id="sheen" cx="0.28" cy="0.16" r="0.95">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.5"/>
      <stop offset="0.55" stop-color="#ffffff" stop-opacity="0.05"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="core" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#2a2350"/>
      <stop offset="1" stop-color="#0a0a12"/>
    </radialGradient>
  </defs>
  <rect width="${s}" height="${s}" ${rounded ? `rx="${s * 0.225}"` : ''} fill="#07070b"/>
  <circle cx="${cx}" cy="${cy}" r="${r * 1.12}" fill="url(#core)" opacity="0.9"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="url(#ring)" stroke-width="${s * 0.024}" opacity="0.95"/>
  <circle cx="${cx}" cy="${cy}" r="${r * 0.7}" fill="none" stroke="url(#ring)" stroke-width="${s * 0.012}" opacity="0.6"/>
  <circle cx="${cx}" cy="${cy}" r="${r * 0.4}" fill="none" stroke="url(#ring)" stroke-width="${s * 0.008}" opacity="0.4"/>
  <circle cx="${cx}" cy="${cy}" r="${r * 0.09}" fill="url(#ring)"/>
  <rect width="${s}" height="${s}" ${rounded ? `rx="${s * 0.225}"` : ''} fill="url(#sheen)"/>
</svg>`
}

const targets = [
  { file: 'icon.svg', render: svg({ size: 512 }) },
  { file: 'icon-192.png', render: svg({ size: 512 }), resize: 192 },
  { file: 'icon-512.png', render: svg({ size: 512 }), resize: 512 },
  // iOS masks the icon itself: keep the artwork inside the safe area, no rounding.
  {
    file: 'apple-touch-icon.png',
    render: svg({ size: 512, padding: 12, rounded: false }),
    resize: 180,
  },
  {
    file: 'icon-maskable-512.png',
    render: svg({ size: 512, padding: 18, rounded: false }),
    resize: 512,
  },
]

for (const t of targets) {
  const body = Buffer.from(t.render)
  if (t.file.endsWith('.svg')) {
    await writeFile(`${OUT}/${t.file}`, body)
    continue
  }
  await sharp(body, { density: 384 })
    .resize(t.resize ?? 512, t.resize ?? 512)
    .png({ compressionLevel: 9 })
    .toFile(`${OUT}/${t.file}`)
  }
console.log(`icons written to ${OUT}`)
