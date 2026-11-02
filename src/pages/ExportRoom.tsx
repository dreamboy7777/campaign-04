import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Download, FileArchive, Image as ImageIcon, RefreshCw, Layers, Package,
  FolderArchive, SlidersHorizontal, Check, AlertTriangle, FileImage, Box,
} from 'lucide-react'
import { PageHeader, Slider, SectionHead, ImagePlate, Swatches } from '../components/UI'
import { useApp, uid } from '../lib/store'
import { drawImageCover, hexToRgb } from '../lib/imaging'
import { canvasToBlob, downloadBlob, loadImage } from '../lib/imageStore'
import type { Asset, ExportRecord } from '../lib/types'
import { zipSync, strToU8 } from 'fflate'

type ExportFormat = 'png' | 'jpeg' | 'webp'

interface ExportConfig {
  format: ExportFormat
  longEdge: number
  quality: number
  border: number
  matte: string
  fit: 'cover' | 'contain'
}

const DEFAULT_CONFIG: ExportConfig = {
  format: 'jpeg',
  longEdge: 1600,
  quality: 0.92,
  border: 0,
  matte: '#efe8d8',
  fit: 'cover',
}

const MIME: Record<ExportFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

const EXT: Record<ExportFormat, string> = {
  png: 'png',
  jpeg: 'jpg',
  webp: 'webp',
}

function slug(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64) || 'untitled'
}

