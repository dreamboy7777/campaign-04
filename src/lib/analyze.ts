import type { Analysis } from './types'

const NAMED_COLORS: { name: string; hex: string }[] = [
  { name: 'ivory', hex: '#efe8d8' },
  { name: 'paper', hex: '#f5f1e6' },
  { name: 'cream', hex: '#e4d5b7' },
  { name: 'bone', hex: '#d6cdbd' },
  { name: 'sand', hex: '#c9b28f' },
  { name: 'amber', hex: '#b47a33' },
  { name: 'rust', hex: '#9b5a3c' },
  { name: 'burgundy', hex: '#6b2630' },
  { name: 'red', hex: '#b83b30' },
  { name: 'pink', hex: '#c9a6a6' },
  { name: 'lavender', hex: '#a89bb0' },
  { name: 'violet', hex: '#6f5a83' },
  { name: 'navy', hex: '#26314a' },
  { name: 'cobalt', hex: '#2f4f9e' },
  { name: 'sky', hex: '#93a9b8' },
  { name: 'teal', hex: '#4f7674' },
  { name: 'moss', hex: '#5d6b4a' },
  { name: 'olive', hex: '#7d7b4a' },
  { name: 'charcoal', hex: '#2f2d2a' },
  { name: 'black', hex: '#121212' },
  { name: 'grey', hex: '#8f8c84' },
  { name: 'silver', hex: '#b9babd' },
  { name: 'white', hex: '#f5f2e9' },
  { name: 'skin', hex: '#d2a98c' },
  { name: 'gold', hex: '#c9a25e' },
]

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)]
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
}

function distance(a: [number, number, number], b: [number, number, number]) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)
}

function nearestName(hex: string): string {
  const rgb = hexToRgb(hex)
  let best = NAMED_COLORS[0]
  let bestD = Infinity
  for (const c of NAMED_COLORS) {
    const d = distance(rgb, hexToRgb(c.hex))
    if (d < bestD) {
      bestD = d
      best = c
    }
  }
  return best.name
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      default:
        h = (r - g) / d + 4
    }
    h /= 6
  }
  return [h * 360, s * 100, l * 100]
}

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a
}

