import { loadImage } from './imageStore'
import type { ZinePageLayout, ZineTextBlock, ZineTextLayout } from './types'
import { textTransform } from './zineText'

export interface Adjustments {
  exposure: number
  contrast: number
  highlights: number
  shadows: number
  temperature: number
  tint: number
  saturation: number
  fade: number
  grain: number
  blur: number
  vignette: number
  halation: number
  aberration: number
  dust: number
  scratches: number
  leak: number
  flash: number
}

export const DEFAULT_ADJUSTMENTS: Adjustments = {
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  temperature: 0,
  tint: 0,
  saturation: 0,
  fade: 0,
  grain: 0,
  blur: 0,
  vignette: 0,
  halation: 0,
  aberration: 0,
  dust: 0,
  scratches: 0,
  leak: 0,
  flash: 0,
}

export interface TextLayer {
  id: string
  type: 'text' | 'stamp' | 'shape'
  text: string
  x: number
  y: number
  size: number
  font: string
  color: string
  opacity: number
  blend: GlobalCompositeOperation
  rotation: number
  letterSpacing: number
  visible: boolean
  align: CanvasTextAlign
  weight: number
  italic: boolean
}

export interface CropState {
  aspect: string
  zoom: number
  offsetX: number
  offsetY: number
  rotation: number
  flipX: boolean
}

export const DEFAULT_CROP: CropState = { aspect: 'original', zoom: 1, offsetX: 0, offsetY: 0, rotation: 0, flipX: false }

export interface DarkroomState {
  adjustments: Adjustments
  crop: CropState
  layers: TextLayer[]
}

export interface DarkroomLayerBox {
  x: number
  y: number
  w: number
  h: number
}

export interface DarkroomCanvas extends HTMLCanvasElement {
  layerBoxes?: Record<string, DarkroomLayerBox>
}

export const DEFAULT_DARKROOM: DarkroomState = {
  adjustments: { ...DEFAULT_ADJUSTMENTS },
  crop: { ...DEFAULT_CROP },
  layers: [],
}

export function clamp(v: number, min = 0, max = 255) {
  return v < min ? min : v > max ? max : v
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)]
}

export function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  focusX = 0.5,
  focusY = 0.5,
) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight)
  const sw = w / scale
  const sh = h / scale
  const sx = clamp((img.naturalWidth - sw) * focusX, 0, img.naturalWidth - sw)
  const sy = clamp((img.naturalHeight - sh) * focusY, 0, img.naturalHeight - sh)
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
}

export function outputDimensions(img: HTMLImageElement, crop: CropState, maxWidth = 900) {
  let aspect = img.naturalWidth / img.naturalHeight
  if (crop.aspect !== 'original') {
    const [a, b] = crop.aspect.split(':').map(Number)
    if (a && b) aspect = a / b
  }
  const w = Math.min(maxWidth, img.naturalWidth)
  const h = Math.round(w / aspect)
  return { width: w, height: h, aspect }
}

function drawCroppedSource(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
  crop: CropState,
  blur = 0,
) {
  ctx.save()
  ctx.translate(w / 2, h / 2)
  if (crop.rotation) ctx.rotate((crop.rotation * Math.PI) / 180)
  if (crop.flipX) ctx.scale(-1, 1)
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight) * crop.zoom
  const dw = img.naturalWidth * scale
  const dh = img.naturalHeight * scale
  const dx = -dw / 2 + (crop.offsetX / 100) * w
  const dy = -dh / 2 + (crop.offsetY / 100) * h
  if (blur > 0) ctx.filter = `blur(${blur}px)`
  ctx.drawImage(img, dx, dy, dw, dh)
  ctx.restore()
  return { scale, dw, dh, dx, dy }
}

function hashNoise(x: number, y: number, seed = 1) {
  let n = Math.imul(x + seed * 31, 374761393) + Math.imul(y + seed * 17, 668265263)
  n = (n ^ (n >>> 13)) * 1274126177
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295
}

export function applyAdjustments(canvas: HTMLCanvasElement, adj: Adjustments) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return
  const { width, height } = canvas
  const image = ctx.getImageData(0, 0, width, height)
  const d = image.data
  const exposure = Math.pow(2, (adj.exposure + adj.flash * 0.35) / 42)
  const contrast = 1 + adj.contrast / 100 + adj.flash / 400
  const saturation = 1 + adj.saturation / 100
  const temp = adj.temperature * 0.55
  const tint = adj.tint * 0.45
  const fade = adj.fade / 100
  const shadows = adj.shadows / 100
  const highlights = adj.highlights / 100
  const grain = adj.grain / 100
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i]
    let g = d[i + 1]
    let b = d[i + 2]
    if (adj.blur === 0) {
      r *= exposure
      g *= exposure
      b *= exposure
      r = (r - 128) * contrast + 128
      g = (g - 128) * contrast + 128
      b = (b - 128) * contrast + 128
      r += temp
      g += tint
      b -= temp * 0.8
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
      r = luma + (r - luma) * saturation
      g = luma + (g - luma) * saturation
      b = luma + (b - luma) * saturation
      // highlight / shadow shaping
      const l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
      if (l > 0.55) {
        const f = (l - 0.55) / 0.45
        r += highlights * 90 * f
        g += highlights * 90 * f
        b += highlights * 90 * f
      } else {
        const f = 1 - l / 0.55
        r += shadows * 70 * f
        g += shadows * 70 * f
        b += shadows * 70 * f
      }
      // fade lifts blacks and compresses highlights
      r = r * (1 - fade * 0.32) + 255 * fade * 0.2
      g = g * (1 - fade * 0.32) + 250 * fade * 0.19
      b = b * (1 - fade * 0.32) + 235 * fade * 0.18
      if (grain > 0) {
        const px = (i / 4) % width
        const py = Math.floor(i / 4 / width)
        const n = (hashNoise(px >> 1, py >> 1) - 0.5) * 64 * grain
        r += n
        g += n
        b += n
      }
      d[i] = clamp(r)
      d[i + 1] = clamp(g)
      d[i + 2] = clamp(b)
    }
  }
  ctx.putImageData(image, 0, 0)
}