async function composeExport(asset: Asset, config: ExportConfig, longEdgeOverride?: number) {
  const img = await loadImage(asset.src)
  const longEdge = Math.min(6000, Math.max(320, longEdgeOverride ?? config.longEdge))
  const scale = longEdge / Math.max(img.naturalWidth, img.naturalHeight)
  const width = Math.max(1, Math.round(img.naturalWidth * scale))
  const height = Math.max(1, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = config.matte
  ctx.fillRect(0, 0, width, height)
  const border = Math.round((config.border / 100) * Math.min(width, height))
  const innerW = Math.max(1, width - border * 2)
  const innerH = Math.max(1, height - border * 2)
  if (config.fit === 'cover') {
    ctx.save()
    ctx.beginPath()
    ctx.rect(border, border, innerW, innerH)
    ctx.clip()
    drawImageCover(ctx, img, border, border, innerW, innerH, 0.5, 0.42)
    ctx.restore()
  } else {
    const s = Math.min(innerW / img.naturalWidth, innerH / img.naturalHeight)
    const dw = img.naturalWidth * s
    const dh = img.naturalHeight * s
    ctx.drawImage(img, border + (innerW - dw) / 2, border + (innerH - dh) / 2, dw, dh)
  }
  if (border > 0) {
    const [r, g, b] = hexToRgb(config.matte)
    ctx.strokeStyle = `rgba(${r},${g},${b},0.55)`
    ctx.lineWidth = Math.max(1, border * 0.04)
    ctx.strokeRect(border + 0.5, border + 0.5, innerW - 1, innerH - 1)
  }
  return { canvas, width, height }
}

export function ExportRoom() {
  const assets = useApp((s) => s.assets)
  const campaigns = useApp((s) => s.campaigns)
  const exports = useApp((s) => s.exports)
  const addExport = useApp((s) => s.addExport)
  const setUsage = useApp((s) => s.setUsage)
  const usage = useApp((s) => s.usage)
  const toast = useApp((s) => s.toast)

  const [assetId, setAssetId] = useState('seed-cover-closeup')
  const [config, setConfig] = useState<ExportConfig>(DEFAULT_CONFIG)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [working, setWorking] = useState(false)
  const [progress, setProgress] = useState('')
  const [bundleScope, setBundleScope] = useState(campaigns[0]?.id ?? '__all__')
  const [bundleMode, setBundleMode] = useState<'original' | 'jpeg'>('original')
  const previewRef = useRef<HTMLCanvasElement>(null)

  const asset = assets.find((a) => a.id === assetId) ?? assets[0]
  const imageAssets = useMemo(() => assets.filter((a) => a.kind !== 'layout' || a.source === 'seed'), [assets])

  const bundleAssets = useMemo(() => {
    if (bundleScope === '__all__') return assets
    if (bundleScope === '__studio__') return assets.filter((a) => a.source === 'generated' || a.source === 'edited')
    const campaign = campaigns.find((c) => c.id === bundleScope)
    if (!campaign) return []
    const ids = new Set(campaign.assets.map((a) => a.assetId).filter(Boolean))
    return assets.filter((a) => ids.has(a.id))
  }, [assets, bundleScope, campaigns])

  useEffect(() => {
    if (!assets.some((a) => a.id === assetId)) setAssetId(assets[0]?.id)
  }, [assets, assetId])

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      if (!asset) return
      try {
        const { canvas, width, height } = await composeExport(asset, config, Math.min(config.longEdge, 1400))
        if (cancelled) return
        const preview = previewRef.current
        if (!preview) return
        preview.width = width
        preview.height = height
        const ctx = preview.getContext('2d')!
        ctx.clearRect(0, 0, width, height)
        ctx.drawImage(canvas, 0, 0)
        setSize({ width: Math.round(config.longEdge * (width / Math.max(width, height))), height: Math.round(config.longEdge * (height / Math.max(width, height))) })
      } catch {
        /* source image unavailable */
      }
    }, 160)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [asset, config])

  const patch = (p: Partial<ExportConfig>) => setConfig((c) => ({ ...c, ...p }))

  const exportOne = async () => {
    if (!asset) return
    setWorking(true)
    setProgress('Rendering the file…')
    try {
      const { canvas, width, height } = await composeExport(asset, config)
      const blob = await canvasToBlob(canvas, MIME[config.format], config.quality)
      const name = `${slug(asset.title)}-${width}x${height}.${EXT[config.format]}`
      downloadBlob(blob, name)
      addExport({ id: uid('exp'), name, format: config.format.toUpperCase(), width, height, createdAt: Date.now(), assetId: asset.id })
      setUsage({ exports: usage.exports + 1 })
      toast('File exported', `${name} · ${(blob.size / 1024).toFixed(0)} KB.`, 'success')
    } catch (err) {
      toast('Export failed', err instanceof Error ? err.message : 'The image could not be exported.', 'error')
    } finally {
      setWorking(false)
      setProgress('')
    }
  }

  const exportBundle = async () => {
    if (!bundleAssets.length) {
      toast('Nothing to bundle', 'Choose a campaign or archive with images in it.', 'error')
      return
    }
    setWorking(true)
    const files: Record<string, Uint8Array> = {}
    const manifest: string[] = [
      'CAMPAIGN 04 / EXPORT BUNDLE',
      `SCOPE: ${bundleScope === '__all__' ? 'THE WHOLE ARCHIVE' : bundleScope === '__studio__' ? 'STUDIO OUTPUT' : campaigns.find((c) => c.id === bundleScope)?.title ?? bundleScope}`,
      `FILES: ${bundleAssets.length}`,
      `MODE: ${bundleMode.toUpperCase()}`,
      `EXPORTED: ${new Date().toISOString()}`,
      '',
      'CONTENTS',
    ]
    try {
      for (let i = 0; i < bundleAssets.length; i++) {
        const a = bundleAssets[i]
        setProgress(`Packing ${i + 1} of ${bundleAssets.length}…`)
        let blob: Blob
        let filename: string
        if (bundleMode === 'jpeg') {
          const { canvas, width, height } = await composeExport(a, { ...DEFAULT_CONFIG, format: 'jpeg', longEdge: 2000, quality: 0.9 })
          blob = await canvasToBlob(canvas, 'image/jpeg', 0.9)
          filename = `${String(i + 1).padStart(2, '0')}-${slug(a.title)}-${width}x${height}.jpg`
        } else {
          const res = await fetch(a.src)
          if (!res.ok) throw new Error(`Could not read ${a.title}`)
          blob = await res.blob()
          const type = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg'
          filename = `${String(i + 1).padStart(2, '0')}-${slug(a.title)}.${type}`
        }
        files[filename] = new Uint8Array(await blob.arrayBuffer())
        manifest.push(`${String(i + 1).padStart(2, '0')}  ${a.title}  [${a.source}]  ${a.width ?? '?'}×${a.height ?? '?'}`)
      }
      manifest.push('', 'NOTE', 'Browser exports are sRGB. No CMYK profile or print-ready PDF is included. Images generated or edited in this studio live in IndexedDB on this device.')
      files['MANIFEST.txt'] = strToU8(manifest.join('\n'))
      setProgress('Compressing the bundle…')
      const zipped = zipSync(files, { level: 6 })
      const blob = new Blob([zipped], { type: 'application/zip' })
      const scopeName = bundleScope === '__all__' ? 'archive' : bundleScope === '__studio__' ? 'studio-output' : slug(campaigns.find((c) => c.id === bundleScope)?.title ?? 'campaign')
      const name = `campaign04-${scopeName}-${bundleAssets.length}-plates.zip`
      downloadBlob(blob, name)
      addExport({ id: uid('exp'), name, format: 'ZIP', width: 0, height: 0, createdAt: Date.now() })
      setUsage({ exports: usage.exports + 1 })
      toast('Bundle exported', `${bundleAssets.length} plates packed with a manifest.`, 'success')
    } catch (err) {
      toast('Bundle failed', err instanceof Error ? err.message : 'A file could not be packed.', 'error')
    } finally {
      setWorking(false)
      setProgress('')
    }
  }

  const reExport = async (record: ExportRecord) => {
    if (!record.assetId) {
      toast('No source stored', 'This record has no linked plate to re-export.', 'error')
      return
    }
    const source = assets.find((a) => a.id === record.assetId)
    if (!source) {
      toast('Plate missing', 'The source image is no longer in the archive.', 'error')
      return
    }
    setAssetId(source.id)
    const format = (record.format.toLowerCase() === 'jpg' ? 'jpeg' : record.format.toLowerCase()) as ExportFormat
    const next: ExportConfig = { ...config, format: ['png', 'jpeg', 'webp'].includes(format) ? format : 'jpeg', longEdge: Math.max(record.width, record.height) || config.longEdge }
    setConfig(next)
    setWorking(true)
    try {
      const { canvas, width, height } = await composeExport(source, next)
      const blob = await canvasToBlob(canvas, MIME[next.format], next.quality)
      const name = `${slug(source.title)}-${width}x${height}.${EXT[next.format]}`
      downloadBlob(blob, name)
      addExport({ id: uid('exp'), name, format: next.format.toUpperCase(), width, height, createdAt: Date.now(), assetId: source.id })
      setUsage({ exports: usage.exports + 1 })
      toast('Re-exported', name, 'success')
    } catch {
      toast('Could not re-export', 'The source image could not be read.', 'error')
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="page export-page">
      <PageHeader
        index="14"
        kicker="PRINT & DIGITAL / EXPORT ROOM"
        title={<>THE EXPORT <span className="ital">ROOM</span></>}
        description="One plate or a whole campaign. Real PNG, JPEG and WebP conversion at a chosen long edge, with a matte, a fit rule and a working export history. ZIP bundles include every file and a text manifest."
        actions={
          <>
            <button className="btn btn--ghost" onClick={exportBundle} disabled={working}><FileArchive size={12} /> {working && progress ? progress : 'EXPORT BUNDLE'}</button>
            <button className="btn btn--solid" onClick={exportOne} disabled={working}><Download size={12} /> {working && !progress ? 'EXPORTING…' : 'EXPORT FILE'}</button>
          </>
        }
        meta={<div className="page-meta"><span>{assets.length} plates</span><span>{campaigns.length} campaigns</span><span>{exports.length} exports</span><span>{usage.exports} files made</span></div>}
      />

      <div className="export-layout">
        <aside className="export-controls">
          <div className="export-block">
            <div className="block-label"><span>01 / SOURCE PLATE</span><span className="mono-xs muted">{imageAssets.length} AVAILABLE</span></div>
            <div className="field">
              <label>PLATE</label>
              <select className="select" value={asset?.id ?? ''} onChange={(e) => setAssetId(e.target.value)}>
                {imageAssets.map((a) => <option key={a.id} value={a.id}>{a.title} — {a.source}</option>)}
              </select>
            </div>
            {asset && (
              <div className="export-source">
                <img src={asset.src} alt={asset.title} />
                <div>
                  <strong>{asset.title}</strong>
                  <span>{asset.width ?? '—'} × {asset.height ?? '—'} · {asset.collection ?? asset.source}</span>
                  <Swatches palette={asset.palette ?? ['#ddd3c2', '#9b5a3c', '#3b3936', '#efe8d8', '#171512']} size={12} />
                </div>
              </div>
            )}
          </div>

          <div className="export-block">
            <div className="block-label">02 / FILE</div>
            <div className="seg export-format">
              {(['png', 'jpeg', 'webp'] as ExportFormat[]).map((f) => (
                <button key={f} className={config.format === f ? 'active' : ''} onClick={() => patch({ format: f })}>{f.toUpperCase()}</button>
              ))}
            </div>
            <div className="field">
              <label>LONG EDGE</label>
              <div className="seg export-sizes">
                {[1080, 1600, 2048, 3000].map((n) => (
                  <button key={n} className={config.longEdge === n ? 'active' : ''} onClick={() => patch({ longEdge: n })}>{n}</button>
                ))}
              </div>
            </div>
            <Slider label="Long edge" value={config.longEdge} min={640} max={4000} step={80} onChange={(v) => patch({ longEdge: v })} format={(v) => `${v} px`} low="social" high="print" />
            <Slider label="Quality" value={Math.round(config.quality * 100)} min={40} max={100} onChange={(v) => patch({ quality: v / 100 })} low="small file" high="max" />
            <div className={`export-quality-note ${config.format === 'png' ? 'muted' : ''}`}>
              {config.format === 'png' ? 'PNG is lossless; the quality slider only applies to JPEG and WebP.' : `Quality ${Math.round(config.quality * 100)}% · ${config.format.toUpperCase()} compression.`}
            </div>
          </div>

          <div className="export-block">
            <div className="block-label">03 / PAPER & FRAME</div>
            <Slider label="Matte / border" value={config.border} min={0} max={24} onChange={(v) => patch({ border: v })} format={(v) => `${v}%`} low="full bleed" high="wide matte" />
            <div className="seg export-fit">
              <button className={config.fit === 'cover' ? 'active' : ''} onClick={() => patch({ fit: 'cover' })}>CROP / COVER</button>
              <button className={config.fit === 'contain' ? 'active' : ''} onClick={() => patch({ fit: 'contain' })}>FIT / CONTAIN</button>
            </div>
            <div className="colour-row">
              <label>MATTE<input type="color" value={config.matte} onChange={(e) => patch({ matte: e.target.value })} /></label>
            </div>
            <div className="export-swatch-row">
              {['#efe8d8', '#f8f4ea', '#171512', '#0d0d0c', '#9b5e63', '#75647d'].map((c) => (
                <button key={c} className={`export-swatch ${config.matte === c ? 'active' : ''}`} style={{ background: c }} onClick={() => patch({ matte: c })} title={c} />
              ))}
            </div>
          </div>

          <div className="export-block">
            <div className="block-label">04 / BUNDLE</div>
            <div className="field">
              <label>SCOPE</label>
              <select className="select" value={bundleScope} onChange={(e) => setBundleScope(e.target.value)}>
                <option value="__all__">The whole archive</option>
                <option value="__studio__">Studio output only</option>
                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.title} — {c.assets.filter((a) => a.assetId).length} plates</option>)}
              </select>
            </div>
            <div className="seg export-bundle-mode">
              <button className={bundleMode === 'original' ? 'active' : ''} onClick={() => setBundleMode('original')}>ORIGINAL FILES</button>
              <button className={bundleMode === 'jpeg' ? 'active' : ''} onClick={() => setBundleMode('jpeg')}>NORMALISED JPEG</button>
            </div>
            <div className="export-bundle-list">
              {bundleAssets.slice(0, 8).map((a) => (
                <div key={a.id} className="export-bundle-item">
                  <img src={a.src} alt="" />
                  <span>{a.title}</span>
                  <em>{a.source}</em>
                </div>
              ))}
              {bundleAssets.length > 8 && <div className="export-bundle-more">+ {bundleAssets.length - 8} more plates</div>}
              {!bundleAssets.length && <div className="export-bundle-more">No plates in this scope.</div>}
            </div>
            <button className="btn btn--ghost btn--sm btn--wide" onClick={exportBundle} disabled={working || !bundleAssets.length}>
              <FolderArchive size={11} /> ZIP {bundleAssets.length} PLATES
            </button>
          </div>

          <div className="export-block export-block--last">
            <button className="btn btn--accent btn--wide" onClick={exportOne} disabled={working}><Download size={12} /> EXPORT THIS PLATE</button>
            <p className="desk-note">Browser exports are sRGB. There is no embedded CMYK profile, no PDF and no ICC-managed press proof. The file is exactly what the canvas produced.</p>
          </div>
        </aside>

        <section className="export-stage">
          <div className="export-stage-bar">
            <div>
              <span className="mono-xs accent">{config.format.toUpperCase()} / {config.longEdge} PX</span>
              <span className="mono-xs muted" style={{ marginLeft: 14 }}>{asset?.title ?? 'NO PLATE'} · {config.fit.toUpperCase()}</span>
            </div>
            <div className="stage-tools">
              <span className="mono-xs muted">{size.width || '—'} × {size.height || '—'} PX</span>
              <button className="icon-btn tooltip" data-tip="Reset output" onClick={() => setConfig(DEFAULT_CONFIG)}><RefreshCw size={12} /></button>
            </div>
          </div>
          <div className={`export-canvas-wrap ${config.border > 0 ? 'has-matte' : ''}`}>
            <canvas ref={previewRef} className="export-canvas" />
            {!asset && <div className="export-canvas-note">Choose a plate to export.</div>}
          </div>
          <div className="export-stage-foot">
            <div><span className="mono-xs">FORMAT</span><strong>{config.format.toUpperCase()}</strong></div>
            <div><span className="mono-xs">LONG EDGE</span><strong>{config.longEdge} px</strong></div>
            <div><span className="mono-xs">QUALITY</span><strong>{config.format === 'png' ? 'LOSSLESS' : `${Math.round(config.quality * 100)}%`}</strong></div>
            <div><span className="mono-xs">MATTE</span><strong>{config.border}%</strong></div>
            <div><span className="mono-xs">FIT</span><strong>{config.fit.toUpperCase()}</strong></div>
          </div>
        </section>
      </div>

      <section className="section">
        <SectionHead index="15" title="Export history" link={<span className="mono-xs muted">THIS BROWSER / LAST 60</span>} />
        {exports.length ? (
          <div className="export-history">
            <div className="export-history-head">
              <span className="mono-xs">FILE</span>
              <span className="mono-xs">FORMAT</span>
              <span className="mono-xs">SIZE</span>
              <span className="mono-xs">MADE</span>
              <span className="mono-xs">SOURCE</span>
              <span />
            </div>
            {exports.map((r) => {
              const source = assets.find((a) => a.id === r.assetId)
              return (
                <div key={r.id} className="export-history-row">
                  <span className="export-history-name">{r.name}</span>
                  <span className="chip">{r.format}</span>
                  <span className="mono-xs muted">{r.width && r.height ? `${r.width} × ${r.height}` : 'BUNDLE'}</span>
                  <span className="mono-xs muted">{new Date(r.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}</span>
                  <span className="mono-xs">{source ? <><Check size={9} /> {source.title}</> : <><AlertTriangle size={9} /> NO SOURCE</>}</span>
                  <button className="mini-link" disabled={!source} onClick={() => reExport(r)}>RE-EXPORT <Download size={10} /></button>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="empty">
            <FileImage size={18} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
            <h3>No exports yet.</h3>
            <p>Export a plate or a bundle. Every file you make is recorded here with a real source where one exists.</p>
          </div>
        )}
      </section>

      <section className="section">
        <SectionHead index="16" title="Output rules" />
        <div className="export-rules">
          {[
            { n: '01', t: 'Long edge, not guesswork.', d: '1080 for the screen, 1600 for editorial, 2048 for a contact sheet, 3000 for a small print. The source is never cropped unless you choose crop.' },
            { n: '02', t: 'A matte is a frame.', d: 'Anything above zero reduces the image and fills the remaining area with the matte colour. It is a real border in the file, not a CSS effect.' },
            { n: '03', t: 'Original files keep their truth.', d: 'Bundle originals to preserve the generated webp or uploaded file. Normalised JPEG gives every plate the same long edge and compression.' },
            { n: '04', t: 'No fake print promise.', d: 'These are sRGB browser exports. A real press file needs a CMYK conversion, an ICC profile and a proof — none of which this studio invents.' },
          ].map((r) => (
            <div key={r.n} className="export-rule">
              <span className="mono-xs accent">{r.n}</span>
              <h3>{r.t}</h3>
              <p>{r.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="export-foot-strip">
          <Package size={16} />
          <span>{assets.length} PLATES · {campaigns.reduce((n, c) => n + c.assets.filter((a) => a.assetId).length, 0)} CAMPAIGN FRAMES · {exports.length} EXPORTS RECORDED</span>
          <span className="mono-xs muted">STORAGE: BROWSER / LOCAL</span>
          <button className="mini-link" onClick={exportOne} disabled={!asset}><Box size={10} /> EXPORT AGAIN</button>
        </div>
      </section>
    </div>
  )
}
