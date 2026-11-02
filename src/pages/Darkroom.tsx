import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import {
  Aperture, RotateCcw, RotateCw, FlipHorizontal2, Download, Save, Plus, Trash2,
  Eye, EyeOff, Type, Square, Undo2, Redo2, X, ChevronDown, Image as ImageIcon,
  SlidersHorizontal, Layers, Crop, Palette, Sparkles,
} from 'lucide-react'
import { PageHeader, Slider, CopyButton } from '../components/UI'
import { useApp, uid } from '../lib/store'
import { FILM_PRESETS, FONT_LIBRARY } from '../lib/presets'
import {
  DEFAULT_ADJUSTMENTS, DEFAULT_CROP, DEFAULT_DARKROOM, renderDarkroom,
  type Adjustments, type CropState, type DarkroomCanvas, type DarkroomLayerBox, type DarkroomState, type TextLayer,
} from '../lib/imaging'
import { loadImage, canvasToBlob, downloadBlob, saveAssetBlob } from '../lib/imageStore'

const ADJUSTMENT_GROUPS: {
  id: string
  label: string
  icon: ReactNode
  items: { key: keyof Adjustments; label: string; min: number; max: number; low?: string; high?: string }[]
}[] = [
  {
    id: 'light',
    label: 'LIGHT',
    icon: <Aperture size={11} />,
    items: [
      { key: 'exposure', label: 'Exposure', min: -50, max: 50, low: 'darker', high: 'brighter' },
      { key: 'contrast', label: 'Contrast', min: -50, max: 50, low: 'flat', high: 'hard' },
      { key: 'highlights', label: 'Highlights', min: -60, max: 40, low: 'recover', high: 'blow out' },
      { key: 'shadows', label: 'Shadows', min: -40, max: 60, low: 'crush', high: 'lift' },
      { key: 'flash', label: 'Flash', min: 0, max: 100, low: 'ambient', high: 'direct flash' },
    ],
  },
  {
    id: 'colour',
    label: 'COLOUR',
    icon: <Palette size={11} />,
    items: [
      { key: 'temperature', label: 'Temperature', min: -50, max: 50, low: 'cool', high: 'warm' },
      { key: 'tint', label: 'Tint', min: -50, max: 50, low: 'green', high: 'magenta' },
      { key: 'saturation', label: 'Saturation', min: -100, max: 60, low: 'mono', high: 'saturated' },
      { key: 'fade', label: 'Fade / matte', min: 0, max: 100, low: 'deep', high: 'faded' },
    ],
  },
  {
    id: 'texture',
    label: 'TEXTURE',
    icon: <Sparkles size={11} />,
    items: [
      { key: 'grain', label: 'Grain', min: 0, max: 100, low: 'clean', high: 'heavy' },
      { key: 'blur', label: 'Softness', min: 0, max: 12, low: 'sharp', high: 'soft' },
      { key: 'vignette', label: 'Vignette', min: 0, max: 100, low: 'none', high: 'heavy' },
      { key: 'halation', label: 'Halation', min: 0, max: 100, low: 'none', high: 'glow' },
      { key: 'aberration', label: 'Aberration', min: 0, max: 100, low: 'clean', high: 'split' },
      { key: 'dust', label: 'Dust', min: 0, max: 100, low: 'none', high: 'archival' },
      { key: 'scratches', label: 'Scratches', min: 0, max: 100, low: 'none', high: 'damaged' },
      { key: 'leak', label: 'Light leak', min: 0, max: 100, low: 'sealed', high: 'burned' },
    ],
  },
]

const BLENDS: GlobalCompositeOperation[] = ['source-over', 'multiply', 'screen', 'overlay', 'soft-light', 'difference', 'color-burn', 'lighten', 'darken']