function drawHalation(canvas: HTMLCanvasElement, amount: number) {
  if (amount <= 0) return
  const ctx = canvas.getContext('2d')!
  const { width, height } = canvas
  const temp = document.createElement('canvas')
  temp.width = width
  temp.height = height
  const tctx = temp.getContext('2d')!
  tctx.drawImage(canvas, 0, 0)
  tctx.globalCompositeOperation = 'source-over'
  tctx.fillStyle = 'rgba(120,35,25,0.18)'
  tctx.fillRect(0, 0, width, height)
  tctx.globalCompositeOperation = 'multiply'
  tctx.drawImage(canvas, 0, 0)
  tctx.globalCompositeOperation = 'source-over'
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.globalAlpha = (amount / 100) * 0.42
  ctx.filter = `blur(${Math.max(2, Math.round(width / 48))}px)`
  ctx.drawImage(temp, 0, 0)
  ctx.restore()
}

function drawAberration(canvas: HTMLCanvasElement, amount: number) {
  if (amount <= 0) return
  const ctx = canvas.getContext('2d')!
  const { width, height } = canvas
  const temp = document.createElement('canvas')
  temp.width = width
  temp.height = height
  temp.getContext('2d')!.drawImage(canvas, 0, 0)
  const shift = Math.max(1, Math.round((amount / 100) * (width / 220)))
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.globalAlpha = 0.16
  ctx.drawImage(temp, shift, 0)
  ctx.globalCompositeOperation = 'multiply'
  ctx.globalAlpha = 0.1
  ctx.drawImage(temp, -shift, 0)
  ctx.restore()
}

function drawVignette(canvas: HTMLCanvasElement, amount: number) {
  if (amount <= 0) return
  const ctx = canvas.getContext('2d')!
  const { width, height } = canvas
  const grad = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.18, width / 2, height / 2, Math.max(width, height) * 0.72)
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(0.65, 'rgba(0,0,0,0)')
  grad.addColorStop(1, `rgba(0,0,0,${(amount / 100) * 0.72})`)
  ctx.save()
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, width, height)
  ctx.restore()
}

function drawTexture(canvas: HTMLCanvasElement, dust: number, scratches: number, leak: number) {
  const ctx = canvas.getContext('2d')!
  const { width, height } = canvas
  ctx.save()
  if (dust > 0) {
    const count = Math.round((dust / 100) * 180)
    for (let i = 0; i < count; i++) {
      const x = hashNoise(i, 11) * width
      const y = hashNoise(i, 29) * height
      const r = 0.4 + hashNoise(i, 43) * 2.2
      ctx.fillStyle = hashNoise(i, 51) > 0.82 ? `rgba(255,250,235,${0.18 + hashNoise(i, 52) * 0.5})` : `rgba(20,16,12,${0.12 + hashNoise(i, 53) * 0.4})`
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  if (scratches > 0) {
    const count = Math.round((scratches / 100) * 12)
    for (let i = 0; i < count; i++) {
      const x = hashNoise(i, 71) * width
      const alpha = 0.1 + hashNoise(i, 73) * 0.28
      ctx.strokeStyle = `rgba(250,240,220,${alpha})`
      ctx.lineWidth = 0.5 + hashNoise(i, 79) * 1.2
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.bezierCurveTo(x + (hashNoise(i, 81) - 0.5) * 30, height * 0.3, x + (hashNoise(i, 83) - 0.5) * 40, height * 0.7, x + (hashNoise(i, 87) - 0.5) * 24, height)
      ctx.stroke()
    }
  }
  if (leak > 0) {
    const x = width * (0.08 + hashNoise(3, 91) * 0.8)
    const grad = ctx.createRadialGradient(x, 0, 0, x, 0, Math.max(width, height) * 0.65)
    grad.addColorStop(0, `rgba(225,96,48,${(leak / 100) * 0.52})`)
    grad.addColorStop(0.45, `rgba(190,60,70,${(leak / 100) * 0.18})`)
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.globalCompositeOperation = 'screen'
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, width, height)
  }
  ctx.restore()
}

function drawSpacedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number,
  maxWidth?: number,
) {
  if (spacing === 0) {
    if (maxWidth) ctx.fillText(text, x, y, maxWidth)
    else ctx.fillText(text, x, y)
    return
  }
  const chars = [...text]
  const widths = chars.map((c) => ctx.measureText(c).width)
  const total = widths.reduce((s, w) => s + w, 0) + spacing * (chars.length - 1)
  let cx = ctx.textAlign === 'center' ? x - total / 2 : ctx.textAlign === 'right' ? x - total : x
  chars.forEach((c, i) => {
    ctx.fillText(c, cx, y)
    cx += widths[i] + spacing
  })
}

