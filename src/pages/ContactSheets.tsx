import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Download, Star, Check, X, LayoutGrid, Film, Image as ImageIcon, Save,
  CircleDot, SlidersHorizontal, Sparkles,
} from 'lucide-react'
import { PageHeader, Slider, ImagePlate, SectionHead } from '../components/UI'
import { useApp, uid } from '../lib/store'
import { drawImageCover } from '../lib/imaging'
import { canvasToBlob, downloadBlob, loadImage, saveAssetBlob } from '../lib/imageStore'
import type { Asset } from '../lib/types'

interface SheetConfig {
  columns: number
  theme: 'paper' | 'film'
  margin: number
  gap: number
  captions: boolean
  indexes: boolean
  monochrome: boolean
  grain: number
  title: string
  subtitle: string
  accent: string
}

const DEFAULT_CONFIG: SheetConfig = {
  columns: 4,
  theme: 'paper',
  margin: 64,
  gap: 18,
  captions: true,
  indexes: true,
  monochrome: false,
  grain: 12,
  title: 'CONTACT SHEET',
  subtitle: 'AFTER THE RAIN / SELECTS',
  accent: '#9b5e63',
}

function clampInt(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(v)))
}

function drawGrain(ctx: CanvasRenderingContext2D, width: number, height: number, amount: number) {
  if (amount <= 0) return
  const tile = document.createElement('canvas')
  tile.width = 160
  tile.height = 160
  const tctx = tile.getContext('2d')!
  const data = tctx.createImageData(160, 160)
  for (let i = 0; i < data.data.length; i += 4) {
    const v = Math.random() * 255
    data.data[i] = v
    data.data[i + 1] = v
    data.data[i + 2] = v
    data.data[i + 3] = 255
  }
  tctx.putImageData(data, 0, 0)
  const pattern = ctx.createPattern(tile, 'repeat')
  if (!pattern) return
  ctx.save()
  ctx.globalAlpha = (amount / 100) * 0.09
  ctx.globalCompositeOperation = 'overlay'
  ctx.fillStyle = pattern
  ctx.fillRect(0, 0, width, height)
  ctx.restore()
}

