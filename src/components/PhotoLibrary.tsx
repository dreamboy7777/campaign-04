import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  AlertTriangle, Check, ExternalLink, FileJson, FolderOpen, Globe2, ImagePlus,
  Link2, Loader2, Search, StopCircle, Upload,
} from 'lucide-react'
import { Modal } from './UI'
import { useApp, uid } from '../lib/store'
import { analyzeImage } from '../lib/analyze'
import { saveAssetBlob, saveRemoteAsset, saveRemoteAssets } from '../lib/imageStore'
import {
  assetFromManifest, isHttpUrl, normalizeManifestUrl, OPEN_ARCHIVE_QUERIES,
  parseManifest, searchOpenArchive, titleFromUrl,
  type ManifestEntry, type OpenArchiveResult,
} from '../lib/openArchive'
import type { Asset } from '../lib/types'

type Tab = 'open' | 'files' | 'links' | 'manifest'

const INITIAL_QUERY = 'editorial fashion portrait film'
const MAX_LINKS = 25000
const IMAGE_FILE = /\.(jpe?g|png|webp|gif|avif)$/i

interface Progress {
  done: number
  total: number
  label: string
}

function yieldToUI(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

async function fetchImageBlob(url: string): Promise<Blob> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 20000)
  try {
    const res = await fetch(url, { mode: 'cors', referrerPolicy: 'no-referrer', signal: controller.signal })
    if (!res.ok) throw new Error(`Image returned ${res.status}`)
    const blob = await res.blob()
    if (!blob.type.startsWith('image/') && blob.size < 32) throw new Error('Not an image')
    return blob
  } finally {
    window.clearTimeout(timeout)
  }
}