export function renderDarkroom(
  img: HTMLImageElement,
  state: DarkroomState,
  options: { maxWidth?: number; showSafeArea?: boolean; overlays?: { asset?: HTMLImageElement; x: number; y: number; w: number; h: number; opacity: number; blend: GlobalCompositeOperation }[] } = {},
) {
  const { width, height } = outputDimensions(img, state.crop, options.maxWidth ?? 860)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.fillStyle = '#111'
  ctx.fillRect(0, 0, width, height)
  drawCroppedSource(ctx, img, width, height, state.crop, state.adjustments.blur)
  applyAdjustments(canvas, state.adjustments)
  drawHalation(canvas, state.adjustments.halation)
  drawAberration(canvas, state.adjustments.aberration)
  drawVignette(canvas, state.adjustments.vignette)
  drawTexture(canvas, state.adjustments.dust, state.adjustments.scratches, state.adjustments.leak)

  if (options.overlays) {
    for (const o of options.overlays) {
      if (!o.asset) continue
      ctx.save()
      ctx.globalAlpha = o.opacity
      ctx.globalCompositeOperation = o.blend
      ctx.drawImage(o.asset, o.x, o.y, o.w, o.h)
      ctx.restore()
    }
  }

  const layerBoxes: Record<string, DarkroomLayerBox> = {}
  for (const layer of state.layers) {
    if (!layer.visible) continue
    ctx.save()
    ctx.globalAlpha = layer.opacity
    ctx.globalCompositeOperation = layer.blend
    ctx.translate((layer.x / 100) * width, (layer.y / 100) * height)
    if (layer.rotation) ctx.rotate((layer.rotation * Math.PI) / 180)
    ctx.fillStyle = layer.color
    ctx.textAlign = layer.align
    if (layer.type === 'shape') {
      ctx.fillRect(-width * 0.06, -height * 0.002, width * 0.12, Math.max(1, layer.size))
      layerBoxes[layer.id] = {
        x: ((layer.x / 100) * width - width * 0.06) / width,
        y: ((layer.y / 100) * height - height * 0.002) / height,
        w: (width * 0.12) / width,
        h: Math.max(1, layer.size) / height,
      }
    } else {
      const size = (layer.size / 100) * height
      ctx.font = `${layer.italic ? 'italic ' : ''}${layer.weight} ${size}px ${layer.font}`
      const lines = layer.text.split('\n')
      lines.forEach((line, i) => {
        drawSpacedText(ctx, line, 0, i * size * 1.12, layer.letterSpacing)
      })
      let measured = 0
      for (const line of lines) {
        const chars = [...line]
        const widths = chars.map((char) => ctx.measureText(char).width)
        const widthOfLine = widths.reduce((sum, value) => sum + value, 0) + layer.letterSpacing * Math.max(0, chars.length - 1)
        measured = Math.max(measured, widthOfLine)
      }
      let left = 0
      if (layer.align === 'center') left = -measured / 2
      else if (layer.align === 'right') left = -measured
      layerBoxes[layer.id] = {
        x: ((layer.x / 100) * width + left) / width,
        y: ((layer.y / 100) * height - size * 0.84) / height,
        w: measured / width,
        h: (size * 0.84 + Math.max(0, lines.length - 1) * size * 1.12 + size * 0.16) / height,
      }
    }
    ctx.restore()
  }

  if (options.showSafeArea) {
    ctx.save()
    ctx.strokeStyle = 'rgba(255,255,255,0.32)'
    ctx.setLineDash([5, 6])
    ctx.lineWidth = 1
    ctx.strokeRect(width * 0.08, height * 0.08, width * 0.84, height * 0.84)
    ctx.restore()
  }
  ;(canvas as DarkroomCanvas).layerBoxes = layerBoxes
  return canvas
}

export interface ZineTextRect {
  x: number
  y: number
  w: number
  h: number
}

export interface LayoutCanvas extends HTMLCanvasElement {
  zineTextBoxes?: Partial<Record<ZineTextBlock, ZineTextRect>>
}

export interface LayoutConfig {
  format: 'cover' | 'spread' | 'ad' | 'poster' | 'lookbook' | 'casting' | 'zine-cover' | 'zine-page' | 'back'
  width: number
  height: number
  headline: string
  subhead: string
  body: string
  caption: string
  note: string
  brand: string
  issue: string
  price: string
  displayFont: string
  bodyFont: string
  ink: string
  paper: string
  accent: string
  align: 'left' | 'center' | 'right'
  scale: number
  tracking: number
  imageId?: string
  secondaryImageId?: string
  focusX?: number
  focusY?: number
  zineLayout?: ZinePageLayout
  textLayout?: ZineTextLayout
}