async function renderSheet(
  config: SheetConfig,
  items: Asset[],
  selects: Set<string>,
  cache: Map<string, HTMLImageElement>,
): Promise<HTMLCanvasElement> {
  const W = 1600
  const margin = config.margin
  const header = 168
  const footer = 86
  const cols = clampInt(config.columns, 2, 6)
  const rows = Math.max(1, Math.ceil(items.length / cols))
  const gap = config.gap
  const cellW = (W - margin * 2 - gap * (cols - 1)) / cols
  const cellH = cellW * 4 / 3
  const captionH = config.captions || config.indexes ? 38 : 10
  const H = header + rows * (cellH + captionH) + (rows - 1) * gap + footer
  const paper = config.theme === 'paper'
  const bg = paper ? '#efe9dc' : '#0d0d0c'
  const ink = paper ? '#171512' : '#ece5d7'
  const soft = paper ? 'rgba(23,21,18,0.58)' : 'rgba(236,229,215,0.58)'
  const line = paper ? 'rgba(23,21,18,0.28)' : 'rgba(236,229,215,0.24)'

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  ctx.textBaseline = 'top'

  // masthead
  ctx.fillStyle = ink
  ctx.font = `500 46px 'Anton', Impact, sans-serif`
  ctx.fillText(config.title.toUpperCase(), margin, 44)
  ctx.textAlign = 'right'
  ctx.font = `11px 'IBM Plex Mono', monospace`
  ctx.fillStyle = soft
  ctx.fillText('CAMPAIGN 04 / CONTACT / 001', W - margin, 52)
  ctx.fillText(`${items.length} FRAMES · ${selects.size} SELECTS`, W - margin, 70)
  ctx.textAlign = 'left'
  ctx.font = `12px 'IBM Plex Mono', monospace`
  ctx.fillStyle = soft
  ctx.fillText(config.subtitle.toUpperCase(), margin, 104)
  ctx.strokeStyle = line
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(margin, 136)
  ctx.lineTo(W - margin, 136)
  ctx.stroke()

  if (!items.length) {
    ctx.textAlign = 'center'
    ctx.fillStyle = soft
    ctx.font = `italic 28px 'Cormorant Garamond', Georgia, serif`
    ctx.fillText('No plates selected for this sheet.', W / 2, H / 2 - 20)
    ctx.font = `11px 'IBM Plex Mono', monospace`
    ctx.fillText('CHOOSE FROM THE ARCHIVE RAIL TO BEGIN', W / 2, H / 2 + 30)
    ctx.textAlign = 'left'
    return canvas
  }

  for (let i = 0; i < items.length; i++) {
    const asset = items[i]
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = margin + col * (cellW + gap)
    const y = header + row * (cellH + captionH + gap)
    ctx.save()
    if (config.monochrome) ctx.filter = 'grayscale(1) contrast(1.08)'
    let img = cache.get(asset.src)
    if (!img) {
      try {
        img = await loadImage(asset.src)
        cache.set(asset.src, img)
      } catch {
        img = undefined
      }
    }
    if (img) {
      drawImageCover(ctx, img, x, y, cellW, cellH, 0.5, 0.42)
    } else {
      ctx.fillStyle = paper ? '#ded5c5' : '#1b1815'
      ctx.fillRect(x, y, cellW, cellH)
      ctx.fillStyle = soft
      ctx.font = `10px 'IBM Plex Mono', monospace`
      ctx.fillText('IMAGE UNAVAILABLE', x + 12, y + 14)
    }
    ctx.restore()
    ctx.strokeStyle = line
    ctx.strokeRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1)

    const selected = selects.has(asset.id)
    if (selected) {
      ctx.save()
      ctx.strokeStyle = config.accent
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.ellipse(x + cellW / 2, y + cellH / 2, cellW * 0.44, cellH * 0.43, -0.035, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = config.accent
      ctx.beginPath()
      ctx.arc(x + cellW - 18, y + 18, 11, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = bg
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x + cellW - 24, y + 18)
      ctx.lineTo(x + cellW - 20, y + 22)
      ctx.lineTo(x + cellW - 12, y + 13)
      ctx.stroke()
      ctx.restore()
    }

    if (config.indexes || config.captions) {
      ctx.fillStyle = selected ? config.accent : soft
      ctx.font = `10px 'IBM Plex Mono', monospace`
      const index = String(i + 1).padStart(2, '0')
      if (config.indexes) ctx.fillText(index, x, y + cellH + 9)
      if (config.captions) {
        ctx.fillStyle = ink
        ctx.font = `10px 'IBM Plex Mono', monospace`
        const maxWidth = cellW - (config.indexes ? 34 : 0)
        let caption = asset.title.toUpperCase()
        while (ctx.measureText(caption).width > maxWidth && caption.length > 8) {
          caption = caption.slice(0, -2)
        }
        ctx.fillText(caption, x + (config.indexes ? 30 : 0), y + cellH + 9)
        ctx.fillStyle = soft
        ctx.font = `8px 'IBM Plex Mono', monospace`
        const meta = `${asset.collection ?? asset.source} · ${asset.analysis?.era ?? 'archive'}`
        let metaText = meta.toUpperCase()
        while (ctx.measureText(metaText).width > maxWidth && metaText.length > 8) metaText = metaText.slice(0, -2)
        ctx.fillText(metaText, x + (config.indexes ? 30 : 0), y + cellH + 23)
      }
    }
  }

  // footer
  const footerY = H - footer + 24
  ctx.strokeStyle = line
  ctx.beginPath()
  ctx.moveTo(margin, footerY - 16)
  ctx.lineTo(W - margin, footerY - 16)
  ctx.stroke()
  ctx.fillStyle = soft
  ctx.font = `9px 'IBM Plex Mono', monospace`
  ctx.fillText('CAMPAIGN 04 / INDEPENDENT IMAGE-MAKING STUDIO', margin, footerY)
  ctx.textAlign = 'right'
  ctx.fillText(`${cols} × ${rows} CONTACT GRID · ${W} PX`, W - margin, footerY)
  ctx.textAlign = 'left'

  drawGrain(ctx, W, H, config.grain)
  return canvas
}