async function readBlob(blob: Blob): Promise<{ analysis?: Asset['analysis']; width?: number; height?: number }> {
  const url = URL.createObjectURL(blob)
  try {
    const result = await analyzeImage(url)
    return { analysis: result.analysis, width: result.width, height: result.height }
  } catch {
    return {}
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function dimensionsOf(blob: Blob): Promise<{ width?: number; height?: number }> {
  try {
    const bitmap = await createImageBitmap(blob)
    const dims = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return dims
  } catch {
    return {}
  }
}

function fileTitle(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Untitled import'
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function urlEntries(text: string): ManifestEntry[] {
  const seen = new Set<string>()
  return text
    .split(/\r?\n/)
    .flatMap((line) => {
      const match = line.match(/https?:\/\/[^\s"']+/i)
      if (!match) return []
      const url = normalizeManifestUrl(match[0])
      if (!isHttpUrl(url) || seen.has(url)) return []
      seen.add(url)
      return [{ url }]
    })
}

export function PhotoLibrary({ open, onClose, initialTab = 'open' }: { open: boolean; onClose: () => void; initialTab?: Tab }) {
  const assets = useApp((s) => s.assets)
  const addAssets = useApp((s) => s.addAssets)
  const toast = useApp((s) => s.toast)

  const [tab, setTab] = useState<Tab>(initialTab)
  const [query, setQuery] = useState(INITIAL_QUERY)
  const [results, setResults] = useState<OpenArchiveResult[]>([])
  const [resultOffset, setResultOffset] = useState(0)
  const [nextOffset, setNextOffset] = useState<number | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [readArchive, setReadArchive] = useState(true)
  const [readFiles, setReadFiles] = useState(true)
  const [readLinks, setReadLinks] = useState(false)
  const [linksText, setLinksText] = useState('')
  const [manifestText, setManifestText] = useState('')
  const [manifestName, setManifestName] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<Progress>({ done: 0, total: 0, label: '' })
  const [status, setStatus] = useState('')
  const cancelled = useRef(false)
  const initialSearch = useRef(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const folderInput = useRef<HTMLInputElement>(null)
  const manifestInput = useRef<HTMLInputElement>(null)

  const linkCount = useMemo(() => (linksText.trim() ? urlEntries(linksText).length : 0), [linksText])
  const manifestCount = useMemo(
    () => (manifestText.trim() ? parseManifest(manifestText).entries.length : 0),
    [manifestText],
  )

  const setProgressNow = (done: number, total: number, label: string) => {
    setProgress({ done, total, label })
  }

  const runSearch = async (value = query, offset = 0, append = false) => {
    const q = value.trim()
    if (!q) {
      setSearchError('Type a subject, era, light or material.')
      return
    }
    setSearching(true)
    setSearchError('')
    if (!append) setSelected(new Set())
    try {
      const page = await searchOpenArchive(q, offset, 30)
      setResults((current) => (append ? [...current, ...page.results] : page.results))
      setResultOffset(offset)
      setNextOffset(page.nextOffset)
      setStatus(page.results.length ? `${page.results.length} plates returned from the open archive.` : 'No plates matched that search.')
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Could not reach the open archive.')
      if (!append) setResults([])
    } finally {
      setSearching(false)
    }
  }

  useEffect(() => {
    if (!open) return
    setTab(initialTab)
  }, [open, initialTab])

  useEffect(() => {
    if (!open || initialSearch.current) return
    initialSearch.current = true
    void runSearch(INITIAL_QUERY)
    // The first search is intentionally once per session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const toggleSelected = (id: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const importArchiveSelection = async () => {
    const chosen = results.filter((result) => selected.has(result.id))
    if (!chosen.length) {
      toast('Nothing selected', 'Tick a few plates from the open archive first.', 'error')
      return
    }
    cancelled.current = false
    setBusy(true)
    setProgressNow(0, chosen.length, 'FETCHING OPEN ARCHIVE')
    const imported: Asset[] = []
    let errors = 0
    for (let i = 0; i < chosen.length; i++) {
      if (cancelled.current) break
      const result = chosen[i]
      let blob: Blob | null = null
      try {
        blob = await fetchImageBlob(result.thumb)
      } catch {
        errors++
      }
      const read = blob && readArchive ? await readBlob(blob) : {}
      const tags = unique([
        'open archive',
        result.license.length < 26 ? result.license : 'cc',
        ...result.query.split(/\s+/).slice(0, 3),
      ])
      const meta: Omit<Asset, 'src'> = {
        id: uid('open'),
        title: result.title || 'Open archive plate',
        kind: 'photograph',
        source: 'open',
        createdAt: Date.now(),
        width: read.width ?? result.width,
        height: read.height ?? result.height,
        collection: 'Open Archive',
        tags,
        palette: read.analysis?.palette,
        caption: `${result.creator} / ${result.license}`,
        note: `Wikimedia Commons. ${result.creator}. ${result.license}. Verify attribution before publication.`,
        analysis: read.analysis,
        meta: {
          provider: result.provider,
          creator: result.creator,
          license: result.license,
          originUrl: result.pageUrl,
          imageUrl: result.original,
          query: result.query,
        },
      }
      try {
        const asset = blob
          ? await saveAssetBlob(blob, meta)
          : await saveRemoteAsset({ ...meta, src: result.thumb })
        imported.push(asset)
      } catch {
        errors++
      }
      setProgressNow(i + 1, chosen.length, 'FETCHING OPEN ARCHIVE')
      if (i % 3 === 0) await yieldToUI()
    }
    if (imported.length) addAssets(imported)
    setBusy(false)
    if (cancelled.current) {
      setStatus(`Stopped after ${imported.length} plates.`)
      toast('Import stopped', `${imported.length} open archive plates were kept.`, 'default')
    } else {
      setStatus(`${imported.length} open archive plates added${errors ? ` / ${errors} could not be fetched and were kept as links` : ''}.`)
      toast('Open archive added', `${imported.length} plates stored in this browser.`, 'success')
    }
    setSelected(new Set())
  }

  const importFiles = async (files: File[]) => {
    const list = files.filter((file) => file.type.startsWith('image/') || IMAGE_FILE.test(file.name))
    if (!list.length) {
      toast('No images found', 'Choose image files or a folder containing images.', 'error')
      return
    }
    if (list.length > 2000) {
      const proceed = window.confirm(
        `${list.length.toLocaleString()} images will be stored in this browser. A very large archive can use several gigabytes of local storage and take a long time. Continue?`,
      )
      if (!proceed) return
    }
    cancelled.current = false
    setBusy(true)
    setStatus('')
    const shouldRead = readFiles && list.length <= 250
    setProgressNow(0, list.length, shouldRead ? 'READING YOUR IMAGES' : 'STORING IMAGE BYTES')
    const batch: Asset[] = []
    let imported = 0
    let failed = 0
    for (let i = 0; i < list.length; i++) {
      if (cancelled.current) break
      const file = list[i]
      let read: { analysis?: Asset['analysis']; width?: number; height?: number } = {}
      if (shouldRead) {
        const url = URL.createObjectURL(file)
        try {
          const result = await analyzeImage(url)
          read = { analysis: result.analysis, width: result.width, height: result.height }
        } catch {
          failed++
        } finally {
          URL.revokeObjectURL(url)
        }
      } else {
        read = await dimensionsOf(file)
      }
      try {
        const asset = await saveAssetBlob(file, {
          id: uid('upload'),
          title: fileTitle(file.name),
          kind: 'upload',
          source: 'upload',
          createdAt: Date.now(),
          width: read.width,
          height: read.height,
          collection: 'Personal photographs',
          tags: read.analysis ? ['upload', 'read', read.analysis.era, read.analysis.lighting] : ['upload', 'bulk'],
          palette: read.analysis?.palette,
          caption: read.analysis ? 'PERSONAL UPLOAD / READ' : 'PERSONAL UPLOAD / BULK',
          note: read.analysis
            ? 'Added from your own archive.'
            : 'Stored in bulk. Open the plate in the archive to read its palette and light.',
          analysis: read.analysis,
        })
        batch.push(asset)
        imported++
      } catch {
        failed++
      }
      if (batch.length >= 30 || i === list.length - 1) {
        addAssets(batch.splice(0))
        await yieldToUI()
      }
      if (i % 4 === 0 || i === list.length - 1) setProgressNow(i + 1, list.length, shouldRead ? 'READING YOUR IMAGES' : 'STORING IMAGE BYTES')
    }
    if (batch.length) addAssets(batch)
    setBusy(false)
    setStatus(`${imported.toLocaleString()} files added${failed ? ` / ${failed} skipped` : ''}.${!shouldRead && list.length > 250 ? ' Reading was skipped for this large batch.' : ''}`)
    toast(
      cancelled.current ? 'Import stopped' : 'Files added',
      `${imported.toLocaleString()} images stored locally${failed ? `, ${failed} skipped` : ''}.`,
      imported ? 'success' : 'error',
    )
  }

  const importEntries = async (entries: ManifestEntry[], mode: { download: boolean; read: boolean }, label: string) => {
    const capped = entries.slice(0, MAX_LINKS)
    if (!capped.length) {
      toast('Nothing to import', 'Add direct image URLs or a manifest with a url column.', 'error')
      return
    }
    if (mode.download && capped.length > 100) {
      const proceed = window.confirm(
        `Download ${capped.length.toLocaleString()} images into this browser? This can take a long time and use several gigabytes. Choose Index Only if you only need references.`,
      )
      if (!proceed) return
    }
    cancelled.current = false
    setBusy(true)
    setStatus('')
    setProgressNow(0, capped.length, mode.download ? 'DOWNLOADING AND STORING' : 'INDEXING LINKS')
    const batch: Asset[] = []
    let imported = 0
    let failed = 0
    for (let i = 0; i < capped.length; i++) {
      if (cancelled.current) break
      const entry = capped[i]
      let blob: Blob | null = null
      if (mode.download) {
        try {
          blob = await fetchImageBlob(entry.url)
        } catch {
          failed++
        }
      }
      const read: { analysis?: Asset['analysis']; width?: number; height?: number } =
        blob && mode.read ? await readBlob(blob) : blob ? await dimensionsOf(blob) : {}
      const asset = assetFromManifest(entry, uid('import'), read.analysis, { width: read.width, height: read.height })
      try {
        if (blob) {
          const { src: _src, ...meta } = asset
          batch.push(await saveAssetBlob(blob, meta))
        } else {
          batch.push(asset)
        }
        imported++
      } catch {
        failed++
      }
      if (batch.length >= (mode.download ? 8 : 200) || i === capped.length - 1) {
        if (batch.length) {
          if (!mode.download) await saveRemoteAssets(batch)
          addAssets(batch.splice(0))
        }
        await yieldToUI()
      }
      if (i % 5 === 0 || i === capped.length - 1) {
        setProgressNow(i + 1, capped.length, mode.download ? 'DOWNLOADING AND STORING' : 'INDEXING LINKS')
      }
    }
    if (batch.length) {
      if (!mode.download) await saveRemoteAssets(batch)
      addAssets(batch.splice(0))
    }
    setBusy(false)
    const suffix = failed ? ` / ${failed} could not be fetched and remain as links` : ''
    setStatus(`${imported.toLocaleString()} ${label} added${suffix}.`)
    toast(
      cancelled.current ? 'Import stopped' : `${label} added`,
      `${imported.toLocaleString()} plates${failed ? `, ${failed} link fallbacks` : ''}.`,
      imported ? 'success' : 'error',
    )
  }

  const indexLinks = () => {
    if (!linksText.trim()) {
      toast('Paste a link sheet first', 'One direct image URL per line.', 'error')
      return
    }
    void importEntries(urlEntries(linksText), { download: false, read: false }, 'links')
  }

  const downloadLinkList = () => {
    if (!linksText.trim()) {
      toast('Paste a link sheet first', 'One direct image URL per line.', 'error')
      return
    }
    void importEntries(urlEntries(linksText), { download: true, read: readLinks }, 'links')
  }

  const manifestEntries = () => parseManifest(manifestText).entries

  const indexManifest = () => {
    const entries = manifestEntries()
    if (!entries.length) {
      toast('Nothing parsed', 'Use JSON, CSV/TSV with a url column, or a plain URL list.', 'error')
      return
    }
    void importEntries(entries, { download: false, read: false }, 'manifest plates')
  }

  const downloadManifest = () => {
    const entries = manifestEntries()
    if (!entries.length) {
      toast('Nothing parsed', 'Use JSON, CSV/TSV with a url column, or a plain URL list.', 'error')
      return
    }
    void importEntries(entries, { download: true, read: readLinks }, 'manifest plates')
  }

  const loadManifestFile = async (file?: File) => {
    if (!file) return
    try {
      const text = await file.text()
      setManifestText(text)
      setManifestName(file.name)
      const parsed = parseManifest(text)
      setStatus(`${parsed.entries.length.toLocaleString()} links parsed from ${file.name} (${parsed.format.toUpperCase()}).`)
    } catch {
      toast('Could not read manifest', 'Try a UTF-8 JSON, CSV or TXT file.', 'error')
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="PHOTO LIBRARY / SOURCE INTAKE"
      title={<>THE <span className="ital">LIBRARY</span></>}
      width={1180}
      footer={
        <>
          <div className="photo-foot-left">
            <span className="mono-xs">{assets.length.toLocaleString()} PLATES IN THIS BROWSER</span>
            <span className="mono-xs muted">{busy ? 'IMPORT IN PROGRESS' : 'LOCAL-FIRST / NOTHING IS UPLOADED TO A SERVER'}</span>
          </div>
          <button className="btn btn--ghost btn--sm" onClick={onClose}>CLOSE</button>
        </>
      }
    >
      <div className="photo-library">
        <div className="photo-library-intro">
          <div>
            <div className="block-label">ACCESS / OPEN SOURCES + YOUR OWN ARCHIVE</div>
            <h3>OVER 100 MILLION OPEN IMAGES. PLUS WHATEVER YOU BRING.</h3>
            <p>
              Search public-domain and Creative Commons photography, drop in a folder of your own exports, or index a
              link sheet of up to 25,000 plates. No scraped social feeds: add the Tumblr, Instagram or Pinterest export
              you have the right to use.
            </p>
          </div>
          <div className="photo-library-badge">
            <Globe2 size={15} />
            <strong>20K+</strong>
            <span>BULK INTAKE READY</span>
          </div>
        </div>

        <div className="photo-tabs">
          {([
            ['open', 'OPEN ARCHIVE', <Globe2 size={12} />],
            ['files', 'FILES / FOLDERS', <FolderOpen size={12} />],
            ['links', 'URL LIST', <Link2 size={12} />],
            ['manifest', 'MANIFEST', <FileJson size={12} />],
          ] as [Tab, string, ReactNode][]).map(([id, label, icon]) => (
            <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)} disabled={busy}>
              {icon} {label}
            </button>
          ))}
        </div>

        {tab === 'open' && (
          <div className="photo-pane">
            <div className="photo-search-row">
              <div className="search photo-search">
                <Search size={14} />
                <input
                  className="input"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void runSearch(query, 0, false)}
                  placeholder="Search subject, era, light, material, photographer…"
                />
              </div>
              <button className="btn btn--solid" onClick={() => void runSearch(query, 0, false)} disabled={searching || busy}>
                {searching ? <Loader2 size={12} className="spin" /> : <Search size={12} />} SEARCH
              </button>
            </div>
            <div className="photo-query-row">
              {OPEN_ARCHIVE_QUERIES.map((suggestion) => (
                <button key={suggestion} onClick={() => { setQuery(suggestion); void runSearch(suggestion, 0, false) }} disabled={searching || busy}>
                  {suggestion}
                </button>
              ))}
            </div>

            <div className="photo-options">
              <label className="photo-option">
                <input type="checkbox" checked={readArchive} onChange={(e) => setReadArchive(e.target.checked)} />
                READ PALETTE + LIGHT ON IMPORT
              </label>
              <span className="mono-xs muted">SOURCE / WIKIMEDIA COMMONS / PUBLIC DOMAIN + CC</span>
            </div>

            {searchError && <div className="photo-warning"><AlertTriangle size={13} /> {searchError}</div>}

            {!!results.length && (
              <>
                <div className="photo-results-head">
                  <span className="mono-xs">{results.length} PLATES LOADED / PAGE OFFSET {resultOffset}</span>
                  <div>
                    <button className="mini-link" onClick={() => setSelected(new Set(results.map((r) => r.id)))}>SELECT PAGE</button>
                    <button className="mini-link" onClick={() => setSelected(new Set())}>CLEAR</button>
                  </div>
                </div>
                <div className="photo-result-grid">
                  {results.map((result) => {
                    const active = selected.has(result.id)
                    return (
                      <div
                        key={result.id}
                        className={`photo-result ${active ? 'is-selected' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleSelected(result.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSelected(result.id) } }}
                        title={`${result.title} / ${result.creator} / ${result.license}`}
                      >
                        <img src={result.thumb} alt={result.title} loading="lazy" />
                        <span className="photo-result-check">{active ? <Check size={12} /> : null}</span>
                        <span className="photo-result-meta">
                          <strong>{result.title || 'Untitled plate'}</strong>
                          <em>{result.creator}</em>
                          <small>{result.license}</small>
                        </span>
                        <a
                          className="photo-result-link"
                          href={result.pageUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          title="Open source page"
                        >
                          <ExternalLink size={10} />
                        </a>
                      </div>
                    )
                  })}
                </div>
                <div className="photo-result-foot">
                  {nextOffset !== null ? (
                    <button className="btn btn--ghost btn--sm" onClick={() => void runSearch(query, nextOffset, true)} disabled={searching || busy}>
                      {searching ? <Loader2 size={11} className="spin" /> : <Upload size={11} />} LOAD MORE
                    </button>
                  ) : <span className="mono-xs muted">END OF THIS SEARCH</span>}
                  <button className="btn btn--accent btn--sm" onClick={() => void importArchiveSelection()} disabled={!selected.size || busy}>
                    {busy ? <Loader2 size={11} className="spin" /> : <ImagePlus size={11} />} ADD {selected.size || ''} TO ARCHIVE
                  </button>
                </div>
              </>
            )}

            {!results.length && !searching && !searchError && (
              <div className="photo-empty">
                <Globe2 size={20} />
                <h4>Search the open archive.</h4>
                <p>Try “flash photography”, “2000s fashion”, “perfume still life” or any material, mood or era.</p>
              </div>
            )}
          </div>
        )}

        {tab === 'files' && (
          <div className="photo-pane">
            <div
              className="photo-drop"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); if (!busy) void importFiles(Array.from(e.dataTransfer.files)) }}
              onClick={() => !busy && fileInput.current?.click()}
            >
              <Upload size={20} />
              <div>
                <strong>DROP IMAGES OR A FOLDER HERE</strong>
                <span>JPG / PNG / WEBP / GIF / AVIF. Files are stored in this browser only.</span>
              </div>
              <div className="photo-drop-actions">
                <button className="btn btn--solid btn--sm" onClick={(e) => { e.stopPropagation(); fileInput.current?.click() }} disabled={busy}>
                  <ImagePlus size={11} /> CHOOSE IMAGES
                </button>
                <button className="btn btn--ghost btn--sm" onClick={(e) => { e.stopPropagation(); folderInput.current?.click() }} disabled={busy}>
                  <FolderOpen size={11} /> CHOOSE FOLDER
                </button>
              </div>
            </div>
            <input ref={fileInput} hidden type="file" accept="image/*" multiple onChange={(e) => { if (e.target.files) void importFiles(Array.from(e.target.files)); e.currentTarget.value = '' }} />
            <input ref={folderInput} hidden type="file" multiple onChange={(e) => { if (e.target.files) void importFiles(Array.from(e.target.files)); e.currentTarget.value = '' }} {...({ webkitdirectory: '', directory: '' } as Record<string, string>)} />
            <div className="photo-options">
              <label className="photo-option">
                <input type="checkbox" checked={readFiles} onChange={(e) => setReadFiles(e.target.checked)} />
                READ PALETTE + LIGHT ON IMPORT
              </label>
              <span className="mono-xs muted">READING IS SKIPPED AUTOMATICALLY ABOVE 250 FILES</span>
            </div>
            <div className="photo-note">
              <strong>BULK INTAKE.</strong> Folder import accepts an entire Tumblr, Instagram or Pinterest export that
              you own. A 20,000-image import can use several gigabytes of browser storage and takes time. Files stay local;
              you can turn the batch into references later from the archive.
            </div>
            <div className="photo-intake-stats">
              <div><b>01</b><span>DROP OR CHOOSE</span></div>
              <div><b>02</b><span>STORED IN INDEXEDDB</span></div>
              <div><b>03</b><span>READ ON DEMAND</span></div>
            </div>
          </div>
        )}

        {tab === 'links' && (
          <div className="photo-pane">
            <div className="photo-pane-head">
              <div>
                <div className="block-label">LINK SHEET / DIRECT IMAGE URLS</div>
                <h4>PASTE UP TO 25,000 LINKS</h4>
              </div>
              <span className="mono-xs">{linkCount.toLocaleString()} DETECTED</span>
            </div>
            <textarea
              className="textarea photo-textarea"
              value={linksText}
              onChange={(e) => setLinksText(e.target.value)}
              placeholder={'https://example.com/photo-01.jpg\nhttps://example.com/photo-02.jpg\n\nIndex only keeps the links. Download stores the actual image bytes for editing, export and offline use.'}
              spellCheck={false}
            />
            <div className="photo-options">
              <label className="photo-option">
                <input type="checkbox" checked={readLinks} onChange={(e) => setReadLinks(e.target.checked)} />
                READ PALETTE + LIGHT WHEN DOWNLOADING
              </label>
              <span className="mono-xs muted">DIRECT IMAGE LINKS WORK BEST / HOTLINK PROTECTION MAY FAIL</span>
            </div>
            <div className="photo-bulk-actions">
              <button className="btn btn--solid" onClick={indexLinks} disabled={busy}>
                {busy ? <Loader2 size={12} className="spin" /> : <Link2 size={12} />} INDEX {linkCount ? linkCount.toLocaleString() : ''} LINKS
              </button>
              <button className="btn btn--ghost" onClick={downloadLinkList} disabled={busy}>
                <Upload size={12} /> DOWNLOAD & STORE
              </button>
            </div>
            <div className="photo-note">
              <strong>RIGHTS.</strong> Use direct image URLs you own or have permission to use. Index-only plates are
              remote references; if the source disappears, the image disappears with it. Downloading stores the bytes in
              this browser.
            </div>
          </div>
        )}

        {tab === 'manifest' && (
          <div className="photo-pane">
            <div className="photo-pane-head">
              <div>
                <div className="block-label">MANIFEST / JSON, CSV OR TSV</div>
                <h4>A DATASET YOU ALREADY HAVE</h4>
              </div>
              <span className="mono-xs">{manifestCount.toLocaleString()} LINKS PARSED</span>
            </div>
            <div className="photo-manifest-tools">
              <button className="btn btn--ghost btn--sm" onClick={() => manifestInput.current?.click()} disabled={busy}>
                <FileJson size={11} /> LOAD MANIFEST FILE
              </button>
              <span className="mono-xs muted">{manifestName || 'JSON ARRAY / OBJECT, CSV, TSV, TXT'}</span>
              <input
                ref={manifestInput}
                hidden
                type="file"
                accept=".json,.csv,.tsv,.txt,application/json,text/csv,text/plain"
                onChange={(e) => { void loadManifestFile(e.target.files?.[0]); e.currentTarget.value = '' }}
              />
            </div>
            <textarea
              className="textarea photo-textarea photo-textarea--manifest"
              value={manifestText}
              onChange={(e) => { setManifestText(e.target.value); setManifestName('') }}
              placeholder={'[\n  { "url": "https://…/plate-01.jpg", "title": "Bedroom, 2006", "collection": "Tumblr / diary", "tags": ["flash", "portrait"] },\n  { "url": "https://…/plate-02.jpg", "title": "Untitled", "license": "CC BY 4.0" }\n]'}
              spellCheck={false}
            />
            <div className="photo-options">
              <label className="photo-option">
                <input type="checkbox" checked={readLinks} onChange={(e) => setReadLinks(e.target.checked)} />
                READ PALETTE + LIGHT WHEN DOWNLOADING
              </label>
              <span className="mono-xs muted">FIELDS / URL, TITLE, COLLECTION, TAGS, NOTE, CREATOR, LICENSE</span>
            </div>
            <div className="photo-bulk-actions">
              <button className="btn btn--solid" onClick={indexManifest} disabled={busy}>
                {busy ? <Loader2 size={12} className="spin" /> : <FileJson size={12} />} INDEX {manifestCount ? manifestCount.toLocaleString() : ''} PLATES
              </button>
              <button className="btn btn--ghost" onClick={downloadManifest} disabled={busy}>
                <Upload size={12} /> DOWNLOAD & STORE
              </button>
            </div>
            <div className="photo-note">
              <strong>EXPORT FRIENDLY.</strong> Keep the original source URL, creator and license in the manifest if you
              have them. They are carried into the archive plate and visible in its drawer.
            </div>
          </div>
        )}

        {busy && (
          <div className="photo-progress panel">
            <div className="photo-progress-top">
              <span className="mono-xs"><Loader2 size={10} className="spin" /> {progress.label}</span>
              <button className="mini-link" onClick={() => { cancelled.current = true }}>
                <StopCircle size={10} /> STOP
              </button>
            </div>
            <div className="photo-progress-bar">
              <i style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 2}%` }} />
            </div>
            <div className="photo-progress-meta">
              <span>{progress.done.toLocaleString()} / {progress.total.toLocaleString()}</span>
              <span>{progress.total ? `${Math.round((progress.done / progress.total) * 100)}%` : 'STARTING'}</span>
            </div>
          </div>
        )}

        {!!status && !busy && <div className="photo-status"><Check size={12} /> {status}</div>}
      </div>
    </Modal>
  )
}
