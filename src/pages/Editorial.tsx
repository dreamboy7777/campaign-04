import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeftRight, Download, Save, Image as ImageIcon, Type, AlignLeft, AlignCenter,
  AlignRight, Sparkles, BookOpen, Plus, X, ChevronDown,
} from 'lucide-react'
import { PageHeader, Slider, Modal, ImagePlate, CopyButton, SectionHead } from '../components/UI'
import { UploadPlate } from '../components/UploadPlate'
import { useApp, uid } from '../lib/store'
import { FONT_LIBRARY, STYLE_MAP } from '../lib/presets'
import { LAYOUT_SIZES, loadImageMap, renderLayout, type LayoutConfig } from '../lib/imaging'
import { canvasToBlob, downloadBlob, saveAssetBlob } from '../lib/imageStore'

const FORMAT_ORDER: LayoutConfig['format'][] = ['cover', 'spread', 'ad', 'poster', 'lookbook', 'casting', 'zine-cover', 'zine-page', 'back']

export function Editorial() {
  const assets = useApp((s) => s.assets)
  const campaigns = useApp((s) => s.campaigns)
  const editorDraft = useApp((s) => s.editorDraft)
  const addExport = useApp((s) => s.addExport)
  const addAsset = useApp((s) => s.addAsset)
  const addZinePage = useApp((s) => s.addZinePage)
  const navigate = useApp((s) => s.navigate)
  const toast = useApp((s) => s.toast)
  const typePairing = useApp((s) => s.typePairing)

  const campaign = campaigns.find((c) => c.id === editorDraft?.campaignId)
  const style = STYLE_MAP[campaign?.styleId ?? editorDraft?.styleId ?? 'american-archive'] ?? STYLE_MAP['american-archive']
  const defaultImage = campaign?.assets.find((a) => a.assetId)?.assetId ?? 'seed-portrait-wall'
  const defaultSecondary = campaign?.assets.filter((a) => a.assetId)[1]?.assetId ?? 'seed-cover-closeup'

  const [config, setConfig] = useState<LayoutConfig>(() => {
    const size = LAYOUT_SIZES.cover
    return {
      format: 'cover',
      width: size.width,
      height: size.height,
      headline: campaign?.title ?? 'AFTER THE RAIN',
      subhead: campaign?.copy ?? 'Some things stay on your skin.',
      body: campaign?.concept ?? 'A study in proximity, light and the things we keep. Photographed at home, between one life and the next.',
      caption: campaign?.season ?? 'Fragrance / 2006',
      note: 'CAMPAIGN 04 / VOL. 001',
      brand: campaign?.brand ?? 'CAMPAIGN 04',
      issue: 'ISSUE 04 / 2026',
      price: '£12 / $16',
      displayFont: typePairing?.display ?? style.typography.display,
      bodyFont: typePairing?.body ?? style.typography.body,
      ink: '#171512',
      paper: '#efe8d8',
      accent: '#9b5e63',
      align: 'left',
      scale: 1,
      tracking: 0,
      imageId: defaultImage,
      secondaryImageId: defaultSecondary,
      focusX: 0.5,
      focusY: 0.35,
    }
  })
  const [picker, setPicker] = useState<null | 'primary' | 'secondary'>(null)
  const [working, setWorking] = useState(false)
  const [images, setImages] = useState<Record<string, HTMLImageElement | undefined>>({})
  const previewRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let alive = true
    loadImageMap([config.imageId, config.secondaryImageId], assets).then((map) => { if (alive) setImages(map) })
    return () => { alive = false }
  }, [config.imageId, config.secondaryImageId, assets])

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const rendered = await renderLayout(config, images)
        if (cancelled) return
        const canvas = previewRef.current
        if (!canvas) return
        canvas.width = rendered.width
        canvas.height = rendered.height
        const ctx = canvas.getContext('2d')!
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(rendered, 0, 0)
      } catch {
        /* font or image may still be loading */
      }
    }, 180)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [config, images])

  const patch = (p: Partial<LayoutConfig>) => setConfig((c) => ({ ...c, ...p }))

  const setFormat = (format: LayoutConfig['format']) => {
    const size = LAYOUT_SIZES[format]
    patch({ format, width: size.width, height: size.height })
  }

  const exportPng = async (save = false) => {
    setWorking(true)
    try {
      const rendered = await renderLayout(config, images)
      const blob = await canvasToBlob(rendered, 'image/png')
      const name = `${config.format}-${config.headline.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`
      downloadBlob(blob, name)
      addExport({ id: uid('exp'), name, format: 'PNG', width: rendered.width, height: rendered.height, createdAt: Date.now() })
      if (save) {
        const saved = await saveAssetBlob(blob, {
          id: uid('layout'),
          title: `${config.headline} / ${LAYOUT_SIZES[config.format].label}`,
          kind: 'layout',
          source: 'layout',
          createdAt: Date.now(),
          width: rendered.width,
          height: rendered.height,
          collection: 'Editorial layouts',
          tags: ['layout', config.format, config.displayFont],
          caption: `${config.format.toUpperCase()} / ${config.brand.toUpperCase()}`,
          note: config.subhead,
          palette: [config.paper, config.ink, config.accent],
          meta: { format: config.format, headline: config.headline },
        })
        addAsset(saved)
      }
      toast('Layout exported', save ? 'PNG downloaded and saved to the archive.' : 'The PNG is ready.', 'success')
    } catch (err) {
      toast('Export failed', err instanceof Error ? err.message : 'The layout could not be rendered.', 'error')
    } finally {
      setWorking(false)
    }
  }

  const sendToZine = () => {
    addZinePage({
      id: uid('zpage'),
      template: config.format === 'zine-cover' ? 'cover' : config.format === 'back' ? 'back' : 'editorial',
      headline: config.headline,
      subhead: config.subhead,
      body: config.body,
      imageId: config.imageId,
      secondaryImageId: config.secondaryImageId,
      palette: [config.paper, config.ink, config.accent, ...style.palette.slice(0, 2)],
      caption: config.caption,
      note: config.note,
    })
    toast('Page added to the zine', 'The layout is now a physical page.', 'success')
    navigate('zine')
  }

  const currentSize = LAYOUT_SIZES[config.format]
  const imageAssets = useMemo(() => assets.filter((a) => a.kind !== 'layout' || a.source === 'seed'), [assets])

  return (
    <div className="page editorial-page">
      <PageHeader
        index="07"
        kicker="LAYOUT / EDITORIAL LAB"
        title={<>THE EDITORIAL <span className="ital">LAB</span></>}
        description="Covers, spreads, posters, lookbook pages and casting sheets. Every typographic decision is editable; every export is a real, full-resolution canvas."
        actions={
          <>
            <button className="btn btn--ghost" onClick={sendToZine}><BookOpen size={12} /> SEND TO ZINE</button>
            <button className="btn btn--ghost" onClick={() => exportPng(true)} disabled={working}><Save size={12} /> SAVE + EXPORT</button>
            <button className="btn btn--solid" onClick={() => exportPng(false)} disabled={working}><Download size={12} /> {working ? 'RENDERING…' : 'EXPORT PNG'}</button>
          </>
        }
        meta={<div className="page-meta"><span>{currentSize.label}</span><span>{config.width} × {config.height}</span><span>{style.name}</span></div>}
      />

      <div className="editorial-layout">
        <aside className="editorial-controls">
          <div className="editorial-block">
            <div className="block-label"><span>01 / FORMAT</span><span className="mono-xs muted">9 FORMATS</span></div>
            <div className="format-list">
              {FORMAT_ORDER.map((f) => (
                <button key={f} className={config.format === f ? 'active' : ''} onClick={() => setFormat(f)}>
                  <span>{LAYOUT_SIZES[f].label.split(' · ')[0]}</span>
                  <small>{LAYOUT_SIZES[f].width}×{LAYOUT_SIZES[f].height}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="editorial-block">
            <div className="block-label"><span>02 / IMAGES</span><span className="mono-xs muted">FROM ARCHIVE</span></div>
            <div className="editorial-image-slots">
              <button className="editorial-image-slot" onClick={() => setPicker('primary')}>
                {config.imageId ? <img src={assets.find((a) => a.id === config.imageId)?.src} alt="" /> : <ImageIcon size={16} />}
                <span>PRIMARY IMAGE</span>
                <b>{assets.find((a) => a.id === config.imageId)?.title ?? 'Choose'}</b>
              </button>
              <button className="editorial-image-slot" onClick={() => setPicker('secondary')}>
                {config.secondaryImageId ? <img src={assets.find((a) => a.id === config.secondaryImageId)?.src} alt="" /> : <ImageIcon size={16} />}
                <span>SECONDARY</span>
                <b>{assets.find((a) => a.id === config.secondaryImageId)?.title ?? 'None'}</b>
              </button>
            </div>
            <div className="editorial-focus">
              <Slider label="Focus X" value={Math.round((config.focusX ?? 0.5) * 100)} min={0} max={100} onChange={(v) => patch({ focusX: v / 100 })} />
              <Slider label="Focus Y" value={Math.round((config.focusY ?? 0.35) * 100)} min={0} max={100} onChange={(v) => patch({ focusY: v / 100 })} />
            </div>
          </div>

          <div className="editorial-block">
            <div className="block-label">03 / WORDS</div>
            <div className="field"><label>HEADLINE</label><textarea className="textarea" rows={2} value={config.headline} onChange={(e) => patch({ headline: e.target.value })} /></div>
            <div className="field"><label>SUBHEAD / DEK</label><textarea className="textarea" rows={2} value={config.subhead} onChange={(e) => patch({ subhead: e.target.value })} /></div>
            <div className="field"><label>BODY</label><textarea className="textarea" rows={4} value={config.body} onChange={(e) => patch({ body: e.target.value })} /></div>
            <div className="field"><label>CAPTION / DATE</label><input className="input" value={config.caption} onChange={(e) => patch({ caption: e.target.value })} /></div>
            <div className="field"><label>NOTE / COORDINATES</label><input className="input" value={config.note} onChange={(e) => patch({ note: e.target.value })} /></div>
          </div>

          <div className="editorial-block">
            <div className="block-label">04 / TYPOGRAPHY</div>
            <div className="field"><label>DISPLAY</label>
              <select className="select" value={config.displayFont} onChange={(e) => patch({ displayFont: e.target.value })}>
                {FONT_LIBRARY.map((f) => <option key={f.name} value={f.name}>{f.name} — {f.category}</option>)}
              </select>
            </div>
            <div className="field"><label>BODY</label>
              <select className="select" value={config.bodyFont} onChange={(e) => patch({ bodyFont: e.target.value })}>
                {FONT_LIBRARY.filter((f) => f.name !== config.displayFont).map((f) => <option key={f.name} value={f.name}>{f.name} — {f.category}</option>)}
              </select>
            </div>
            <div className="editorial-seg">
              {(['left', 'center', 'right'] as const).map((a) => (
                <button key={a} className={config.align === a ? 'active' : ''} onClick={() => patch({ align: a })}>
                  {a === 'left' ? <AlignLeft size={12} /> : a === 'center' ? <AlignCenter size={12} /> : <AlignRight size={12} />} {a.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="editorial-focus">
              <Slider label="Display scale" value={Math.round(config.scale * 100)} min={60} max={150} onChange={(v) => patch({ scale: v / 100 })} low="small" high="loud" />
              <Slider label="Tracking" value={config.tracking} min={-3} max={14} onChange={(v) => patch({ tracking: v })} low="tight" high="wide" />
            </div>
          </div>

          <div className="editorial-block">
            <div className="block-label">05 / INK & PAPER</div>
            <div className="colour-row">
              <label>INK<input type="color" value={config.ink} onChange={(e) => patch({ ink: e.target.value })} /></label>
              <label>PAPER<input type="color" value={config.paper} onChange={(e) => patch({ paper: e.target.value })} /></label>
              <label>ACCENT<input type="color" value={config.accent} onChange={(e) => patch({ accent: e.target.value })} /></label>
            </div>
            <div className="field" style={{ marginTop: 12 }}><label>BRAND / MASTHEAD</label><input className="input" value={config.brand} onChange={(e) => patch({ brand: e.target.value })} /></div>
            <div className="field"><label>ISSUE</label><input className="input" value={config.issue} onChange={(e) => patch({ issue: e.target.value })} /></div>
          </div>

          <div className="editorial-block editorial-block--last">
            <button className="btn btn--accent btn--wide" onClick={() => exportPng(false)}><Download size={12} /> EXPORT THIS PAGE</button>
            <p className="desk-note">Exports at {config.width} × {config.height} px. Type is rendered by the browser, so added fonts must be loaded.</p>
          </div>
        </aside>

        <section className="editorial-stage">
          <div className="editorial-stage-bar">
            <div>
              <span className="mono-xs accent">{LAYOUT_SIZES[config.format].label.toUpperCase()}</span>
              <span className="mono-xs muted" style={{ marginLeft: 14 }}>{config.displayFont} / {config.bodyFont}</span>
            </div>
            <div className="stage-tools">
              <span className="mono-xs muted">LIVE CANVAS</span>
              <button className="icon-btn tooltip" data-tip="Switch image" onClick={() => setPicker('primary')}><ArrowLeftRight size={12} /></button>
              <CopyButton text={`${config.headline}\n${config.subhead}\n\n${config.body}`} label="COPY COPY" />
            </div>
          </div>
          <div className="editorial-canvas-wrap">
            <canvas ref={previewRef} className="editorial-canvas" />
            {!config.imageId && <div className="editorial-canvas-note">Choose an image to begin.</div>}
          </div>
          <div className="editorial-stage-foot">
            <div><span className="mono-xs">FORMAT</span><strong>{config.format.toUpperCase()}</strong></div>
            <div><span className="mono-xs">SIZE</span><strong>{config.width}×{config.height}</strong></div>
            <div><span className="mono-xs">IMAGES</span><strong>{[config.imageId, config.secondaryImageId].filter(Boolean).length}</strong></div>
            <div><span className="mono-xs">ALIGN</span><strong>{config.align.toUpperCase()}</strong></div>
            <button className="btn btn--ghost btn--sm" style={{ marginLeft: 'auto' }} onClick={sendToZine}><Plus size={11} /> ADD TO ZINE</button>
          </div>
        </section>
      </div>

      <section className="section">
        <SectionHead index="08" title="Editorial systems" />
        <div className="editorial-systems">
          {[
            { n: 'COVER', t: 'One image, one gesture.', d: 'The headline is part of the photograph. A cover fails if the type could belong to any other magazine.' },
            { n: 'SPREAD', t: 'The pause between images.', d: 'Use the left page as an image and the right as air, copy and a smaller interruption.' },
            { n: 'CASTING', t: 'A page of people.', d: 'Four frames, one series. The sheet is evidence of a decision, not a mood board.' },
          ].map((s) => (
            <div key={s.n} className="editorial-system">
              <span className="mono-xs accent">{s.n}</span>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
              <button className="mini-link" onClick={() => {
                if (s.n === 'COVER') setFormat('cover')
                if (s.n === 'SPREAD') setFormat('spread')
                if (s.n === 'CASTING') setFormat('casting')
              }}>LOAD FORMAT</button>
            </div>
          ))}
        </div>
      </section>

      <Modal open={!!picker} onClose={() => setPicker(null)} eyebrow="IMAGE SELECTION / ARCHIVE" title={picker === 'secondary' ? 'Choose secondary image' : 'Choose primary image'} width={1000} footer={<><span className="mono-xs muted">All plates can be re-framed after selection.</span><button className="btn btn--ghost btn--sm" onClick={() => setPicker(null)}>CLOSE</button></>}>
        <div className="editorial-picker">
          <UploadPlate
            label="UPLOAD FROM LAPTOP"
            onPicked={(a) => {
              if (picker === 'secondary') patch({ secondaryImageId: a.id })
              else patch({ imageId: a.id })
              setPicker(null)
            }}
          />
          {imageAssets.map((a) => (
            <button key={a.id} className="editorial-pick" onClick={() => {
              if (picker === 'secondary') patch({ secondaryImageId: a.id })
              else patch({ imageId: a.id })
              setPicker(null)
            }}>
              <ImagePlate src={a.src} alt={a.title} ratio="1 / 1" />
              <span>{a.title}</span>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  )
}
