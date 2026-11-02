import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Search, Upload, Heart, ArrowUpRight, Aperture, Layers, Trash2, Plus, X,
  Fingerprint, ImagePlus, Check, SlidersHorizontal, Library, Globe2, FolderOpen, Link2,
} from 'lucide-react'
import { PageHeader, Drawer, ImagePlate, Swatches, SectionHead, CopyButton } from '../components/UI'
import { PhotoLibrary } from '../components/PhotoLibrary'
import { useApp, uid } from '../lib/store'
import { analyzeImage, aggregateAnalyses, analysisToProfile } from '../lib/analyze'
import { saveAssetBlob } from '../lib/imageStore'
import { COLLECTIONS } from '../lib/presets'
import type { Asset } from '../lib/types'

type Filter = 'all' | 'references' | 'favorites' | 'generated' | 'uploads' | 'open' | 'seeds'
const PAGE_SIZE = 48

export function Archive() {
  const assets = useApp((s) => s.assets)
  const references = useApp((s) => s.references)
  const addAsset = useApp((s) => s.addAsset)
  const removeAsset = useApp((s) => s.removeAsset)
  const toggleFavorite = useApp((s) => s.toggleFavorite)
  const addReference = useApp((s) => s.addReference)
  const removeReference = useApp((s) => s.removeReference)
  const updateStudio = useApp((s) => s.updateStudio)
  const studio = useApp((s) => s.studio)
  const navigate = useApp((s) => s.navigate)
  const toast = useApp((s) => s.toast)

  const [query, setQuery] = useState('')
  const [collection, setCollection] = useState('All references')
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<Asset | null>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [libraryTab, setLibraryTab] = useState<'open' | 'files' | 'links' | 'manifest'>('open')
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const refAssetIds = new Set(references.map((r) => r.assetId))
  const collections = useMemo(() => {
    const existing = new Set(assets.map((a) => a.collection).filter(Boolean) as string[])
    const standard = COLLECTIONS.filter((c) => existing.has(c) || c === 'Personal photographs' || c === 'Open Archive')
    const extra = [...existing].filter((c) => !COLLECTIONS.includes(c)).sort()
    return ['All references', ...standard, ...extra]
  }, [assets])

  const filtered = assets.filter((a) => {
    const q = query.trim().toLowerCase()
    if (q && !`${a.title} ${a.collection ?? ''} ${(a.tags ?? []).join(' ')} ${a.caption ?? ''} ${a.note ?? ''} ${String(a.meta?.creator ?? '')}`.toLowerCase().includes(q)) return false
    if (collection !== 'All references' && a.collection !== collection) return false
    if (filter === 'references' && !refAssetIds.has(a.id)) return false
    if (filter === 'favorites' && !a.favorite) return false
    if (filter === 'generated' && a.source !== 'generated' && a.source !== 'edited') return false
    if (filter === 'uploads' && a.source !== 'upload' && a.source !== 'imported') return false
    if (filter === 'open' && a.source !== 'open') return false
    if (filter === 'seeds' && a.source !== 'seed') return false
    return true
  })

  useEffect(() => {
    setVisible(PAGE_SIZE)
  }, [query, collection, filter])

  const dna = aggregateAnalyses(references.map((r) => r.analysis))
  const dnaProfile = dna ? analysisToProfile(dna) : []
  const dnaAssets = references.map((r) => assets.find((a) => a.id === r.assetId)).filter(Boolean) as Asset[]

  const ensureAnalysis = async (asset: Asset): Promise<Asset | null> => {
    if (asset.analysis) return asset
    setAnalyzingId(asset.id)
    try {
      const { analysis, width, height } = await analyzeImage(asset.src)
      const patch = { analysis, width, height, palette: analysis.palette, caption: 'ARCHIVE PLATE / READ' }
      useApp.getState().updateAsset(asset.id, patch)
      setSelected((current) => (current?.id === asset.id ? { ...current, ...patch } : current))
      return { ...asset, ...patch }
    } catch {
      toast('Could not read this plate', 'The image may be offline or protected by its host.', 'error')
      return null
    } finally {
      setAnalyzingId(null)
    }
  }

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (!list.length) return
    setUploading(true)
    setUploadStatus(`0 / ${list.length}`)
    let count = 0
    const shouldRead = list.length <= 60
    for (let i = 0; i < list.length; i++) {
      const file = list[i]
      try {
        let analysis: Asset['analysis']
        let width: number | undefined
        let height: number | undefined
        if (shouldRead) {
          const src = URL.createObjectURL(file)
          try {
            const result = await analyzeImage(src)
            analysis = result.analysis
            width = result.width
            height = result.height
          } finally {
            URL.revokeObjectURL(src)
          }
        } else {
          try {
            const bitmap = await createImageBitmap(file)
            width = bitmap.width
            height = bitmap.height
            bitmap.close()
          } catch {
            // Dimensions are optional for a bulk plate.
          }
        }
        const meta = {
          id: uid('upload'),
          title: file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ') || 'Untitled upload',
          kind: 'upload' as const,
          source: 'upload' as const,
          createdAt: Date.now(),
          width,
          height,
          collection: 'Personal photographs',
          tags: analysis ? ['upload', analysis.era, analysis.lighting] : ['upload', 'bulk'],
          palette: analysis?.palette,
          caption: analysis ? 'PERSONAL UPLOAD / READ' : 'PERSONAL UPLOAD / BULK',
          analysis,
          note: analysis ? 'Added from your own archive.' : 'Stored in bulk. Read the plate later to use it as a reference.',
        }
        const asset = await saveAssetBlob(file, meta)
        addAsset(asset)
        count++
      } catch {
        toast('One file could not be read', file.name, 'error')
      }
      if (i % 3 === 0 || i === list.length - 1) setUploadStatus(`${i + 1} / ${list.length}`)
    }
    setUploading(false)
    setUploadStatus('')
    if (count) toast('Added to the archive', `${count} image${count > 1 ? 's' : ''} stored locally${shouldRead ? ' and read' : ''}.`, 'success')
  }

  const toggleRef = async (asset: Asset) => {
    const existing = references.find((r) => r.assetId === asset.id)
    if (existing) {
      removeReference(existing.id)
      updateStudio({ referenceIds: studio.referenceIds.filter((id) => id !== asset.id) })
      toast('Reference removed', asset.title)
    } else {
      const ready = await ensureAnalysis(asset)
      if (!ready?.analysis) return
      addReference({
        id: uid('ref'),
        assetId: ready.id,
        collection: ready.collection ?? 'Personal photographs',
        note: ready.note ?? '',
        analysis: ready.analysis,
        createdAt: Date.now(),
      })
      updateStudio({ referenceIds: [...studio.referenceIds, ready.id].slice(-4) })
      toast('Reference added', `${ready.title} now guides palette and light.`, 'success')
    }
  }

  const useCollectionAsDNA = () => {
    const pool = filtered.filter((a) => a.analysis)
    if (!pool.length) return
    const ids = pool.slice(0, 4).map((a) => a.id)
    updateStudio({ referenceIds: ids })
    toast('Visual DNA applied', `${ids.length} references are now guiding the studio.`, 'success')
    navigate('studio')
  }

  return (
    <div className="page archive-page">
      <PageHeader
        index="05"
        kicker="REFERENCE INTELLIGENCE / THE ARCHIVE"
        title={<>THE <span className="ital">ARCHIVE</span></>}
        description="Every plate is read as evidence: palette, light, contrast, grain, negative space, era and mood. Upload your own references, build collections, and turn them into a shared visual DNA."
        actions={
          <>
            <button className="btn btn--ghost" onClick={() => inputRef.current?.click()}><Upload size={12} /> UPLOAD</button>
            <button className="btn btn--ghost" onClick={() => setLibraryOpen(true)}><Library size={12} /> PHOTO LIBRARY</button>
            <button className="btn btn--solid" onClick={useCollectionAsDNA}><Fingerprint size={12} /> USE VIEW AS DNA</button>
          </>
        }
        meta={
          <div className="page-meta">
            <span>{assets.length.toLocaleString()} plates</span>
            <span>{references.length} references</span>
            <span>{assets.filter((a) => a.favorite).length} favourites</span>
            <span>{assets.filter((a) => a.source === 'upload' || a.source === 'imported').length.toLocaleString()} uploads</span>
            <span>{assets.filter((a) => a.source === 'open').length.toLocaleString()} open archive</span>
          </div>
        }
      />

      <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files) void handleFiles(e.target.files); e.currentTarget.value = '' }} />

      <div className="library-banner">
        <div className="library-banner-copy">
          <div className="block-label">THE PHOTO LIBRARY / OPEN SOURCES + YOUR OWN</div>
          <h2>OVER 100 MILLION OPEN IMAGES.<br /><span className="ital">PLUS A PLACE FOR YOURS.</span></h2>
          <p>
            Search public-domain and Creative Commons photography, drop in a folder of your own exports, or index a
            link sheet of up to 25,000 plates. Built for the 20,000-image archive, not a four-image demo.
          </p>
        </div>
        <div className="library-banner-actions">
          <button className="library-action" onClick={() => { setLibraryTab('open'); setLibraryOpen(true) }}>
            <Globe2 size={15} />
            <span><strong>OPEN ARCHIVE</strong><em>100M+ CC + public domain</em></span>
            <ArrowUpRight size={11} />
          </button>
          <button className="library-action" onClick={() => { setLibraryTab('files'); setLibraryOpen(true) }}>
            <FolderOpen size={15} />
            <span><strong>IMPORT A FOLDER</strong><em>Bulk-add your own archive</em></span>
            <ArrowUpRight size={11} />
          </button>
          <button className="library-action" onClick={() => { setLibraryTab('links'); setLibraryOpen(true) }}>
            <Link2 size={15} />
            <span><strong>INDEX A LINK SHEET</strong><em>20,000+ remote references</em></span>
            <ArrowUpRight size={11} />
          </button>
        </div>
      </div>

      <div className="archive-dna panel">
        <div className="archive-dna-left">
          <div className="block-label">VISUAL DNA / {references.length} REFERENCES</div>
          {dna ? (
            <>
              <h2 className="dna-big">{dna.mood.slice(0, 3).join(' / ')}</h2>
              <p>{dna.summary}</p>
              <Swatches palette={dna.palette} size={26} labels />
              <div className="dna-chip-row">
                {dna.composition.map((c) => <span key={c} className="chip">{c}</span>)}
                <span className="chip">{dna.era}</span>
              </div>
            </>
          ) : (
            <p>Add references to build a visual DNA profile.</p>
          )}
        </div>
        <div className="archive-dna-bars">
          {dnaProfile.map((p) => (
            <div key={p.label} className="dna-bar">
              <span>{p.label}</span>
              <div><i style={{ width: `${p.value}%` }} /></div>
              <em>{p.value}</em>
            </div>
          ))}
        </div>
        <div className="archive-dna-refs">
          {dnaAssets.slice(0, 4).map((a) => (
            <button key={a.id} className="dna-ref-thumb" onClick={() => setSelected(a)} title={a.title}>
              <img src={a.src} alt={a.title} />
            </button>
          ))}
          <button className="dna-ref-add" onClick={() => setFilter('references')}><Plus size={14} /><span>MANAGE<br />REFERENCES</span></button>
        </div>
      </div>

      <div
        className={`archive-drop ${dragging ? 'is-dragging' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); void handleFiles(e.dataTransfer.files) }}
        onClick={() => inputRef.current?.click()}
      >
        <ImagePlus size={18} />
        <div>
          <strong>{uploading ? `READING YOUR IMAGES / ${uploadStatus}` : 'DROP IMAGES INTO THE ARCHIVE'}</strong>
          <span>Drop a few references, or open the Photo Library for folders, link sheets and the open archive.</span>
        </div>
        <span className="mono-xs muted">JPG / PNG / WEBP</span>
      </div>

      <div className="archive-toolbar">
        <div className="search archive-search">
          <Search size={13} />
          <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title, tags, notes…" />
        </div>
        <div className="seg archive-filter">
          {([
            ['all', 'All'],
            ['references', 'References'],
            ['favorites', 'Favourites'],
            ['generated', 'Generated'],
            ['uploads', 'Uploads'],
            ['open', 'Open'],
          ] as [Filter, string][]).map(([k, l]) => (
            <button key={k} className={filter === k ? 'active' : ''} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
        <select className="select archive-collection" value={collection} onChange={(e) => setCollection(e.target.value)}>
          {collections.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="archive-grid">
        {filtered.slice(0, visible).map((a, i) => (
          <article key={a.id} className={`archive-card ${a.favorite ? 'is-fav' : ''}`}>
            <button className="archive-card-image" onClick={() => setSelected(a)}>
              <ImagePlate src={a.src} alt={a.title} ratio={i % 7 === 0 ? '4 / 5' : '3 / 4'} tag={refAssetIds.has(a.id) ? 'REFERENCE' : a.source.toUpperCase()} />
              {a.favorite && <span className="archive-fav"><Heart size={10} fill="currentColor" /></span>}
            </button>
            <div className="archive-card-meta">
              <div>
                <h3>{a.title}</h3>
                <p>{a.collection ?? 'Unfiled'} · {new Date(a.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()}</p>
              </div>
              <div className="archive-card-tools">
                <button className="tooltip" data-tip={refAssetIds.has(a.id) ? 'Remove reference' : 'Use as reference'} onClick={() => toggleRef(a)}>
                  <Fingerprint size={11} style={{ color: refAssetIds.has(a.id) ? 'var(--accent)' : undefined }} />
                </button>
                <button className="tooltip" data-tip="Darkroom" onClick={() => { useApp.getState().setFocusAsset(a.id); navigate('darkroom') }}><Aperture size={11} /></button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {filtered.length > visible && (
        <div className="archive-more">
          <span className="mono-xs muted">SHOWING {visible.toLocaleString()} / {filtered.length.toLocaleString()} PLATES</span>
          <button className="btn btn--ghost btn--sm" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
            LOAD {Math.min(PAGE_SIZE, filtered.length - visible).toLocaleString()} MORE
          </button>
        </div>
      )}

      {!filtered.length && (
        <div className="empty" style={{ marginTop: 24 }}>
          <h3>This shelf is empty.</h3>
          <p>Change the filter or upload a reference. The archive only becomes useful when it disagrees with you.</p>
          <button className="btn btn--ghost btn--sm" style={{ marginTop: 14 }} onClick={() => inputRef.current?.click()}><Upload size={11} /> UPLOAD AN IMAGE</button>
        </div>
      )}

      <section className="section">
        <SectionHead index="06" title="Collections" link={<span className="mono-xs muted">FILED BY HAND</span>} />
        <div className="collection-grid">
          {collections.slice(1).map((c) => {
            const items = assets.filter((a) => a.collection === c)
            return (
              <button key={c} className="collection-card" onClick={() => { setCollection(collection === c ? 'All references' : c); setFilter('all') }}>
                <div className="collection-stack">
                  {items.slice(0, 3).map((a, i) => <img key={a.id} src={a.src} alt="" style={{ zIndex: 3 - i, transform: `translate(${i * 7}px, ${i * -4}px)` }} />)}
                  {!items.length && <span className="mono-xs muted">EMPTY</span>}
                </div>
                <div className="collection-meta">
                  <span>{c}</span>
                  <b>{items.length}</b>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <ArchiveDrawer
        asset={selected}
        isRef={!!selected && refAssetIds.has(selected.id)}
        analyzing={!!selected && analyzingId === selected.id}
        onClose={() => setSelected(null)}
        onToggleRef={() => selected && void toggleRef(selected)}
        onAnalyze={() => selected && void ensureAnalysis(selected)}
        onFavorite={() => selected && toggleFavorite(selected.id)}
        onDelete={() => {
          if (!selected) return
          if (!confirm(`Remove “${selected.title}” from the archive?`)) return
          removeAsset(selected.id)
          setSelected(null)
          toast('Removed from archive', 'The plate is gone from this browser.', 'default')
        }}
      />

      <PhotoLibrary open={libraryOpen} initialTab={libraryTab} onClose={() => setLibraryOpen(false)} />
    </div>
  )
}

function ArchiveDrawer({ asset, isRef, analyzing, onClose, onToggleRef, onAnalyze, onFavorite, onDelete }: {
  asset: Asset | null
  isRef: boolean
  analyzing: boolean
  onClose: () => void
  onToggleRef: () => void
  onAnalyze: () => void
  onFavorite: () => void
  onDelete: () => void
}) {
  if (!asset) return null
  const navigate = useApp.getState().navigate
  const setFocus = useApp.getState().setFocusAsset
  const profile = asset.analysis ? analysisToProfile(asset.analysis) : []
  return (
    <Drawer
      open={!!asset}
      onClose={onClose}
      eyebrow={`ARCHIVE PLATE / ${asset.source.toUpperCase()}`}
      title={asset.title}
      footer={
        <>
          <button className="btn btn--solid btn--sm" onClick={onToggleRef}>{isRef ? <><X size={11} /> REMOVE REFERENCE</> : <><Fingerprint size={11} /> USE AS REFERENCE</>}</button>
          <button className="btn btn--ghost btn--sm" onClick={() => { setFocus(asset.id); navigate('darkroom') }}><Aperture size={11} /> DEVELOP</button>
        </>
      }
    >
      <ImagePlate src={asset.src} alt={asset.title} ratio="4 / 5" caption={asset.caption} />
      <div className="detail-list" style={{ marginTop: 18 }}>
        <div className="kv"><span>Collection</span><span>{asset.collection ?? 'Unfiled'}</span></div>
        <div className="kv"><span>Created</span><span>{new Date(asset.createdAt).toLocaleDateString('en-GB')}</span></div>
        <div className="kv"><span>Source</span><span>{asset.source}</span></div>
        <div className="kv"><span>Dimensions</span><span>{asset.width && asset.height ? `${asset.width} × ${asset.height}` : 'unknown'}</span></div>
        <div className="kv"><span>Era</span><span>{asset.analysis?.era ?? '—'}</span></div>
        {asset.meta?.provider && <div className="kv"><span>Provider</span><span>{asset.meta.provider}</span></div>}
        {asset.meta?.creator && <div className="kv"><span>Credit</span><span>{asset.meta.creator}</span></div>}
        {asset.meta?.license && <div className="kv"><span>License</span><span>{asset.meta.license}</span></div>}
      </div>

      {!!asset.meta?.originUrl && (
        <a className="mini-link" href={String(asset.meta.originUrl)} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', marginTop: 10 }}>
          VIEW SOURCE PAGE <ArrowUpRight size={10} />
        </a>
      )}

      {!asset.analysis && (
        <div className="archive-read-block">
          <div>
            <div className="block-label">NOT YET READ</div>
            <p>Read this plate locally to extract palette, light and grain for the visual DNA.</p>
          </div>
          <button className="btn btn--ghost btn--sm" onClick={onAnalyze} disabled={analyzing}>
            {analyzing ? 'READING…' : 'READ PLATE'}
          </button>
        </div>
      )}

      {asset.analysis && (
        <>
          <div className="style-drawer-block">
            <div className="block-label">READING / {asset.analysis.lighting}</div>
            <div className="archive-analysis-bars">
              {profile.map((p) => (
                <div key={p.label} className="dna-bar">
                  <span>{p.label}</span>
                  <div><i style={{ width: `${p.value}%` }} /></div>
                  <em>{p.value}</em>
                </div>
              ))}
            </div>
            <div className="word-row" style={{ marginTop: 14 }}>
              {asset.analysis.mood.map((m) => <span key={m} className="chip active chip--accent">{m}</span>)}
            </div>
          </div>
          <div className="style-drawer-block">
            <div className="block-label">PALETTE</div>
            <Swatches palette={asset.analysis.palette} size={30} labels />
            <p className="detail-prompt" style={{ marginTop: 12 }}>{asset.analysis.summary}</p>
          </div>
        </>
      )}

      {asset.tags?.length ? (
        <div className="style-drawer-block">
          <div className="block-label">TAGS</div>
          <div className="word-row">{asset.tags.map((t) => <span key={t} className="chip">{t}</span>)}</div>
        </div>
      ) : null}

      {asset.note && <div className="note" style={{ margin: '18px 0' }}>{asset.note}</div>}

      {asset.prompt && (
        <div className="style-drawer-block">
          <div className="block-label">PROMPT</div>
          <p className="detail-prompt">{asset.prompt}</p>
          <CopyButton text={asset.prompt} label="COPY PROMPT" />
        </div>
      )}

      <div className="drawer-tool-row">
        <button className="btn btn--ghost btn--sm" onClick={onFavorite}><Heart size={11} fill={asset.favorite ? 'currentColor' : 'none'} /> {asset.favorite ? 'FAVOURITED' : 'FAVOURITE'}</button>
        <button className="btn btn--ghost btn--sm" onClick={onDelete}><Trash2 size={11} /> REMOVE</button>
      </div>
    </Drawer>
  )
}