export async function analyzeImage(src: string): Promise<{ analysis: Analysis; width: number; height: number }> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Reference image could not be read'))
    image.src = src
  })
  const width = img.naturalWidth
  const height = img.naturalHeight
  const sampleW = 160
  const sampleH = Math.max(1, Math.round((height / width) * sampleW))
  const canvas = document.createElement('canvas')
  canvas.width = sampleW
  canvas.height = sampleH
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, sampleW, sampleH)
  const data = ctx.getImageData(0, 0, sampleW, sampleH).data
  const pixels: [number, number, number][] = []
  let lumaSum = 0
  let satSum = 0
  let warmthSum = 0
  let lumaSq = 0
  const spatial: number[][] = Array.from({ length: 8 }, () => Array(8).fill(0))
  const spatialCount: number[][] = Array.from({ length: 8 }, () => Array(8).fill(0))
  for (let y = 0; y < sampleH; y++) {
    for (let x = 0; x < sampleW; x++) {
      const i = (y * sampleW + x) * 4
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      pixels.push([r, g, b])
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
      lumaSum += luma
      lumaSq += luma * luma
      const [, s] = rgbToHsl(r, g, b)
      satSum += s
      warmthSum += r - b
      const gx = Math.min(7, Math.floor((x / sampleW) * 8))
      const gy = Math.min(7, Math.floor((y / sampleH) * 8))
      spatial[gy][gx] += luma
      spatialCount[gy][gx]++
    }
  }
  const count = pixels.length
  const brightnessRaw = lumaSum / count
  const variance = Math.max(0, lumaSq / count - brightnessRaw * brightnessRaw)
  const contrastRaw = Math.sqrt(variance)
  const avgSat = satSum / count
  const avgWarmth = warmthSum / count

  // Quantized color clusters
  const buckets = new Map<string, { r: number; g: number; b: number; n: number }>()
  for (const [r, g, b] of pixels) {
    const key = `${Math.round(r / 36)}-${Math.round(g / 36)}-${Math.round(b / 36)}`
    const bkt = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 }
    bkt.r += r
    bkt.g += g
    bkt.b += b
    bkt.n++
    buckets.set(key, bkt)
  }
  const sorted = [...buckets.values()].sort((a, b) => b.n - a.n)
  const palette: string[] = []
  for (const b of sorted) {
    const hex = rgbToHex(b.r / b.n, b.g / b.n, b.b / b.n)
    if (palette.some((p) => distance(hexToRgb(p), hexToRgb(hex)) < 42)) continue
    palette.push(hex)
    if (palette.length >= 5) break
  }
  while (palette.length < 5) palette.push(palette[palette.length - 1] ?? '#c9b28f')

  // Neighbour grain
  let grainSum = 0
  let grainN = 0
  for (let y = 1; y < sampleH - 1; y += 2) {
    for (let x = 1; x < sampleW - 1; x += 2) {
      const i = (y * sampleW + x) * 4
      const j = (y * sampleW + x + 1) * 4
      grainSum += Math.abs(data[i] - data[j]) + Math.abs(data[i + 1] - data[j + 1]) + Math.abs(data[i + 2] - data[j + 2])
      grainN++
    }
  }
  const grainRaw = grainSum / Math.max(1, grainN)

  // Negative space / busyness
  const cellLumas = spatial.map((row, y) => row.map((v, x) => v / Math.max(1, spatialCount[y][x])))
  const flat = cellLumas.flat()
  const meanCell = flat.reduce((s, v) => s + v, 0) / flat.length
  const flatCells = flat.filter((v) => Math.abs(v - meanCell) < 22).length
  const negativeSpace = Math.round((flatCells / flat.length) * 100)

  const brightness = Math.round((brightnessRaw / 255) * 100)
  const contrast = Math.round(Math.min(100, (contrastRaw / 90) * 100))
  const saturation = Math.round(Math.min(100, avgSat))
  const warmth = Math.round(Math.max(-100, Math.min(100, (avgWarmth / 90) * 100)))
  const grain = Math.round(Math.min(100, (grainRaw / 38) * 100))

  const lighting =
    brightness > 68 && contrast > 38
      ? 'high-key daylight / flash'
      : brightness < 34
        ? 'low-key / tungsten interior'
        : contrast > 55
          ? 'hard directional light'
          : warmth > 22
            ? 'warm available light'
            : 'soft diffused daylight'

  const mood: string[] = []
  if (brightness < 36) mood.push('nocturnal')
  if (brightness > 66) mood.push('airy')
  if (saturation < 25) mood.push('restrained')
  if (saturation > 58) mood.push('expressive')
  if (warmth > 24) mood.push('nostalgic')
  if (warmth < -20) mood.push('cool')
  if (grain > 55) mood.push('analog')
  if (contrast > 55) mood.push('graphic')
  if (negativeSpace > 55) mood.push('quiet')
  if (mood.length < 3) mood.push('intimate', 'editorial')

  const composition: string[] = []
  if (negativeSpace > 52) composition.push('generous negative space')
  else composition.push('dense, layered frame')
  if (contrast > 55) composition.push('strong tonal separation')
  if (brightness < 40) composition.push('shadows carry the subject')
  composition.push(Math.abs(warmth) < 15 ? 'neutral cast' : warmth > 0 ? 'warm cast' : 'cool cast')

  const era =
    grain > 62 && saturation < 38
      ? 'late-1990s / early-2000s film'
      : grain > 48 && warmth > 10
        ? 'mid-2000s consumer film'
        : grain < 22 && saturation > 45
          ? 'contemporary digital'
          : grain > 40
            ? '2000s digital / scan'
            : 'contemporary'

  const aspectGcd = gcd(width, height) || 1
  const aspect = `${Math.round(width / aspectGcd)}:${Math.round(height / aspectGcd)}`
  const orientation = width > height * 1.08 ? 'landscape' : height > width * 1.08 ? 'portrait' : 'square'

  const colorNames = palette.slice(0, 4).map(nearestName)
  const summary = `${lighting}. ${colorNames.join(', ')}. ${era}. ${composition[0]}.`

  return {
    analysis: {
      palette,
      brightness,
      contrast,
      saturation,
      warmth,
      grain,
      negativeSpace,
      aspect,
      orientation,
      lighting,
      mood: Array.from(new Set(mood)).slice(0, 5),
      composition,
      era,
      summary,
    },
    width,
    height,
  }
}

export function analysisToProfile(a: Analysis): { label: string; value: number }[] {
  return [
    { label: 'Light', value: a.brightness },
    { label: 'Contrast', value: a.contrast },
    { label: 'Chroma', value: a.saturation },
    { label: 'Warmth', value: Math.round((a.warmth + 100) / 2) },
    { label: 'Grain', value: a.grain },
    { label: 'Space', value: a.negativeSpace },
  ]
}

export function aggregateAnalyses(items: Analysis[]): Analysis | null {
  if (!items.length) return null
  const avg = (key: keyof Analysis) =>
    Math.round(items.reduce((s, a) => s + Number(a[key] ?? 0), 0) / items.length)
  const paletteCounts = new Map<string, number>()
  items.forEach((a) => a.palette.forEach((p) => paletteCounts.set(p, (paletteCounts.get(p) ?? 0) + 1)))
  const palette = [...paletteCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([p]) => p)
  const moods = Array.from(new Set(items.flatMap((a) => a.mood))).slice(0, 5)
  const comps = Array.from(new Set(items.flatMap((a) => a.composition))).slice(0, 4)
  return {
    palette,
    brightness: avg('brightness'),
    contrast: avg('contrast'),
    saturation: avg('saturation'),
    warmth: avg('warmth'),
    grain: avg('grain'),
    negativeSpace: avg('negativeSpace'),
    aspect: items[0].aspect,
    orientation: items[0].orientation,
    lighting: items[0].lighting,
    mood: moods,
    composition: comps,
    era: items[0].era,
    summary: `${items.length} references. ${moods.join(', ')}. Shared palette of ${palette.slice(0, 3).map(nearestName).join(', ')}.`,
  }
}