export function Darkroom() {
  const assets = useApp((s) => s.assets)
  const focusAssetId = useApp((s) => s.focusAssetId)
  const setFocusAsset = useApp((s) => s.setFocusAsset)
  const navigate = useApp((s) => s.navigate)
  const toast = useApp((s) => s.toast)
  const addAsset = useApp((s) => s.addAsset)
  const addExport = useApp((s) => s.addExport)
  const addToStudioHistory = useApp((s) => s.addToStudioHistory)

  const initial = focusAssetId ?? useApp.getState().studio.history[0] ?? assets[0]?.id
  const [assetId, setAssetId] = useState(initial)
  const asset = assets.find((a) => a.id === assetId) ?? assets[0]
  const [draft, setDraft] = useState<DarkroomState>(() => ({ ...DEFAULT_DARKROOM, adjustments: { ...DEFAULT_ADJUSTMENTS }, crop: { ...DEFAULT_CROP }, layers: [] }))
  const [past, setPast] = useState<DarkroomState[]>([])
  const [future, setFuture] = useState<DarkroomState[]>([])
  const [tab, setTab] = useState('light')
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null)
  const [showSafe, setShowSafe] = useState(false)
  const [compare, setCompare] = useState(false)
  const [working, setWorking] = useState(false)
  const [imageReady, setImageReady] = useState(false)
  const [layerBoxes, setLayerBoxes] = useState<Record<string, DarkroomLayerBox>>({})
  const [canvasBox, setCanvasBox] = useState({ left: 0, top: 0, width: 0, height: 0 })
  const [showLayerTools, setShowLayerTools] = useState(false)
  const previewRef = useRef<HTMLCanvasElement>(null)
  const canvasWrapRef = useRef<HTMLDivElement>(null)
  const layerTextRef = useRef<HTMLTextAreaElement>(null)
  const originalImgRef = useRef<HTMLImageElement | null>(null)
  const lastPush = useRef(0)

  const imageAssets = useMemo(() => assets.filter((a) => a.source !== 'layout' || a.src), [assets])

  useEffect(() => {
    let alive = true
    setImageReady(false)
    if (!asset) return
    loadImage(asset.src)
      .then((img) => {
        if (!alive) return
        originalImgRef.current = img
        setImageReady(true)
      })
      .catch(() => toast('Could not open this plate', 'The image file is unavailable.', 'error'))
    return () => { alive = false }
  }, [asset?.id, asset?.src, toast])

  const draw = () => {
    const img = originalImgRef.current
    const canvas = previewRef.current
    if (!img || !canvas) return
    const rendered = renderDarkroom(img, draft, { maxWidth: 900, showSafeArea: showSafe })
    canvas.width = rendered.width
    canvas.height = rendered.height
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(rendered, 0, 0)
    setLayerBoxes((rendered as DarkroomCanvas).layerBoxes ?? {})
  }

  useEffect(() => {
    if (imageReady) draw()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageReady, draft, showSafe, assetId])

  useEffect(() => {
    const canvas = previewRef.current
    const wrap = canvasWrapRef.current
    if (!canvas || !wrap) return
    const measure = () => {
      const canvasRect = canvas.getBoundingClientRect()
      const wrapRect = wrap.getBoundingClientRect()
      const next = {
        left: canvasRect.left - wrapRect.left,
        top: canvasRect.top - wrapRect.top,
        width: canvasRect.width,
        height: canvasRect.height,
      }
      setCanvasBox((prev) =>
        prev.left === next.left && prev.top === next.top && prev.width === next.width && prev.height === next.height
          ? prev
          : next,
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(canvas)
    observer.observe(wrap)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [imageReady, assetId])

  const apply = (next: DarkroomState) => {
    const now = Date.now()
    if (now - lastPush.current > 480) {
      setPast((p) => [...p.slice(-24), draft])
      setFuture([])
      lastPush.current = now
    }
    setDraft(next)
  }

  const setAdjustment = (key: keyof Adjustments, value: number) => {
    apply({ ...draft, adjustments: { ...draft.adjustments, [key]: value } })
  }

  const setCrop = (patch: Partial<CropState>) => {
    apply({ ...draft, crop: { ...draft.crop, ...patch } })
  }

  const applyFilm = (film: typeof FILM_PRESETS[number]) => {
    apply({ ...draft, adjustments: { ...DEFAULT_ADJUSTMENTS, ...film.values } as Adjustments })
    toast('Film treatment applied', film.name, 'success')
  }

  const reset = () => {
    apply({ ...DEFAULT_DARKROOM, adjustments: { ...DEFAULT_ADJUSTMENTS }, crop: { ...DEFAULT_CROP }, layers: [] })
    setSelectedLayer(null)
  }

  const undo = () => {
    const prev = past[past.length - 1]
    if (!prev) return
    setFuture((f) => [draft, ...f].slice(0, 24))
    setPast((p) => p.slice(0, -1))
    setDraft(prev)
    lastPush.current = 0
  }

  const redo = () => {
    const next = future[0]
    if (!next) return
    setPast((p) => [...p, draft].slice(-24))
    setFuture((f) => f.slice(1))
    setDraft(next)
    lastPush.current = 0
  }

  const addLayer = (type: 'text' | 'shape') => {
    const layer: TextLayer = {
      id: uid('layer'),
      type,
      text: type === 'shape' ? '' : 'AFTER THE RAIN',
      x: 50,
      y: type === 'shape' ? 86 : 78,
      size: type === 'shape' ? 2 : 6,
      font: "'IBM Plex Mono', monospace",
      color: '#f4efe4',
      opacity: 1,
      blend: 'source-over',
      rotation: 0,
      letterSpacing: 2,
      visible: true,
      align: 'center',
      weight: 400,
      italic: false,
    }
    apply({ ...draft, layers: [...draft.layers, layer] })
    setSelectedLayer(layer.id)
    setTab('type')
  }

  const patchLayer = (id: string, patch: Partial<TextLayer>) => {
    apply({ ...draft, layers: draft.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)) })
  }

  const layer = draft.layers.find((l) => l.id === selectedLayer)
  const layerBox = selectedLayer ? layerBoxes[selectedLayer] : undefined
  const layerToolbarStyle = layerBox
    ? (layerBox.y + layerBox.h) < 0.55
      ? { top: `${Math.min(86, (layerBox.y + layerBox.h + 0.015) * 100)}%`, bottom: 'auto' }
      : { bottom: `${Math.min(86, (1 - layerBox.y + 0.015) * 100)}%`, top: 'auto' }
    : undefined

  const selectLayerAt = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = previewRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const nx = (event.clientX - rect.left) / rect.width
    const ny = (event.clientY - rect.top) / rect.height
    const pad = 0.01
    const hit = (Object.entries(layerBoxes) as [string, DarkroomLayerBox][])
      .filter(([id]) => draft.layers.find((item) => item.id === id && item.type === 'text')?.visible)
      .filter(([, box]) =>
        nx >= box.x - pad && nx <= box.x + box.w + pad &&
        ny >= box.y - pad && ny <= box.y + box.h + pad,
      )
      .sort((a, b) => a[1].w * a[1].h - b[1].w * b[1].h)[0]?.[0]
    if (!hit) return
    setSelectedLayer(hit)
    setTab('type')
    setShowLayerTools(true)
    requestAnimationFrame(() => layerTextRef.current?.focus())
  }

  const exportImage = async (mode: 'download' | 'archive') => {
    const img = originalImgRef.current
    if (!img || !asset) return
    setWorking(true)
    try {
      const canvas = renderDarkroom(img, draft, { maxWidth: 1600 })
      const blob = await canvasToBlob(canvas, 'image/jpeg', 0.94)
      if (mode === 'download') {
        downloadBlob(blob, `campaign04-${asset.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-darkroom.jpg`)
        addExport({ id: uid('exp'), name: `${asset.title} / darkroom`, format: 'JPEG', width: canvas.width, height: canvas.height, createdAt: Date.now() })
        addToStudioHistory(asset.id)
        toast('Darkroom export ready', 'The JPEG has been downloaded.', 'success')
      } else {
        const saved = await saveAssetBlob(blob, {
          id: uid('edit'),
          title: `${asset.title} / developed`,
          kind: 'photograph',
          source: 'edited',
          prompt: asset.prompt,
          styleId: asset.styleId,
          palette: asset.palette,
          createdAt: Date.now(),
          width: canvas.width,
          height: canvas.height,
          collection: 'Darkroom output',
          tags: ['darkroom', 'edited'],
          caption: 'DARKROOM / FINAL PRINT',
          note: asset.note,
          meta: { source: asset.id, adjustments: JSON.stringify(draft.adjustments).slice(0, 300) },
        })
        addAsset(saved)
        addExport({ id: uid('exp'), name: `${saved.title}`, format: 'JPEG', width: canvas.width, height: canvas.height, createdAt: Date.now(), assetId: saved.id })
        addToStudioHistory(saved.id)
        toast('Print saved', 'The developed plate is in your archive.', 'success')
      }
    } catch (err) {
      toast('Export failed', err instanceof Error ? err.message : 'The canvas could not be exported.', 'error')
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="page darkroom-page">
      <PageHeader
        index="06"
        kicker="POST-PRODUCTION / DARKROOM"
        title={<>THE <span className="ital">DARKROOM</span></>}
        description="A non-destructive developing bench. Film treatments, light shaping, grain, halation and type layers — everything is rebuilt from the original file on every change."
        actions={
          <>
            <button className="btn btn--ghost" onClick={() => { setCompare(!compare) }}>{compare ? 'HIDE ORIGINAL' : 'COMPARE ORIGINAL'}</button>
            <button className="btn btn--ghost" onClick={() => exportImage('archive')} disabled={working}><Save size={12} /> SAVE PRINT</button>
            <button className="btn btn--solid" onClick={() => exportImage('download')} disabled={working}><Download size={12} /> {working ? 'DEVELOPING…' : 'EXPORT JPEG'}</button>
          </>
        }
      />

      <div className="darkroom-layout">
        <aside className="darkroom-tools">
          <div className="darkroom-asset">
            <div className="block-label"><span>SOURCE PLATE</span><span className="mono-xs muted">{assets.length} AVAILABLE</span></div>
            <select className="select" value={assetId} onChange={(e) => { setAssetId(e.target.value); setFocusAsset(e.target.value) }}>
              {imageAssets.map((a) => <option key={a.id} value={a.id}>{a.title} — {a.source}</option>)}
            </select>
            <div className="darkroom-source-meta">
              <span>{asset?.analysis?.era ?? 'unread plate'}</span>
              <span>{asset?.width && asset?.height ? `${asset.width} × ${asset.height}` : '—'}</span>
            </div>
          </div>

          <div className="darkroom-tabs">
            {ADJUSTMENT_GROUPS.map((g) => (
              <button key={g.id} className={tab === g.id ? 'active' : ''} onClick={() => setTab(g.id)}>{g.icon}<span>{g.label}</span></button>
            ))}
            <button className={tab === 'crop' ? 'active' : ''} onClick={() => setTab('crop')}><Crop size={11} /><span>CROP</span></button>
            <button className={tab === 'type' ? 'active' : ''} onClick={() => setTab('type')}><Type size={11} /><span>TYPE</span></button>
          </div>

          <div className="darkroom-panel">
            {ADJUSTMENT_GROUPS.filter((g) => g.id === tab).map((g) => (
              <div key={g.id} className="darkroom-sliders">
                {g.items.map((it) => (
                  <Slider key={it.key} label={it.label} value={draft.adjustments[it.key]} min={it.min} max={it.max} onChange={(v) => setAdjustment(it.key, v)} low={it.low} high={it.high} />
                ))}
                <button className="mini-link" onClick={() => {
                  apply({ ...draft, adjustments: { ...draft.adjustments, ...DEFAULT_ADJUSTMENTS } })
                }}>RESET THIS PANEL</button>
              </div>
            ))}

            {tab === 'crop' && (
              <div className="darkroom-crop">
                <div className="field">
                  <label>ASPECT RATIO</label>
                  <div className="seg" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
                    {['original', '1:1', '3:4', '4:5', '16:9', '9:16'].map((a) => (
                      <button key={a} className={draft.crop.aspect === a ? 'active' : ''} onClick={() => setCrop({ aspect: a })}>{a}</button>
                    ))}
                  </div>
                </div>
                <Slider label="Zoom" value={Math.round(draft.crop.zoom * 100)} min={100} max={210} onChange={(v) => setCrop({ zoom: v / 100 })} low="fit" high="crop in" />
                <Slider label="Offset X" value={draft.crop.offsetX} min={-50} max={50} onChange={(v) => setCrop({ offsetX: v })} low="left" high="right" />
                <Slider label="Offset Y" value={draft.crop.offsetY} min={-50} max={50} onChange={(v) => setCrop({ offsetY: v })} low="up" high="down" />
                <Slider label="Rotation" value={draft.crop.rotation} min={-30} max={30} onChange={(v) => setCrop({ rotation: v })} low="-30°" high="+30°" />
                <div className="darkroom-crop-actions">
                  <button className={`btn btn--ghost btn--sm ${draft.crop.flipX ? 'active' : ''}`} onClick={() => setCrop({ flipX: !draft.crop.flipX })}><FlipHorizontal2 size={11} /> FLIP</button>
                  <button className="btn btn--ghost btn--sm" onClick={() => setCrop({ rotation: 0, flipX: false, zoom: 1, offsetX: 0, offsetY: 0 })}><RotateCcw size={11} /> RESET CROP</button>
                </div>
              </div>
            )}

            {tab === 'type' && (
              <div className="darkroom-type">
                <div className="darkroom-layer-actions">
                  <button className="btn btn--ghost btn--sm" onClick={() => addLayer('text')}><Type size={11} /> ADD TEXT</button>
                  <button className="btn btn--ghost btn--sm" onClick={() => addLayer('shape')}><Square size={11} /> ADD RULE</button>
                </div>
                {draft.layers.length === 0 && <p className="mini-note">No layers yet. Type is part of the image, not a caption added afterwards.</p>}
                <div className="layer-list">
                  {draft.layers.map((l, i) => (
                    <div key={l.id} className={`layer-row ${selectedLayer === l.id ? 'active' : ''}`} onClick={() => { setSelectedLayer(l.id); setShowLayerTools(true) }}>
                      <span className="mono-xs">{String(i + 1).padStart(2, '0')}</span>
                      <span className="layer-row-name">{l.type === 'shape' ? 'RULE' : l.text || 'TEXT'}</span>
                      <button onClick={(e) => { e.stopPropagation(); patchLayer(l.id, { visible: !l.visible }) }}>{l.visible ? <Eye size={11} /> : <EyeOff size={11} />}</button>
                      <button onClick={(e) => { e.stopPropagation(); apply({ ...draft, layers: draft.layers.filter((x) => x.id !== l.id) }); if (selectedLayer === l.id) setSelectedLayer(null) }}><Trash2 size={11} /></button>
                    </div>
                  ))}
                </div>
                {layer && (
                  <div className="layer-editor">
                    {layer.type === 'text' ? (
                      <textarea ref={layerTextRef} className="textarea" value={layer.text} onChange={(e) => patchLayer(layer.id, { text: e.target.value })} rows={2} />
                    ) : null}
                    <div className="field"><label>FONT</label>
                      <select className="select" value={layer.font} onChange={(e) => patchLayer(layer.id, { font: e.target.value })}>
                        {FONT_LIBRARY.map((f) => <option key={f.name} value={f.css}>{f.name}</option>)}
                      </select>
                    </div>
                    <div className="layer-grid">
                      <Slider label="Size" value={layer.size} min={1} max={22} onChange={(v) => patchLayer(layer.id, { size: v })} />
                      <Slider label="Tracking" value={layer.letterSpacing} min={-2} max={18} onChange={(v) => patchLayer(layer.id, { letterSpacing: v })} />
                      <Slider label="X" value={layer.x} min={0} max={100} onChange={(v) => patchLayer(layer.id, { x: v })} />
                      <Slider label="Y" value={layer.y} min={0} max={100} onChange={(v) => patchLayer(layer.id, { y: v })} />
                      <Slider label="Opacity" value={Math.round(layer.opacity * 100)} min={5} max={100} onChange={(v) => patchLayer(layer.id, { opacity: v / 100 })} />
                      <Slider label="Rotation" value={layer.rotation} min={-30} max={30} onChange={(v) => patchLayer(layer.id, { rotation: v })} />
                      <Slider label="Weight" value={layer.weight} min={300} max={800} step={100} onChange={(v) => patchLayer(layer.id, { weight: v })} />
                    </div>
                    <div className="layer-inline">
                      <input type="color" value={layer.color} onChange={(e) => patchLayer(layer.id, { color: e.target.value })} title="Text colour" />
                      <select className="select" value={layer.align} onChange={(e) => patchLayer(layer.id, { align: e.target.value as CanvasTextAlign })}>
                        <option value="left">Left</option><option value="center">Centre</option><option value="right">Right</option>
                      </select>
                      <select className="select" value={layer.blend} onChange={(e) => patchLayer(layer.id, { blend: e.target.value as GlobalCompositeOperation })}>
                        {BLENDS.map((b) => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    <label className="check"><input type="checkbox" checked={layer.italic} onChange={(e) => patchLayer(layer.id, { italic: e.target.checked })} /> ITALIC</label>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="darkroom-film">
            <div className="block-label"><span>FILM TREATMENTS</span><span className="mono-xs muted">ONE CLICK</span></div>
            <div className="film-grid">
              {FILM_PRESETS.map((f) => (
                <button key={f.id} className="film-btn" onClick={() => applyFilm(f)} title={f.note}>
                  <span>{f.name}</span>
                  <i>{f.note}</i>
                </button>
              ))}
            </div>
          </div>

          <div className="darkroom-history">
            <button className="btn btn--ghost btn--sm" onClick={undo} disabled={!past.length}><Undo2 size={11} /> UNDO</button>
            <button className="btn btn--ghost btn--sm" onClick={redo} disabled={!future.length}><Redo2 size={11} /> REDO</button>
            <button className="btn btn--ghost btn--sm" onClick={reset}><RotateCcw size={11} /> RESET</button>
          </div>
        </aside>

        <section className="darkroom-stage">
          <div className="darkroom-stage-head">
            <div>
              <div className="eyebrow">NEGATIVE / {asset?.source.toUpperCase() ?? 'UNKNOWN'}</div>
              <h2 className="stage-title">{asset?.title ?? 'No plate selected'}</h2>
            </div>
            <div className="stage-tools">
              <span className="mono-xs muted">{past.length} STEPS BACK · {draft.layers.length} LAYERS</span>
              <label className="check"><input type="checkbox" checked={showSafe} onChange={(e) => setShowSafe(e.target.checked)} /> SAFE AREA</label>
              <button className="icon-btn tooltip" data-tip="Reset all" onClick={reset}><RotateCcw size={12} /></button>
            </div>
          </div>

          <div className={`darkroom-canvas-wrap ${compare ? 'is-compare' : ''}`} ref={canvasWrapRef}>
            {compare && asset ? <img className="darkroom-original" src={asset.src} alt={asset.title} /> : null}
            <canvas
              ref={previewRef}
              className={`darkroom-canvas ${draft.layers.length ? 'darkroom-canvas--editable' : ''}`}
              onClick={selectLayerAt}
            />
            {!compare && layerBox && canvasBox.width > 0 && (
              <div
                className="darkroom-layer-overlay"
                style={{ left: canvasBox.left, top: canvasBox.top, width: canvasBox.width, height: canvasBox.height }}
              >
                <div
                  className="darkroom-layer-selection"
                  style={{
                    left: `${layerBox.x * 100}%`,
                    top: `${layerBox.y * 100}%`,
                    width: `${layerBox.w * 100}%`,
                    height: `${layerBox.h * 100}%`,
                  }}
                />
                {showLayerTools && layer?.type === 'text' && (
                  <div className="darkroom-layer-toolbar" style={layerToolbarStyle} onPointerDown={(event) => event.stopPropagation()}>
                    <span className="darkroom-layer-toolbar-title">TEXT / {layer.text.slice(0, 18) || 'UNTITLED'}</span>
                    <button type="button" className="zine-tool-btn" title="Make smaller" onClick={() => patchLayer(layer.id, { size: Math.max(1, layer.size - 0.5) })}>A−</button>
                    <span className="zine-tool-value">{layer.size}</span>
                    <button type="button" className="zine-tool-btn" title="Make larger" onClick={() => patchLayer(layer.id, { size: Math.min(22, layer.size + 0.5) })}>A+</button>
                    <label className="zine-tool-color" title="Text colour">
                      <span style={{ background: layer.color }} />
                      <input type="color" value={layer.color} onChange={(event) => patchLayer(layer.id, { color: event.target.value })} />
                    </label>
                    <select
                      className="zine-tool-select"
                      title="Font"
                      value={layer.font}
                      onChange={(event) => patchLayer(layer.id, { font: event.target.value })}
                    >
                      {FONT_LIBRARY.map((font) => <option key={font.name} value={font.css}>{font.name}</option>)}
                    </select>
                    <button
                      type="button"
                      className={`zine-tool-btn zine-tool-italic ${layer.italic ? 'active' : ''}`}
                      title="Italic"
                      onClick={() => patchLayer(layer.id, { italic: !layer.italic })}
                    ><em>I</em></button>
                    <button type="button" className="zine-tool-btn zine-tool-words" onClick={() => layerTextRef.current?.focus()}>EDIT WORDS</button>
                    <button type="button" className="zine-tool-btn zine-tool-close" title="Close" onClick={() => setShowLayerTools(false)}>×</button>
                  </div>
                )}
              </div>
            )}
            {!imageReady && <div className="darkroom-loading"><span className="loading-line" /><span className="mono-xs muted">LOADING PLATE…</span></div>}
            <div className="darkroom-canvas-meta">
              <span>{draft.crop.aspect === 'original' ? 'ORIGINAL CROP' : draft.crop.aspect}</span>
              <span>{Math.round(draft.crop.zoom * 100)}% · {draft.crop.rotation}°</span>
              <span>{compare ? 'ORIGINAL VISIBLE' : draft.layers.length ? 'CLICK TEXT TO EDIT' : 'DEVELOPED PREVIEW'}</span>
            </div>
          </div>

          <div className="darkroom-bottom">
            <div className="darkroom-steps">
              <div className="block-label">DEVELOPMENT NOTES</div>
              <div className="dev-notes">
                <span><b>01</b> {Object.values(draft.adjustments).filter((v) => v !== 0).length} adjustments active</span>
                <span><b>02</b> {draft.layers.filter((l) => l.visible).length} visible layers</span>
                <span><b>03</b> {asset?.analysis?.era ?? 'era unread'}</span>
                <span><b>04</b> non-destructive / original preserved</span>
              </div>
              <div className="note" style={{ marginTop: 12 }}>the frame is the argument.</div>
            </div>
            <div className="darkroom-presets-list">
              {FILM_PRESETS.slice(0, 5).map((f) => (
                <button key={f.id} className="dev-preset" onClick={() => applyFilm(f)}>
                  <span>{f.name}</span><small>{f.note}</small>
                </button>
              ))}
            </div>
            <div className="darkroom-export">
              <div className="block-label">OUTPUT</div>
              <div className="kv"><span>Format</span><span>JPEG / 94%</span></div>
              <div className="kv"><span>Long edge</span><span>1600 px</span></div>
              <button className="btn btn--accent btn--wide" onClick={() => exportImage('download')} disabled={working}><Download size={12} /> EXPORT PRINT</button>
              <button className="btn btn--ghost btn--sm btn--wide" onClick={() => exportImage('archive')} disabled={working}><Save size={11} /> SAVE TO ARCHIVE</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
