import type { Asset } from './types'

export interface OpenArchiveResult {
  id: string
  title: string
  thumb: string
  original: string
  pageUrl: string
  width: number
  height: number
  license: string
  creator: string
  provider: string
  query: string
}

export interface OpenArchivePage {
  results: OpenArchiveResult[]
  nextOffset: number | null
}

export interface ManifestEntry {
  url: string
  title?: string
  collection?: string
  tags?: string[]
  note?: string
  caption?: string
  source?: string
  license?: string
  creator?: string
}

interface CommonsMetadataValue {
  value?: string
}

interface CommonsImageInfo {
  thumburl?: string
  url?: string
  descriptionurl?: string
  width?: number
  height?: number
  thumbwidth?: number
  thumbheight?: number
  mime?: string
  extmetadata?: Record<string, CommonsMetadataValue>
}

interface CommonsPage {
  pageid: number
  title: string
  index?: number
  imageinfo?: CommonsImageInfo[]
}

interface CommonsResponse {
  query?: { pages?: Record<string, CommonsPage> }
  continue?: { gsroffset?: number }
}

export const OPEN_ARCHIVE_QUERIES = [
  'editorial fashion portrait film',
  'disposable camera flash photography',
  '2000s fashion editorial',
  'nightclub flash photography',
  'polaroid still life',
  'perfume bottle still life',
  'bedroom available light photograph',
  'grunge fashion portrait',
  'analog film grain portrait',
  'vintage magazine editorial',
  'flowers on silk still life',
  'fashion backstage photograph',
]

function cleanText(value?: string): string {
  if (!value) return ''
  const stripped = value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  if (typeof DOMParser === 'undefined') return stripped
  try {
    return (new DOMParser().parseFromString(stripped, 'text/html').body.textContent ?? '')
      .replace(/\s+/g, ' ')
      .trim()
  } catch {
    return stripped
  }
}

function commonsTitle(title: string): string {
  return title
    .replace(/^File:/i, '')
    .replace(/\.[a-z0-9]{2,6}$/i, '')
    .replace(/_/g, ' ')
    .trim()
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback
}

