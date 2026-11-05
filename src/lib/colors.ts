const FALLBACK = 'hsl(248 62% 62%)'

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Immagine non leggibile'))
    }
    image.src = url
  })
}

/**
 * Pulls a usable accent colour out of cover art: saturate, mid-brightness pixels win,
 * hues are averaged as vectors so a red/blue mix does not average to grey.
 */
export async function extractAccent(blob: Blob): Promise<string> {
  try {
    const image = await loadImage(blob)
    const size = 32
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return FALLBACK
    context.drawImage(image, 0, 0, size, size)
    const { data } = context.getImageData(0, 0, size, size)

    let x = 0
    let y = 0
    let weightSum = 0
    let saturationSum = 0
    let lightnessSum = 0

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] / 255
      const g = data[i + 1] / 255
      const b = data[i + 2] / 255
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const lightness = (max + min) / 2
      if (lightness < 0.12 || lightness > 0.9) continue
      const delta = max - min
      const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1))
      if (saturation < 0.15) continue

      let hue = 0
      if (max === r) hue = ((g - b) / delta) % 6
      else if (max === g) hue = (b - r) / delta + 2
      else hue = (r - g) / delta + 4
      hue = ((hue * 60) + 360) % 360

      const weight = saturation * (1 - Math.abs(lightness - 0.55))
      const radians = (hue * Math.PI) / 180
      x += Math.cos(radians) * weight
      y += Math.sin(radians) * weight
      weightSum += weight
      saturationSum += saturation * weight
      lightnessSum += lightness * weight
    }

    if (weightSum < 1) return FALLBACK

    const hue = ((Math.atan2(y / weightSum, x / weightSum) * 180) / Math.PI + 360) % 360
    const saturation = Math.min(0.9, Math.max(0.35, saturationSum / weightSum))
    const lightness = Math.min(0.72, Math.max(0.5, lightnessSum / weightSum + 0.12))
    return `hsl(${hue.toFixed(0)} ${(saturation * 100).toFixed(0)}% ${(lightness * 100).toFixed(0)}%)`
  } catch {
    return FALLBACK
  }
}