export const LAYOUT_SIZES: Record<LayoutConfig['format'], { width: number; height: number; label: string }> = {
  cover: { width: 1200, height: 1600, label: 'Magazine cover · 3:4' },
  spread: { width: 2000, height: 1400, label: 'Two-page spread · 10:7' },
  ad: { width: 1200, height: 1600, label: 'Full-page ad · 3:4' },
  poster: { width: 1400, height: 2000, label: 'Poster · 7:10' },
  lookbook: { width: 1400, height: 1800, label: 'Lookbook page · 7:9' },
  casting: { width: 1600, height: 1200, label: 'Casting sheet · 4:3' },
  'zine-cover': { width: 1240, height: 1754, label: 'Zine cover · A5' },
  'zine-page': { width: 1240, height: 1754, label: 'Zine page · A5' },
  back: { width: 1200, height: 1600, label: 'Back cover · 3:4' },
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = w
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

function drawParagraph(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines?: number,
) {
  const lines = wrapText(ctx, text, maxWidth)
  lines.slice(0, maxLines ?? lines.length).forEach((line, i) => ctx.fillText(line, x, y + i * lineHeight))
  return y + Math.min(lines.length, maxLines ?? lines.length) * lineHeight
}

export async function renderLayout(config: LayoutConfig, images: Record<string, HTMLImageElement | undefined>) {
  await document.fonts.ready
  const canvas = document.createElement('canvas')
  canvas.width = config.width
  canvas.height = config.height
  const ctx = canvas.getContext('2d')!
  const spacingCtx = ctx as unknown as { letterSpacing?: string }
  if ('letterSpacing' in spacingCtx) spacingCtx.letterSpacing = `${config.tracking ?? 0}px`
  const W = config.width
  const H = config.height
  const ink = config.ink
  const paper = config.paper
  const accent = config.accent
  const img = config.imageId ? images[config.imageId] : undefined
  const img2 = config.secondaryImageId ? images[config.secondaryImageId] : undefined
  const align = config.align
  const margin = W * 0.075
  const scale = config.scale

  const textX = align === 'center' ? W / 2 : align === 'right' ? W - margin : margin
  const setFont = (font: string, size: number, weight = 400, italic = false) => {
    ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${font}`
  }

  if (config.format === 'cover' || config.format === 'ad' || config.format === 'back') {
    ctx.fillStyle = paper
    ctx.fillRect(0, 0, W, H)
    if (img) {
      drawImageCover(ctx, img, 0, 0, W, H, config.focusX ?? 0.5, config.focusY ?? 0.35)
      const grad = ctx.createLinearGradient(0, 0, 0, H)
      grad.addColorStop(0, 'rgba(8,8,8,0.18)')
      grad.addColorStop(0.45, 'rgba(8,8,8,0.02)')
      grad.addColorStop(1, 'rgba(8,8,8,0.62)')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, W, H)
    }
    if (config.format === 'back') {
      ctx.fillStyle = ink
      ctx.textAlign = 'center'
      setFont(config.displayFont, W * 0.1, 600)
      ctx.fillText(config.brand, W / 2, H * 0.46)
      setFont(config.bodyFont, W * 0.018, 400)
      ctx.fillText(config.caption, W / 2, H * 0.54)
      setFont(config.bodyFont, W * 0.012, 400)
      ctx.fillText(config.note, W / 2, H * 0.9)
      return canvas
    }
    ctx.textAlign = 'left'
    ctx.fillStyle = '#f4efe4'
    setFont(config.bodyFont, W * 0.014, 500)
    ctx.fillText(config.brand.toUpperCase(), margin, margin)
    ctx.textAlign = 'right'
    ctx.fillText(config.issue.toUpperCase(), W - margin, margin)
    ctx.textAlign = 'left'
    setFont(config.displayFont, W * (0.18 * scale), 500)
    const words = config.headline.toUpperCase().split(' ')
    let y = H * 0.62
    words.forEach((word) => {
      ctx.fillText(word, margin, y)
      y += W * 0.16 * scale
    })
    ctx.fillStyle = accent
    ctx.fillRect(margin, H * 0.885, W * 0.16, Math.max(1, H * 0.003))
    ctx.fillStyle = '#f4efe4'
    setFont(config.bodyFont, W * 0.019, 400)
    drawParagraph(ctx, config.subhead || config.caption, margin, H * 0.925, W * 0.42, W * 0.026, 2)
    ctx.textAlign = 'right'
    setFont(config.bodyFont, W * 0.012, 400)
    ctx.fillText(config.price, W - margin, H * 0.925)
    ctx.fillText(config.note, W - margin, H * 0.945)
    return canvas
  }

  if (config.format === 'spread') {
    const half = W / 2
    ctx.fillStyle = paper
    ctx.fillRect(0, 0, W, H)
    if (img) {
      drawImageCover(ctx, img, 0, 0, half, H, config.focusX ?? 0.5, config.focusY ?? 0.4)
    }
    if (img2) {
      drawImageCover(ctx, img2, half * 0.72, H * 0.06, half * 0.24, H * 0.26, 0.5, 0.5)
    }
    ctx.fillStyle = ink
    ctx.textAlign = 'left'
    setFont(config.bodyFont, W * 0.0085, 500)
    ctx.fillText(config.brand.toUpperCase(), half + margin * 0.55, margin * 0.62)
    setFont(config.displayFont, W * 0.052 * scale, 500)
    let y = H * 0.2
    const lines = wrapText(ctx, config.headline, half - margin * 1.1)
    lines.forEach((line) => {
      ctx.fillText(line, half + margin * 0.55, y)
      y += W * 0.055 * scale
    })
    ctx.fillStyle = accent
    ctx.fillRect(half + margin * 0.55, y + H * 0.02, W * 0.08, Math.max(1, H * 0.0025))
    ctx.fillStyle = ink
    setFont(config.bodyFont, W * 0.0115, 400)
    const startY = y + H * 0.065
    const colW = (half - margin * 1.3) / 2
    drawParagraph(ctx, config.body, half + margin * 0.55, startY, colW, W * 0.018, 12)
    drawParagraph(ctx, config.caption, half + margin * 0.55 + colW + margin * 0.15, startY, colW, W * 0.018, 8)
    ctx.textAlign = 'left'
    setFont(config.bodyFont, W * 0.007, 400)
    ctx.fillText(config.note, half + margin * 0.55, H - margin * 0.5)
    return canvas
  }

  if (config.format === 'poster') {
    ctx.fillStyle = paper
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = ink
    ctx.textAlign = align
    setFont(config.displayFont, W * 0.17 * scale, 500)
    const words = config.headline.toUpperCase().split(' ')
    let y = H * 0.15
    words.forEach((word) => {
      ctx.fillText(word, textX, y)
      y += W * 0.15 * scale
    })
    ctx.fillStyle = accent
    ctx.fillRect(align === 'left' ? margin : align === 'right' ? W - margin - W * 0.14 : W / 2 - W * 0.07, y - H * 0.015, W * 0.14, Math.max(1, H * 0.0028))
    if (img) {
      const iw = W * 0.64
      const ih = H * 0.36
      const ix = align === 'left' ? margin : align === 'right' ? W - margin - iw : W / 2 - iw / 2
      drawImageCover(ctx, img, ix, y + H * 0.03, iw, ih, config.focusX ?? 0.5, config.focusY ?? 0.35)
    }
    ctx.fillStyle = ink
    ctx.textAlign = 'left'
    setFont(config.bodyFont, W * 0.014, 400)
    ctx.fillText(config.caption, margin, H * 0.91)
    ctx.textAlign = 'right'
    ctx.fillText(config.note, W - margin, H * 0.91)
    ctx.textAlign = 'left'
    setFont(config.bodyFont, W * 0.01, 500)
    ctx.fillText(config.brand.toUpperCase(), margin, H * 0.945)
    return canvas
  }

  if (config.format === 'lookbook') {
    ctx.fillStyle = paper
    ctx.fillRect(0, 0, W, H)
    if (img) drawImageCover(ctx, img, margin, margin * 1.7, W - margin * 2, H * 0.68, config.focusX ?? 0.5, config.focusY ?? 0.4)
    ctx.fillStyle = ink
    ctx.textAlign = 'left'
    setFont(config.bodyFont, W * 0.014, 500)
    ctx.fillText(config.brand.toUpperCase(), margin, margin)
    ctx.textAlign = 'right'
    ctx.fillText(config.issue.toUpperCase(), W - margin, margin)
    ctx.textAlign = 'left'
    setFont(config.displayFont, W * 0.052 * scale, 500)
    ctx.fillText(config.headline, margin, H * 0.84)
    setFont(config.bodyFont, W * 0.013, 400)
    ctx.fillText(config.subhead, margin, H * 0.885)
    ctx.textAlign = 'right'
    ctx.fillText(config.caption, W - margin, H * 0.885)
    ctx.textAlign = 'left'
    setFont(config.bodyFont, W * 0.009, 400)
    ctx.fillText(config.note, margin, H * 0.925)
    return canvas
  }

  if (config.format === 'casting') {
    ctx.fillStyle = paper
    ctx.fillRect(0, 0, W, H)
    const cols = 4
    const gap = W * 0.012
    const cw = (W - margin * 2 - gap * (cols - 1)) / cols
    const ch = H * 0.62
    for (let i = 0; i < cols; i++) {
      const source = i % 2 === 0 ? img : img2 ?? img
      const x = margin + i * (cw + gap)
      if (source) drawImageCover(ctx, source, x, H * 0.13, cw, ch, 0.4 + (i % 3) * 0.12, 0.3 + (i % 2) * 0.15)
      ctx.strokeStyle = ink
      ctx.globalAlpha = 0.3
      ctx.strokeRect(x + 0.5, H * 0.13 + 0.5, cw - 1, ch - 1)
      ctx.globalAlpha = 1
      ctx.fillStyle = ink
      ctx.textAlign = 'left'
      setFont(config.bodyFont, W * 0.008, 500)
      ctx.fillText(`0${i + 1} / ${config.issue.toUpperCase()}`, x, H * 0.11)
      setFont(config.bodyFont, W * 0.007, 400)
      ctx.fillText(config.caption, x, H * 0.79)
      ctx.fillText(config.note, x, H * 0.805)
    }
    ctx.fillStyle = ink
    setFont(config.displayFont, W * 0.055 * scale, 500)
    ctx.fillText(config.headline, margin, H * 0.9)
    ctx.textAlign = 'right'
    setFont(config.bodyFont, W * 0.0085, 500)
    ctx.fillText(config.brand.toUpperCase(), W - margin, H * 0.9)
    return canvas
  }

  // zine cover / page
  const zineLayout = config.zineLayout ?? 'standard'
  const tt = (block: ZineTextBlock) => textTransform(zineLayout, config.textLayout, block)
  const boxes: Partial<Record<ZineTextBlock, ZineTextRect>> = {}

  const finish = () => {
    ;(canvas as LayoutCanvas).zineTextBoxes = boxes
    return canvas
  }

  const recordBox = (
    block: ZineTextBlock,
    lines: string[],
    x: number,
    baseline: number,
    fontPx: number,
    lineHeight: number,
    align: CanvasTextAlign,
  ) => {
    let width = 0
    for (const line of lines) width = Math.max(width, ctx.measureText(line).width)
    let left = x
    if (align === 'right') left -= width
    else if (align === 'center') left -= width / 2
    const height = fontPx * 0.84 + Math.max(0, lines.length - 1) * lineHeight + fontPx * 0.16
    boxes[block] = { x: left / W, y: (baseline - fontPx * 0.84) / H, w: width / W, h: height / H }
  }

  type BlockFallback = { color: string; font: string; weight: number; italic?: boolean; align: CanvasTextAlign }

  const blockStyle = (block: ZineTextBlock, fallback: BlockFallback) => {
    const t = tt(block)
    return {
      color: t.color ?? fallback.color,
      font: t.font ?? fallback.font,
      weight: t.weight ?? fallback.weight,
      italic: t.italic ?? fallback.italic ?? false,
      align: (t.align ?? fallback.align) as CanvasTextAlign,
      scale: t.scale,
    }
  }

  if (config.format === 'zine-page' && zineLayout !== 'standard') {
    if (zineLayout === 'full') {
      ctx.fillStyle = paper
      ctx.fillRect(0, 0, W, H)
      if (img) {
        drawImageCover(ctx, img, 0, 0, W, H, config.focusX ?? 0.5, config.focusY ?? 0.42)
        const grad = ctx.createLinearGradient(0, 0, 0, H)
        grad.addColorStop(0, 'rgba(8,8,8,0.38)')
        grad.addColorStop(0.45, 'rgba(8,8,8,0.05)')
        grad.addColorStop(1, 'rgba(8,8,8,0.78)')
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, W, H)
      }
      ctx.fillStyle = '#f4efe4'
      ctx.textAlign = 'left'
      setFont(config.bodyFont, W * 0.011, 500)
      ctx.fillText(config.brand.toUpperCase(), margin, margin * 0.82)
      ctx.textAlign = 'right'
      ctx.fillText(config.issue.toUpperCase(), W - margin, margin * 0.82)
      const ht = tt('headline')
      const hs = blockStyle('headline', { color: '#f4efe4', font: config.displayFont, weight: 500, align: 'left' })
      ctx.fillStyle = hs.color
      ctx.textAlign = hs.align
      const hSize = W * 0.122 * scale * hs.scale
      const hStep = W * 0.115 * scale * hs.scale
      setFont(hs.font, hSize, hs.weight, hs.italic)
      const lines = wrapText(ctx, config.headline.toUpperCase(), W * 0.78)
      lines.forEach((line, i) => {
        ctx.fillText(line, ht.x * W, ht.y * H + i * hStep)
      })
      recordBox('headline', lines, ht.x * W, ht.y * H, hSize, hStep, hs.align)
      ctx.fillStyle = accent
      ctx.fillRect(ht.x * W, ht.y * H + lines.length * hStep + H * 0.012, W * 0.14, Math.max(1, H * 0.003))
      const st = tt('subhead')
      const ss = blockStyle('subhead', { color: '#f4efe4', font: config.bodyFont, weight: 400, align: 'left' })
      ctx.fillStyle = ss.color
      ctx.textAlign = ss.align
      const sSize = W * 0.016 * ss.scale
      const sStep = W * 0.023 * ss.scale
      setFont(ss.font, sSize, ss.weight, ss.italic)
      const sLines = wrapText(ctx, config.subhead, W * 0.58).slice(0, 2)
      drawParagraph(ctx, config.subhead, st.x * W, st.y * H, W * 0.58, sStep, 2)
      recordBox('subhead', sLines, st.x * W, st.y * H, sSize, sStep, ss.align)
      const ct = tt('caption')
      const cs = blockStyle('caption', { color: '#f4efe4', font: config.bodyFont, weight: 500, align: 'left' })
      ctx.fillStyle = cs.color
      ctx.textAlign = cs.align
      const cSize = W * 0.0085 * cs.scale
      setFont(cs.font, cSize, cs.weight, cs.italic)
      ctx.fillText(config.caption, ct.x * W, ct.y * H)
      recordBox('caption', [config.caption], ct.x * W, ct.y * H, cSize, cSize * 1.1, cs.align)
      const nt = tt('note')
      const ns = blockStyle('note', { color: '#f4efe4', font: config.bodyFont, weight: 500, align: 'right' })
      ctx.fillStyle = ns.color
      ctx.textAlign = ns.align
      const nSize = W * 0.0085 * ns.scale
      setFont(ns.font, nSize, ns.weight, ns.italic)
      ctx.fillText(config.note, nt.x * W, nt.y * H)
      recordBox('note', [config.note], nt.x * W, nt.y * H, nSize, nSize * 1.1, ns.align)
      return finish()
    }

    if (zineLayout === 'split') {
      const split = W * 0.52
      ctx.fillStyle = paper
      ctx.fillRect(0, 0, W, H)
      if (img) drawImageCover(ctx, img, 0, 0, split, H, config.focusX ?? 0.5, config.focusY ?? 0.4)
      if (img2) {
        ctx.save()
        ctx.translate(split * 0.82, H * 0.16)
        ctx.rotate(0.05)
        drawImageCover(ctx, img2, -W * 0.1, -H * 0.1, W * 0.2, H * 0.16, 0.5, 0.4)
        ctx.strokeStyle = 'rgba(0,0,0,0.2)'
        ctx.strokeRect(-W * 0.1, -H * 0.1, W * 0.2, H * 0.16)
        ctx.restore()
      }
      const textLeft = split + W * 0.045
      ctx.fillStyle = ink
      ctx.textAlign = 'left'
      setFont(config.bodyFont, W * 0.0085, 500)
      ctx.fillText(config.brand.toUpperCase(), textLeft, margin * 0.72)
      ctx.textAlign = 'right'
      ctx.fillText(config.issue.toUpperCase(), W - margin, margin * 0.72)
      const ht = tt('headline')
      const hs = blockStyle('headline', { color: ink, font: config.displayFont, weight: 500, align: 'left' })
      ctx.fillStyle = hs.color
      ctx.textAlign = hs.align
      const hSize = W * 0.076 * scale * hs.scale
      const hStep = W * 0.08 * scale * hs.scale
      setFont(hs.font, hSize, hs.weight, hs.italic)
      const lines = wrapText(ctx, config.headline.toUpperCase(), W * 0.36)
      lines.forEach((line, i) => {
        ctx.fillText(line, ht.x * W, ht.y * H + i * hStep)
      })
      recordBox('headline', lines, ht.x * W, ht.y * H, hSize, hStep, hs.align)
      ctx.fillStyle = accent
      ctx.fillRect(ht.x * W, ht.y * H + lines.length * hStep + H * 0.012, W * 0.055, Math.max(1, H * 0.0028))
      const st = tt('subhead')
      const ss = blockStyle('subhead', { color: ink, font: config.displayFont, weight: 400, italic: true, align: 'left' })
      ctx.fillStyle = ss.color
      ctx.textAlign = ss.align
      const sSize = W * 0.028 * ss.scale
      const sStep = W * 0.035 * ss.scale
      setFont(ss.font, sSize, ss.weight, ss.italic)
      const sLines = wrapText(ctx, config.subhead, W * 0.37).slice(0, 3)
      drawParagraph(ctx, config.subhead, st.x * W, st.y * H, W * 0.37, sStep, 3)
      recordBox('subhead', sLines, st.x * W, st.y * H, sSize, sStep, ss.align)
      const bt = tt('body')
      const bs = blockStyle('body', { color: ink, font: config.bodyFont, weight: 400, align: 'left' })
      ctx.fillStyle = bs.color
      ctx.textAlign = bs.align
      const bSize = W * 0.0105 * bs.scale
      const bStep = W * 0.019 * bs.scale
      setFont(bs.font, bSize, bs.weight, bs.italic)
      const bLines = wrapText(ctx, config.body, W * 0.36).slice(0, 8)
      drawParagraph(ctx, config.body, bt.x * W, bt.y * H, W * 0.36, bStep, 8)
      recordBox('body', bLines, bt.x * W, bt.y * H, bSize, bStep, bs.align)
      const ct = tt('caption')
      const cs = blockStyle('caption', { color: ink, font: config.bodyFont, weight: 500, align: 'left' })
      ctx.fillStyle = cs.color
      ctx.textAlign = cs.align
      const cSize = W * 0.008 * cs.scale
      setFont(cs.font, cSize, cs.weight, cs.italic)
      ctx.fillText(config.caption, ct.x * W, ct.y * H)
      recordBox('caption', [config.caption], ct.x * W, ct.y * H, cSize, cSize * 1.1, cs.align)
      const nt = tt('note')
      const ns = blockStyle('note', { color: ink, font: config.bodyFont, weight: 400, align: 'left' })
      ctx.fillStyle = ns.color
      ctx.textAlign = ns.align
      const nSize = W * 0.0075 * ns.scale
      setFont(ns.font, nSize, ns.weight, ns.italic)
      ctx.fillText(config.note, nt.x * W, nt.y * H)
      recordBox('note', [config.note], nt.x * W, nt.y * H, nSize, nSize * 1.1, ns.align)
      return finish()
    }

    // quiet
    ctx.fillStyle = paper
    ctx.fillRect(0, 0, W, H)
    if (img) drawImageCover(ctx, img, W * 0.18, H * 0.39, W * 0.64, H * 0.3, config.focusX ?? 0.5, config.focusY ?? 0.42)
    if (img2) {
      ctx.save()
      ctx.translate(W * 0.84, H * 0.3)
      ctx.rotate(0.08)
      drawImageCover(ctx, img2, -W * 0.08, -H * 0.06, W * 0.16, H * 0.12, 0.5, 0.45)
      ctx.restore()
    }
    ctx.fillStyle = ink
    ctx.textAlign = 'left'
    setFont(config.bodyFont, W * 0.0085, 500)
    ctx.fillText(config.brand.toUpperCase(), margin, margin * 0.7)
    ctx.textAlign = 'right'
    ctx.fillText(config.issue.toUpperCase(), W - margin, margin * 0.7)
    const ht = tt('headline')
    const hs = blockStyle('headline', { color: ink, font: config.displayFont, weight: 500, align: 'left' })
    ctx.fillStyle = hs.color
    ctx.textAlign = hs.align
    const hSize = W * 0.1 * scale * hs.scale
    const hStep = W * 0.1 * scale * hs.scale
    setFont(hs.font, hSize, hs.weight, hs.italic)
    const lines = wrapText(ctx, config.headline.toUpperCase(), W * 0.8)
    lines.forEach((line, i) => {
      ctx.fillText(line, ht.x * W, ht.y * H + i * hStep)
    })
    recordBox('headline', lines, ht.x * W, ht.y * H, hSize, hStep, hs.align)
    ctx.fillStyle = accent
    ctx.fillRect(ht.x * W, ht.y * H + lines.length * hStep + H * 0.02, W * 0.14, Math.max(1, H * 0.003))
    const st = tt('subhead')
    const ss = blockStyle('subhead', { color: ink, font: config.displayFont, weight: 400, italic: true, align: 'left' })
    ctx.fillStyle = ss.color
    ctx.textAlign = ss.align
    const sSize = W * 0.026 * ss.scale
    const sStep = W * 0.032 * ss.scale
    setFont(ss.font, sSize, ss.weight, ss.italic)
    const sLines = wrapText(ctx, config.subhead, W * 0.74).slice(0, 3)
    drawParagraph(ctx, config.subhead, st.x * W, st.y * H, W * 0.74, sStep, 3)
    recordBox('subhead', sLines, st.x * W, st.y * H, sSize, sStep, ss.align)
    const bt = tt('body')
    const bs = blockStyle('body', { color: ink, font: config.bodyFont, weight: 400, align: 'left' })
    ctx.fillStyle = bs.color
    ctx.textAlign = bs.align
    const bSize = W * 0.0095 * bs.scale
    const bStep = W * 0.017 * bs.scale
    setFont(bs.font, bSize, bs.weight, bs.italic)
    const bLines = wrapText(ctx, config.body, W * 0.62).slice(0, 5)
    drawParagraph(ctx, config.body, bt.x * W, bt.y * H, W * 0.62, bStep, 5)
    recordBox('body', bLines, bt.x * W, bt.y * H, bSize, bStep, bs.align)
    const ct = tt('caption')
    const cs = blockStyle('caption', { color: ink, font: config.bodyFont, weight: 500, align: 'left' })
    ctx.fillStyle = cs.color
    ctx.textAlign = cs.align
    const cSize = W * 0.0085 * cs.scale
    setFont(cs.font, cSize, cs.weight, cs.italic)
    ctx.fillText(config.caption, ct.x * W, ct.y * H)
    recordBox('caption', [config.caption], ct.x * W, ct.y * H, cSize, cSize * 1.1, cs.align)
    const nt = tt('note')
    const ns = blockStyle('note', { color: ink, font: config.bodyFont, weight: 500, align: 'right' })
    ctx.fillStyle = ns.color
    ctx.textAlign = ns.align
    const nSize = W * 0.0085 * ns.scale
    setFont(ns.font, nSize, ns.weight, ns.italic)
    ctx.fillText(config.note, nt.x * W, nt.y * H)
    recordBox('note', [config.note], nt.x * W, nt.y * H, nSize, nSize * 1.1, ns.align)
    return finish()
  }

  ctx.fillStyle = paper
  ctx.fillRect(0, 0, W, H)
  if (img) {
    const rot = config.format === 'zine-cover' ? -0.03 : 0.025
    ctx.save()
    ctx.translate(W * 0.52, H * 0.46)
    ctx.rotate(rot)
    drawImageCover(ctx, img, -W * 0.36, -H * 0.32, W * 0.72, H * 0.58, config.focusX ?? 0.5, config.focusY ?? 0.35)
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'
    ctx.strokeRect(-W * 0.36, -H * 0.32, W * 0.72, H * 0.58)
    ctx.restore()
  }
  if (img2) {
    ctx.save()
    ctx.translate(W * 0.79, H * 0.18)
    ctx.rotate(0.09)
    drawImageCover(ctx, img2, -W * 0.11, -H * 0.09, W * 0.22, H * 0.16, 0.5, 0.4)
    ctx.restore()
  }
  const ht = tt('headline')
  const hs = blockStyle('headline', { color: ink, font: config.displayFont, weight: 500, align })
  ctx.fillStyle = hs.color
  ctx.textAlign = hs.align
  const hSize = W * 0.16 * scale * hs.scale
  const hStep = W * 0.15 * scale * hs.scale
  setFont(hs.font, hSize, hs.weight, hs.italic)
  const headlineLines = wrapText(ctx, config.headline.toUpperCase(), W * 0.84)
  headlineLines.forEach((line, i) => ctx.fillText(line, ht.x * W, ht.y * H + i * hStep))
  recordBox('headline', headlineLines, ht.x * W, ht.y * H, hSize, hStep, hs.align)
  ctx.fillStyle = ink
  ctx.textAlign = 'left'
  setFont(config.bodyFont, W * 0.009, 400)
  ctx.fillText(config.brand.toUpperCase(), margin, H * 0.035)
  ctx.textAlign = 'right'
  ctx.fillText(config.issue.toUpperCase(), W - margin, H * 0.035)
  const bt = tt('body')
  const bs = blockStyle('body', { color: ink, font: config.bodyFont, weight: 400, align: 'left' })
  ctx.fillStyle = bs.color
  ctx.textAlign = bs.align
  const bSize = W * 0.011 * bs.scale
  const bStep = W * 0.018 * bs.scale
  setFont(bs.font, bSize, bs.weight, bs.italic)
  const bodyLines = wrapText(ctx, config.body, W * 0.5).slice(0, 5)
  drawParagraph(ctx, config.body, bt.x * W, bt.y * H, W * 0.5, bStep, 5)
  recordBox('body', bodyLines, bt.x * W, bt.y * H, bSize, bStep, bs.align)
  ctx.fillStyle = accent
  ctx.fillRect(margin, H * 0.91, W * 0.18, Math.max(1, H * 0.003))
  const ct = tt('caption')
  const cs = blockStyle('caption', { color: ink, font: config.bodyFont, weight: 500, align: 'left' })
  ctx.fillStyle = cs.color
  ctx.textAlign = cs.align
  const cSize = W * 0.009 * cs.scale
  setFont(cs.font, cSize, cs.weight, cs.italic)
  ctx.fillText(config.caption, ct.x * W, ct.y * H)
  recordBox('caption', [config.caption], ct.x * W, ct.y * H, cSize, cSize * 1.1, cs.align)
  const nt = tt('note')
  const ns = blockStyle('note', { color: ink, font: config.bodyFont, weight: 500, align: 'right' })
  ctx.fillStyle = ns.color
  ctx.textAlign = ns.align
  const nSize = W * 0.009 * ns.scale
  setFont(ns.font, nSize, ns.weight, ns.italic)
  ctx.fillText(config.note, nt.x * W, nt.y * H)
  recordBox('note', [config.note], nt.x * W, nt.y * H, nSize, nSize * 1.1, ns.align)
  const st = tt('subhead')
  const ss = blockStyle('subhead', { color: ink, font: config.displayFont, weight: 400, italic: true, align: 'left' })
  ctx.fillStyle = ss.color
  ctx.textAlign = ss.align
  const sSize = W * 0.045 * ss.scale
  setFont(ss.font, sSize, ss.weight, ss.italic)
  ctx.fillText(config.subhead, st.x * W, st.y * H)
  recordBox('subhead', [config.subhead], st.x * W, st.y * H, sSize, sSize * 1.1, ss.align)
  return finish()
}

export async function loadImageMap(ids: (string | undefined)[], assets: { id: string; src: string }[]): Promise<Record<string, HTMLImageElement | undefined>> {
  const map: Record<string, HTMLImageElement | undefined> = {}
  await Promise.all(
    ids.filter(Boolean).map(async (id) => {
      const asset = assets.find((a) => a.id === id)
      if (!asset) return
      try {
        map[id!] = await loadImage(asset.src)
      } catch {
        map[id!] = undefined
      }
    }),
  )
  return map
}