export function ContactSheets() {
  const assets = useApp((s) => s.assets)
  const campaigns = useApp((s) => s.campaigns)
  const addAsset = useApp((s) => s.addAsset)
  const addExport = useApp((s) => s.addExport)
  const toast = useApp((s) => s.toast)
  const setUsage = useApp((s) => s.setUsage)
  const usage = useApp((s) => s.usage)

  const initialIds = useMemo(() => {
    const first = campaigns[0]?.assets.map((a) => a.assetId).filter(Boolean) as string[] | undefined
    return (first?.length ? first : assets.slice(0, 8).map((a) => a.id)).slice(0, 12)
  }, [assets, campaigns])

  const [selectedIds, setSelectedIds] = useState<string[]>(initialIds)
  const [selects, setSelects] = useState<Set<string>>(() => new Set(assets.filter((a) => a.favorite).map((a) => a.id)))
  const [config, setConfig] = useState<SheetConfig>(DEFAULT_CONFIG)
  const [filter, setFilter] = useState('all')
  const [size, setSize] = useState({ width: 1600, height: 0 })
  const [working, setWorking] = useState(false)
  const previewRef = useRef<HTMLCanvasElement>(null)
  const cache = useRef(new Map<string, HTMLImageElement>())

  const visibleAssets = useMemo(() => {
    if (filter === 'all') return assets
    const campaign = campaigns.find((c) => c.id === filter)
    if (!campaign) return assets
    const ids = new Set(campaign.assets.map((a) => a.assetId).filter(Boolean))
    return assets.filter((a) => ids.has(a.id))
  }, [assets, campaigns, filter])

  const selectedAssets = useMemo(
    () => selectedIds.map((id) => assets.find((a) => a.id === id)).filter(Boolean) as Asset[],
    [selectedIds, assets],
  )

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const rendered = await renderSheet(config, selectedAssets, selects, cache.current)
        if (cancelled) return
        const canvas = previewRef.current
        if (!canvas) return
        canvas.width = rendered.width
        canvas.height = rendered.height
        const ctx = canvas.getContext('2d')!
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(rendered, 0, 0)
        setSize({ width: rendered.width, height: rendered.height })
      } catch {
        /* an image may be unavailable */
      }
    }, 160)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [config, selectedAssets, selects])

  const patch = (p: Partial<SheetConfig>) => setConfig((c) => ({ ...c, ...p }))

  const togglePlate = (id: string) => {
    setSelectedIds((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id])
  }

  const toggleSelect = (id: string) => {
    setSelects((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectCampaign = () => {
    const campaign = campaigns.find((c) => c.id === filter)
    const ids = campaign?.assets.map((a) => a.assetId).filter(Boolean) as string[] | undefined
    if (!ids?.length) {
      toast('No plates in this campaign', 'Develop or attach images first.', 'error')
      return
    }
    setSelectedIds(ids)
    toast('Campaign plates loaded', `${ids.length} frames on the sheet.`, 'success')
  }

  const exportSheet = async (save = false) => {
    if (!selectedAssets.length) {
      toast('Nothing on the sheet', 'Choose at least one plate.', 'error')
      return
    }
    setWorking(true)
    try {
      const rendered = await renderSheet(config, selectedAssets, selects, cache.current)
      const blob = await canvasToBlob(rendered, 'image/png')
      const base = `${config.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${config.theme}-${selectedAssets.length}`
      if (save) {
        const saved = await saveAssetBlob(blob, {
          id: uid('sheet'),
          title: `${config.title} / ${selectedAssets.length} frames`,
          kind: 'layout',
          source: 'layout',
          createdAt: Date.now(),
          width: rendered.width,
          height: rendered.height,
          collection: 'Contact sheets',
          tags: ['contact sheet', config.theme, `${config.columns} columns`],
          caption: config.subtitle.toUpperCase(),
          palette: [config.theme === 'paper' ? '#efe9dc' : '#0d0d0c', '#171512', config.accent],
          meta: { plates: selectedAssets.length, selects: selects.size, columns: config.columns },
        })
        addAsset(saved)
        addExport({ id: uid('exp'), name: saved.title, format: 'PNG', width: rendered.width, height: rendered.height, createdAt: Date.now(), assetId: saved.id })
        toast('Sheet saved', 'The contact sheet is in the archive as a plate.', 'success')
      } else {
        downloadBlob(blob, `${base}.png`)
        addExport({ id: uid('exp'), name: `${base}.png`, format: 'PNG', width: rendered.width, height: rendered.height, createdAt: Date.now() })
        toast('Contact sheet exported', 'A full-resolution PNG is on your desktop.', 'success')
      }
      setUsage({ exports: usage.exports + 1 })
    } catch (err) {
      toast('Export failed', err instanceof Error ? err.message : 'The sheet could not be rendered.', 'error')
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="page contact-page">
      <PageHeader
        index="12"
        kicker="VARIATIONS / CONTACT SHEETS"
        title={<>CONTACT <span className="ital">SHEETS</span></>}
        description="A working sheet, not a mood board. Choose the roll, set the grid, mark the selects in chinagraph and export a real PNG. Every frame is drawn from the archive at full resolution."
        actions={
          <>
            <button className="btn btn--ghost" onClick={() => { setSelectedIds([]); setSelects(new Set()) }}><X size={12} /> CLEAR SHEET</button>
            <button className="btn btn--ghost" onClick={() => exportSheet(true)} disabled={working}><Save size={12} /> SAVE SHEET</button>
            <button className="btn btn--solid" onClick={() => exportSheet(false)} disabled={working}><Download size={12} /> {working ? 'PRINTING…' : 'EXPORT PNG'}</button>
          </>
        }
        meta={<div className="page-meta"><span>{selectedAssets.length} frames</span><span>{selects.size} selects</span><span>{config.columns} columns</span><span>{size.width} × {size.height || '—'} px</span></div>}
      />

      <div className="contact-layout">
        <aside className="contact-controls">
          <div className="contact-block">
            <div className="block-label"><span>01 / THE ROLL</span><span className="mono-xs muted">{visibleAssets.length} PLATES</span></div>
            <div className="field">
              <label>SOURCE</label>
              <select className="select" value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="all">The whole archive</option>
                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.title} — {c.assets.filter((a) => a.assetId).length} plates</option>)}
              </select>
            </div>
            <div className="contact-bulk">
              <button className="mini-link" onClick={() => setSelectedIds(visibleAssets.map((a) => a.id))}>SELECT ALL</button>
              <button className="mini-link" onClick={() => setSelectedIds([])}>CLEAR</button>
              <button className="mini-link" onClick={selectCampaign}>USE CAMPAIGN PLATES</button>
            </div>
            <div className="contact-picker">
              {visibleAssets.map((a) => {
                const on = selectedIds.includes(a.id)
                const isSelect = selects.has(a.id)
                return (
                  <div key={a.id} className={`contact-pick ${on ? 'active' : ''}`}>
                    <button className="contact-pick-image" onClick={() => togglePlate(a.id)} title={a.title}>
                      <img src={a.src} alt={a.title} />
                      <span className="contact-check">{on ? <Check size={10} /> : null}</span>
                      {isSelect && <span className="contact-select-dot" />}
                    </button>
                    <span className="contact-pick-title">{a.title}</span>
                    <button
                      className={`contact-star ${isSelect ? 'active' : ''}`}
                      title={isSelect ? 'Remove select' : 'Mark as select'}
                      onClick={() => toggleSelect(a.id)}
                    >
                      <Star size={10} fill={isSelect ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                )
              })}
            </div>
            <p className="mini-note">Click a frame to place it on the sheet. The star marks a select with chinagraph in the render.</p>
          </div>

          <div className="contact-block">
            <div className="block-label">02 / SHEET SETTINGS</div>
            <div className="field">
              <label>GRID</label>
              <div className="seg" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)' }}>
                {[2, 3, 4, 5, 6].map((n) => (
                  <button key={n} className={config.columns === n ? 'active' : ''} onClick={() => patch({ columns: n })}>{n}</button>
                ))}
              </div>
            </div>
            <div className="seg contact-theme">
              <button className={config.theme === 'paper' ? 'active' : ''} onClick={() => patch({ theme: 'paper' })}><LayoutGrid size={11} /> PAPER</button>
              <button className={config.theme === 'film' ? 'active' : ''} onClick={() => patch({ theme: 'film' })}><Film size={11} /> FILM</button>
            </div>
            <Slider label="Margin" value={config.margin} min={24} max={130} onChange={(v) => patch({ margin: v })} low="tight" high="wide" />
            <Slider label="Gap" value={config.gap} min={2} max={48} onChange={(v) => patch({ gap: v })} low="touching" high="air" />
            <Slider label="Grain" value={config.grain} min={0} max={80} onChange={(v) => patch({ grain: v })} low="clean" high="photocopy" />
            <div className="contact-toggles">
              <label className="check"><input type="checkbox" checked={config.captions} onChange={(e) => patch({ captions: e.target.checked })} /> CAPTIONS</label>
              <label className="check"><input type="checkbox" checked={config.indexes} onChange={(e) => patch({ indexes: e.target.checked })} /> FRAME NUMBERS</label>
              <label className="check"><input type="checkbox" checked={config.monochrome} onChange={(e) => patch({ monochrome: e.target.checked })} /> MONOCHROME PLATES</label>
            </div>
            <div className="colour-row">
              <label>CHINAGRAPH<input type="color" value={config.accent} onChange={(e) => patch({ accent: e.target.value })} /></label>
            </div>
          </div>

          <div className="contact-block">
            <div className="block-label">03 / MASTHEAD</div>
            <div className="field"><label>TITLE</label><input className="input" value={config.title} onChange={(e) => patch({ title: e.target.value })} /></div>
            <div className="field"><label>SUBTITLE</label><input className="input" value={config.subtitle} onChange={(e) => patch({ subtitle: e.target.value })} /></div>
            <div className="contact-note">
              <CircleDot size={12} />
              <p>Selects are drawn in chinagraph. They are a decision, not a filter. Save the sheet to the archive when it is marked up.</p>
            </div>
          </div>

          <div className="contact-block contact-block--last">
            <button className="btn btn--accent btn--wide" onClick={() => exportSheet(false)} disabled={working}><Download size={12} /> EXPORT CONTACT SHEET</button>
            <button className="btn btn--ghost btn--sm btn--wide" onClick={() => exportSheet(true)} disabled={working}><Save size={11} /> SAVE TO ARCHIVE</button>
          </div>
        </aside>

        <section className="contact-stage">
          <div className="contact-stage-bar">
            <div>
              <span className="mono-xs accent">{config.title.toUpperCase()}</span>
              <span className="mono-xs muted" style={{ marginLeft: 14 }}>{config.theme.toUpperCase()} SHEET / {selectedAssets.length} FRAMES / {selects.size} SELECTS</span>
            </div>
            <div className="stage-tools">
              <span className="mono-xs muted">{size.width} × {size.height || '—'}</span>
              <button className="icon-btn tooltip" data-tip="Clear selects" onClick={() => setSelects(new Set())}><CircleDot size={12} /></button>
              <button className="icon-btn tooltip" data-tip="Select favourites" onClick={() => setSelects(new Set(assets.filter((a) => a.favorite).map((a) => a.id)))}><Star size={12} /></button>
            </div>
          </div>
          <div className="contact-canvas-wrap">
            <canvas ref={previewRef} className="contact-canvas" />
            {!selectedAssets.length && <div className="contact-canvas-note">Choose plates from the archive rail to begin.</div>}
          </div>
          <div className="contact-stage-foot">
            <div><span className="mono-xs">GRID</span><strong>{config.columns} × {Math.max(1, Math.ceil(selectedAssets.length / config.columns))}</strong></div>
            <div><span className="mono-xs">PAPER</span><strong>{config.theme.toUpperCase()}</strong></div>
            <div><span className="mono-xs">GRAIN</span><strong>{config.grain}%</strong></div>
            <div><span className="mono-xs">MARKS</span><strong>{selects.size}</strong></div>
            <div><span className="mono-xs">FRAMES</span><strong>{selectedAssets.length}</strong></div>
          </div>
        </section>
      </div>

      <section className="section">
        <SectionHead index="13" title="The selects" link={<span className="mono-xs muted">WHAT SURVIVES THE EDIT</span>} />
        {selects.size ? (
          <div className="contact-selects">
            {[...selects].map((id, i) => {
              const a = assets.find((x) => x.id === id)
              if (!a) return null
              return (
                <div key={id} className="contact-select-card">
                  <ImagePlate src={a.src} alt={a.title} ratio="3 / 4" caption={`SELECT ${String(i + 1).padStart(2, '0')}`} />
                  <div className="contact-select-meta">
                    <strong>{a.title}</strong>
                    <span>{a.collection ?? a.source}</span>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="empty">
            <Star size={18} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
            <h3>No selects yet.</h3>
            <p>Mark the frames that survive the edit. The sheet can hold many images; the selects are the argument.</p>
          </div>
        )}
      </section>
    </div>
  )
}