export async function searchOpenArchive(query: string, offset = 0, limit = 24): Promise<OpenArchivePage> {
  const q = query.trim()
  if (!q) return { results: [], nextOffset: null }
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: q,
    gsrnamespace: '6',
    gsrlimit: String(Math.max(1, Math.min(50, limit))),
    gsroffset: String(Math.max(0, offset)),
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|mime|size',
    iiurlwidth: '720',
    format: 'json',
    origin: '*',
  })
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params.toString()}`)
  if (!res.ok) throw new Error(`Open Archive returned ${res.status}`)
  const data = (await res.json()) as CommonsResponse
  const pages = data.query?.pages ?? {}
  const results = Object.values(pages)
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .flatMap((page) => {
      const info = page.imageinfo?.[0]
      if (!info || !info.mime?.startsWith('image/') || info.mime === 'image/svg+xml') return []
      const metadata = info.extmetadata ?? {}
      const license =
        cleanText(metadata.LicenseShortName?.value) ||
        cleanText(metadata.UsageTerms?.value) ||
        'See source for license'
      const creator =
        cleanText(metadata.Artist?.value) ||
        cleanText(metadata.Credit?.value) ||
        'Unknown maker'
      return [{
        id: `commons-${page.pageid}`,
        title: commonsTitle(page.title).slice(0, 120),
        thumb: info.thumburl ?? info.url ?? '',
        original: info.url ?? info.thumburl ?? '',
        pageUrl: info.descriptionurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
        width: asNumber(info.width, asNumber(info.thumbwidth)),
        height: asNumber(info.height, asNumber(info.thumbheight)),
        license,
        creator,
        provider: 'Wikimedia Commons',
        query: q,
      }]
    })
    .filter((r) => !!r.thumb)
  return {
    results,
    nextOffset: typeof data.continue?.gsroffset === 'number' ? data.continue.gsroffset : null,
  }
}

export function normalizeManifestUrl(value: string): string {
  return value.trim().replace(/^[<("']+|[>)"',;.]+$/g, '')
}

function normalizeUrl(value: string): string {
  return normalizeManifestUrl(value)
}

export function isHttpUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(normalizeUrl(value))
}

export function titleFromUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const last = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() ?? '')
      .replace(/\.[a-z0-9]{2,6}$/i, '')
      .replace(/[-_]+/g, ' ')
      .trim()
    if (last) return last.slice(0, 120)
    return parsed.hostname.replace(/^www\./, '') || 'Imported plate'
  } catch {
    return 'Imported plate'
  }
}

function firstString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
}

function tagsFrom(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const tags = value.filter((v): v is string => typeof v === 'string' && !!v.trim()).map((v) => v.trim())
    return tags.length ? tags : undefined
  }
  if (typeof value === 'string' && value.trim()) {
    return value.split(/[,;|]/).map((v) => v.trim()).filter(Boolean)
  }
  return undefined
}

function entryFromRecord(record: Record<string, unknown>): ManifestEntry | null {
  const rawUrl = firstString(record, [
    'url',
    'src',
    'image',
    'imageUrl',
    'image_url',
    'media_url',
    'mediaUrl',
    'thumbnail',
    'download_url',
    'downloadUrl',
    'uri',
  ])
  if (!rawUrl) return null
  const url = normalizeUrl(rawUrl)
  if (!isHttpUrl(url)) return null
  return {
    url,
    title: firstString(record, ['title', 'name', 'caption', 'slug']),
    collection: firstString(record, ['collection', 'album', 'folder', 'set']),
    tags: tagsFrom(record.tags ?? record.keywords),
    note: firstString(record, ['note', 'description', 'alt', 'alt_text']),
    caption: firstString(record, ['caption', 'headline']),
    source: firstString(record, ['source', 'platform', 'provider']),
    license: firstString(record, ['license', 'rights']),
    creator: firstString(record, ['creator', 'author', 'artist', 'username']),
  }
}

function parseDelimitedLine(line: string, delimiter: string): string[] {
  const cells: string[] = []
  let value = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"'
        i++
      } else {
        quoted = !quoted
      }
    } else if (char === delimiter && !quoted) {
      cells.push(value.trim())
      value = ''
    } else {
      value += char
    }
  }
  cells.push(value.trim())
  return cells
}

function parseDelimited(text: string): ManifestEntry[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (!lines.length) return []
  const delimiter = lines[0].includes('\t') ? '\t' : ','
  const first = parseDelimitedLine(lines.slice(0, 1)[0], delimiter).map((v) => v.toLowerCase().replace(/[^a-z0-9]/g, ''))
  const hasHeader = first.some((v) => ['url', 'src', 'image', 'imageurl', 'mediaurl', 'downloadurl'].includes(v))
  const headers = hasHeader ? first : []
  const body = hasHeader ? lines.slice(1) : lines
  return body.flatMap((line) => {
    const cells = parseDelimitedLine(line, delimiter)
    if (!hasHeader) {
      const matched = line.match(/https?:\/\/[^\s"',]+/i)
      if (!matched) return []
      const url = normalizeUrl(matched[0])
      return isHttpUrl(url) ? [{ url }] : []
    }
    const record: Record<string, unknown> = {}
    headers.forEach((header, i) => {
      if (header && cells[i]) record[header] = cells[i]
    })
    const entry = entryFromRecord(record)
    return entry ? [entry] : []
  })
}

function collectJsonEntries(value: unknown): ManifestEntry[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item === 'string') {
        const url = normalizeUrl(item)
        return isHttpUrl(url) ? [{ url }] : []
      }
      if (item && typeof item === 'object') {
        const entry = entryFromRecord(item as Record<string, unknown>)
        return entry ? [entry] : []
      }
      return []
    })
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    const nested = record.items ?? record.assets ?? record.photos ?? record.images ?? record.data
    if (Array.isArray(nested) || (nested && typeof nested === 'object')) return collectJsonEntries(nested)
    const entry = entryFromRecord(record)
    return entry ? [entry] : []
  }
  return []
}

/**
 * Accepts a JSON array / object, CSV / TSV with a url column, or a plain line list.
 * It never fetches the links. The caller decides whether to index or download them.
 */
export function parseManifest(text: string): { entries: ManifestEntry[]; format: 'json' | 'csv' | 'text' } {
  const trimmed = text.trim()
  if (!trimmed) return { entries: [], format: 'text' }
  let entries: ManifestEntry[] = []
  let format: 'json' | 'csv' | 'text' = 'text'
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    format = 'json'
    try {
      entries = collectJsonEntries(JSON.parse(trimmed))
    } catch {
      entries = []
    }
  } else if (trimmed.includes(',') || trimmed.includes('\t')) {
    format = 'csv'
    entries = parseDelimited(trimmed)
  } else {
    entries = trimmed
      .split(/\r?\n/)
      .flatMap((line) => {
        const matched = line.match(/https?:\/\/[^\s"']+/i)
        if (!matched) return []
        const url = normalizeUrl(matched[0])
        return isHttpUrl(url) ? [{ url }] : []
      })
  }
  const seen = new Set<string>()
  const unique = entries.filter((entry) => {
    if (seen.has(entry.url)) return false
    seen.add(entry.url)
    return true
  })
  return { entries: unique, format }
}

export function assetFromManifest(entry: ManifestEntry, id: string, analysis?: Asset['analysis'], dimensions?: { width?: number; height?: number }): Asset {
  const refined = entry.tags?.filter(Boolean) ?? []
  return {
    id,
    src: entry.url,
    title: entry.title || titleFromUrl(entry.url),
    kind: 'upload',
    source: 'imported',
    createdAt: Date.now(),
    width: dimensions?.width,
    height: dimensions?.height,
    collection: entry.collection || 'Imported links',
    tags: ['imported', ...(entry.source ? [entry.source] : []), ...refined].slice(0, 10),
    palette: analysis?.palette,
    caption: entry.caption || (analysis ? 'IMPORTED / READ' : 'IMPORTED LINK / NOT YET READ'),
    note: entry.note || 'Added from a link sheet or export. Check rights before publishing.',
    analysis,
    meta: {
      ...(entry.source ? { sourceLabel: entry.source } : {}),
      ...(entry.license ? { license: entry.license } : {}),
      ...(entry.creator ? { creator: entry.creator } : {}),
      importedAt: Date.now(),
    },
  }
}
