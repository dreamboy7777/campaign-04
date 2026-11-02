import { useEffect, useState } from 'react'
import {
  Plus, Download, Layers, Trash2, Sparkles, Image as ImageIcon, ArrowUpRight,
  Fingerprint, Copy, Check, Type, Package, Quote,
} from 'lucide-react'
import { PageHeader, Modal, ImagePlate, Swatches, SectionHead, CopyButton } from '../components/UI'
import { UploadPlate } from '../components/UploadPlate'
import { useApp, uid } from '../lib/store'
import { BRAND_ARCHETYPES, FONT_LIBRARY, STYLE_MAP } from '../lib/presets'
import { generateBrand } from '../lib/director'
import { canvasToBlob, downloadBlob, loadImage } from '../lib/imageStore'
import type { Brand, Campaign } from '../lib/types'

const FONTS = FONT_LIBRARY.map((f) => f.name)

export function BrandLab() {
  const brands = useApp((s) => s.brands)
  const assets = useApp((s) => s.assets)
  const addBrand = useApp((s) => s.addBrand)
  const updateBrand = useApp((s) => s.updateBrand)
  const addCampaign = useApp((s) => s.addCampaign)
  const addExport = useApp((s) => s.addExport)
  const setEditorDraft = useApp((s) => s.setEditorDraft)
  const navigate = useApp((s) => s.navigate)
  const toast = useApp((s) => s.toast)

  const [selectedId, setSelectedId] = useState(brands[0]?.id)
  const [createOpen, setCreateOpen] = useState(false)
  const [imagePicker, setImagePicker] = useState(false)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    if (!brands.some((b) => b.id === selectedId)) setSelectedId(brands[0]?.id)
  }, [brands, selectedId])

  const brand = brands.find((b) => b.id === selectedId) ?? brands[0]
  const cover = assets.find((a) => a.id === brand?.coverAssetId)
  const patch = (p: Partial<Brand>) => brand && updateBrand(brand.id, p)

  const downloadSheet = async () => {
    if (!brand) return
    setWorking(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 1600
      canvas.height = 1100
      const ctx = canvas.getContext('2d')!
      const paper = '#efe7d8'
      const ink = '#171512'
      ctx.fillStyle = paper
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.strokeStyle = 'rgba(23,21,18,0.25)'
      ctx.lineWidth = 1
      ctx.strokeRect(40, 40, 1520, 1020)
      ctx.fillStyle = ink
      ctx.font = `500 94px '${brand.displayFont}', serif`
      ctx.fillText(brand.wordmark, 90, 190)
      ctx.font = `italic 30px '${brand.bodyFont}', serif`
      ctx.fillText(brand.tagline, 92, 245)
      ctx.font = `12px 'IBM Plex Mono', monospace`
      ctx.fillText(`CAMPAIGN 04 / BRAND SHEET / ${brand.archetype.toUpperCase()}`, 92, 95)
      ctx.fillText('PALETTE', 92, 340)
      brand.palette.forEach((c, i) => {
        ctx.fillStyle = c
        ctx.fillRect(92 + i * 120, 360, 100, 100)
        ctx.strokeStyle = 'rgba(0,0,0,0.14)'
        ctx.strokeRect(92 + i * 120, 360, 100, 100)
        ctx.fillStyle = ink
        ctx.font = `10px 'IBM Plex Mono', monospace`
        ctx.fillText(c.toUpperCase(), 92 + i * 120, 480)
        ctx.font = `10px 'IBM Plex Mono', monospace`
      })
      ctx.fillStyle = ink
      ctx.font = `11px 'IBM Plex Mono', monospace`
      ctx.fillText('TYPOGRAPHY', 92, 550)
      ctx.font = `500 58px '${brand.displayFont}', serif`
      ctx.fillText('Aa', 92, 625)
      ctx.font = `11px 'IBM Plex Mono', monospace`
      ctx.fillText(brand.displayFont.toUpperCase(), 210, 603)
      ctx.font = `26px '${brand.bodyFont}', serif`
      ctx.fillText('The quick brown fox jumps over the lazy dog.', 210, 630)
      ctx.font = `11px 'IBM Plex Mono', monospace`
      ctx.fillText(brand.bodyFont.toUpperCase(), 210, 660)
      ctx.fillText('STORY', 92, 735)
      ctx.fillStyle = ink
      ctx.font = `21px '${brand.bodyFont}', serif`
      wrap(ctx, brand.story, 92, 770, 700, 31)
      ctx.fillStyle = ink
      ctx.font = `11px 'IBM Plex Mono', monospace`
      ctx.fillText('VOICE', 920, 735)
      ctx.font = `19px '${brand.bodyFont}', serif`
      wrap(ctx, brand.voice, 920, 770, 540, 28)
      ctx.font = `11px 'IBM Plex Mono', monospace`
      ctx.fillText('PACKAGING', 920, 880)
      ctx.font = `19px '${brand.bodyFont}', serif`
      wrap(ctx, brand.packaging, 920, 915, 540, 28)
      ctx.font = `10px 'IBM Plex Mono', monospace`
      ctx.fillStyle = 'rgba(23,21,18,0.6)'
      ctx.fillText('CAMPAIGN 04 · INDEPENDENT IMAGE-MAKING STUDIO · VOL. 001', 92, 1035)
      const blob = await canvasToBlob(canvas, 'image/png')
      const name = `${brand.name.toLowerCase().replace(/\s+/g, '-')}-brand-sheet.png`
      downloadBlob(blob, name)
      addExport({ id: uid('exp'), name, format: 'PNG', width: 1600, height: 1100, createdAt: Date.now() })
      toast('Brand sheet exported', 'A print-ready identity sheet is on your desktop.', 'success')
    } catch {
      toast('Could not export', 'The brand sheet failed to render.', 'error')
    } finally {
      setWorking(false)
    }
  }

  const createCampaign = () => {
    if (!brand) return
    const style = STYLE_MAP['american-archive']
    const campaign: Campaign = {
      id: uid('cmp'),
      title: `${brand.name} / SS26`,
      brand: brand.name,
      season: 'Brand campaign / 2026',
      concept: brand.story,
      styleId: style.id,
      palette: brand.palette,
      typography: { display: brand.displayFont, body: brand.bodyFont, note: brand.voice },
      copy: brand.tagline,
      prompt: `${style.promptCore}, ${brand.tagline}, brand campaign for ${brand.name}, palette ${brand.palette.slice(0, 3).join(' ')}, no text`,
      negative: style.negative,
      seed: Math.floor(Math.random() * 900000),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'draft',
      assets: [
        ['hero', 'Hero image', 'The campaign image that carries the identity.'],
        ['portrait-1', 'Portrait 01', 'The face of the brand, unposed.'],
        ['portrait-2', 'Portrait 02', 'A second frame, same world.'],
        ['product', 'Product', 'The object, quiet and clear.'],
        ['cover', 'Cover', 'A publication cover using the identity.'],
        ['poster', 'Poster', 'One line, one image, no explanation.'],
      ].map(([slot, label, description], i) => ({
        id: uid('ca'), slot, label, description,
        prompt: `${style.promptCore}, ${label.toLowerCase()} for ${brand.name}, brand continuity, image ${i + 1}`,
        status: 'empty' as const, locked: false,
      })),
    }
    addCampaign(campaign)
    setEditorDraft({ campaignId: campaign.id })
    toast('Brand campaign created', `${brand.name} is now a world with six empty slots.`, 'success')
    navigate('campaigns')
  }

  return (
    <div className="page brandlab-page">
      <PageHeader
        index="10"
        kicker="IDENTITY SYSTEMS / BRAND LAB"
        title={<>THE BRAND <span className="ital">LAB</span></>}
        description="Invent a label with a complete identity: name, wordmark, voice, palette, type, packaging and the campaign world around it. The brand sheet exports as a real PNG."
        actions={
          <>
            <button className="btn btn--ghost" onClick={() => setCreateOpen(true)}><Plus size={12} /> NEW LABEL</button>
            <button className="btn btn--ghost" onClick={downloadSheet} disabled={working}><Download size={12} /> {working ? 'DRAWING…' : 'BRAND SHEET'}</button>
            <button className="btn btn--solid" onClick={createCampaign}><Layers size={12} /> BUILD CAMPAIGN</button>
          </>
        }
        meta={<div className="page-meta"><span>{brands.length} brands</span><span>{brand?.archetype ?? '—'}</span><span>{brand?.displayFont ?? '—'} / {brand?.bodyFont ?? '—'}</span></div>}
      />

      <div className="brandlab-layout">
        <aside className="brand-rail">
          <div className="brand-rail-head"><span className="mono-xs">LABELS</span><button className="mini-link" onClick={() => setCreateOpen(true)}><Plus size={10} /> ADD</button></div>
          {brands.map((b) => {
            const a = assets.find((x) => x.id === b.coverAssetId)
            return (
              <button key={b.id} className={`brand-rail-card ${brand?.id === b.id ? 'active' : ''}`} onClick={() => setSelectedId(b.id)}>
                <div className="brand-rail-img">{a ? <img src={a.src} alt="" /> : <Fingerprint size={16} />}</div>
                <div>
                  <h3 style={{ fontFamily: `'${b.displayFont}', serif` }}>{b.name}</h3>
                  <p>{b.archetype}</p>
                  <Swatches palette={b.palette} size={9} />
                </div>
              </button>
            )
          })}
        </aside>

        {brand ? (
          <section className="brand-board">
            <div className="brand-board-top">
              <span>CAMPAIGN 04 / IDENTITY SHEET</span>
              <span>BRAND NO. {String(brands.findIndex((b) => b.id === brand.id) + 1).padStart(2, '0')}</span>
              <span>{new Date(brand.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}</span>
            </div>

            <div className="brand-hero">
              <div className="brand-hero-image" onClick={() => setImagePicker(true)}>
                <ImagePlate src={cover?.src} alt={brand.name} ratio="4 / 5" caption={cover?.caption ?? 'BRAND IMAGE'} />
                <span className="brand-image-change">CHANGE IMAGE</span>
              </div>
              <div className="brand-hero-copy">
                <div className="eyebrow">THE LABEL</div>
                <h2 className="brand-wordmark" style={{ fontFamily: `'${brand.displayFont}', serif` }}>{brand.wordmark}</h2>
                <p className="brand-tagline" style={{ fontFamily: `'${brand.bodyFont}', serif` }}>{brand.tagline}</p>
                <div className="brand-badges">
                  <span className="chip">{brand.archetype}</span>
                  {brand.personality.map((p) => <span key={p} className="chip">{p}</span>)}
                </div>
                <Swatches palette={brand.palette} size={26} labels />
                <div className="brand-edit-row">
                  <div className="field"><label>NAME</label><input className="input" value={brand.name} onChange={(e) => patch({ name: e.target.value, wordmark: e.target.value.toUpperCase() })} /></div>
                  <div className="field"><label>TAGLINE</label><input className="input" value={brand.tagline} onChange={(e) => patch({ tagline: e.target.value })} /></div>
                </div>
              </div>
            </div>

            <div className="brand-columns">
              <div className="brand-column">
                <div className="block-label">STORY</div>
                <textarea className="textarea brand-text" rows={5} value={brand.story} onChange={(e) => patch({ story: e.target.value })} />
                <div className="block-label">VOICE</div>
                <textarea className="textarea" rows={3} value={brand.voice} onChange={(e) => patch({ voice: e.target.value })} />
                <div className="block-label">PACKAGING</div>
                <textarea className="textarea" rows={4} value={brand.packaging} onChange={(e) => patch({ packaging: e.target.value })} />
              </div>

              <div className="brand-column">
                <div className="block-label">TYPOGRAPHY</div>
                <div className="brand-font-row">
                  <div className="field"><label>DISPLAY</label>
                    <select className="select" value={brand.displayFont} onChange={(e) => patch({ displayFont: e.target.value })}>
                      {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div className="field"><label>BODY</label>
                    <select className="select" value={brand.bodyFont} onChange={(e) => patch({ bodyFont: e.target.value })}>
                      {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                </div>
                <div className="brand-type-preview">
                  <div style={{ fontFamily: `'${brand.displayFont}', serif` }} className="brand-type-display">Aa</div>
                  <div>
                    <strong style={{ fontFamily: `'${brand.displayFont}', serif` }}>{brand.displayFont}</strong>
                    <span>DISPLAY / HEADLINES / WORDMARK</span>
                    <p style={{ fontFamily: `'${brand.bodyFont}', serif` }}>A quiet sentence is more convincing than a loud one.</p>
                    <strong style={{ fontFamily: `'${brand.bodyFont}', serif` }}>{brand.bodyFont}</strong>
                    <span>BODY / EDITORIAL / PACKAGING</span>
                  </div>
                </div>

                <div className="block-label">PACKAGING MOCK</div>
                <div className="packaging-mock" style={{ background: brand.palette[4] ?? '#e9e0cf', color: brand.palette[3] ?? '#171512' }}>
                  <div className="packaging-card" style={{ borderColor: brand.palette[2] }}>
                    <span className="mono-xs">EST. 2026</span>
                    <strong style={{ fontFamily: `'${brand.displayFont}', serif` }}>{brand.wordmark}</strong>
                    <span style={{ fontFamily: `'${brand.bodyFont}', serif` }}>{brand.tagline}</span>
                    <i />
                  </div>
                  <div className="packaging-label" style={{ background: brand.palette[0], color: brand.palette[3] }}>
                    <span className="mono-xs">CAMPAIGN 04</span>
                    <b style={{ fontFamily: `'${brand.displayFont}', serif` }}>{brand.wordmark}</b>
                    <span style={{ fontFamily: `'${brand.bodyFont}', serif` }}>{brand.voice.slice(0, 70)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="brand-quote">
              <Quote size={15} />
              <blockquote style={{ fontFamily: `'${brand.bodyFont}', serif` }}>{brand.story}</blockquote>
              <span className="mono-xs">{brand.name} / BRAND VOICE</span>
            </div>

            <div className="brand-board-foot">
              <span>CAMPAIGN 04 / INDEPENDENT IMAGE-MAKING STUDIO</span>
              <span>{brand.archetype.toUpperCase()} / {brand.personality.join(' · ').toUpperCase()}</span>
              <button className="mini-link" onClick={() => { if (confirm(`Delete ${brand.name}?`)) { updateBrand(brand.id, {}); useApp.setState({ brands: brands.filter((b) => b.id !== brand.id) }); toast('Brand removed', brand.name) } }}><Trash2 size={10} /> REMOVE</button>
            </div>
          </section>
        ) : (
          <div className="empty"><h3>No labels yet.</h3><p>Invent one. A name, an archetype and a point of view are enough to begin.</p><button className="btn btn--solid" style={{ marginTop: 14 }} onClick={() => setCreateOpen(true)}><Plus size={11} /> CREATE A LABEL</button></div>
        )}
      </div>

      <section className="section">
        <SectionHead index="11" title="Archetypes" link={<span className="mono-xs muted">A STARTING POSITION, NOT A BOX</span>} />
        <div className="archetype-grid">
          {BRAND_ARCHETYPES.map((a) => (
            <button key={a.id} className="archetype-card" onClick={() => {
              const base = brands[0]
              if (!base) return
              const generated = generateBrand(base.name, a.id)
              updateBrand(base.id, { ...generated, archetype: a.name, palette: a.palette })
              toast('Archetype applied', `${base.name} / ${a.name}`, 'success')
            }}>
              <Swatches palette={a.palette} size={18} />
              <h3>{a.name}</h3>
              <p>{a.note}</p>
              <span className="mono-xs">APPLY TO {brands[0]?.name ?? '—'} <ArrowUpRight size={10} /></span>
            </button>
          ))}
        </div>
      </section>

      <CreateBrandModal open={createOpen} onClose={() => setCreateOpen(false)} onCreate={(brand) => { addBrand(brand); setSelectedId(brand.id); setCreateOpen(false) }} />
      <Modal open={imagePicker} onClose={() => setImagePicker(false)} eyebrow="BRAND IMAGE" title="Choose the cover plate" width={960} footer={<button className="btn btn--ghost btn--sm" onClick={() => setImagePicker(false)}>CLOSE</button>}>
        <div className="attach-grid">
          <UploadPlate
            label="UPLOAD FROM LAPTOP"
            onPicked={(a) => { patch({ coverAssetId: a.id }); setImagePicker(false) }}
          />
          {assets.filter((a) => a.kind !== 'layout' || a.source === 'seed').slice(0, 40).map((a) => (
            <button key={a.id} className="attach-pick" onClick={() => { patch({ coverAssetId: a.id }); setImagePicker(false) }}>
              <ImagePlate src={a.src} alt={a.title} ratio="1 / 1" />
              <span>{a.title}</span>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  )
}

function CreateBrandModal({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (b: Brand) => void }) {
  const assets = useApp((s) => s.assets)
  const [name, setName] = useState('FOREVER')
  const [archetype, setArchetype] = useState(BRAND_ARCHETYPES[0].id)
  const [coverAssetId, setCoverAssetId] = useState('seed-portrait-wall')
  const meta = BRAND_ARCHETYPES.find((a) => a.id === archetype) ?? BRAND_ARCHETYPES[0]
  const create = () => {
    const generated = generateBrand(name, archetype)
    onCreate({
      id: uid('brand'),
      name: name.toUpperCase(),
      tagline: generated.tagline,
      archetype: meta.name,
      personality: meta.note.split(/[.,]/).map((s) => s.trim().toLowerCase()).filter(Boolean).slice(0, 4),
      palette: meta.palette,
      displayFont: generated.displayFont,
      bodyFont: generated.bodyFont,
      wordmark: generated.wordmark,
      story: generated.story,
      voice: generated.voice,
      packaging: generated.packaging,
      createdAt: Date.now(),
      coverAssetId,
    })
  }
  return (
    <Modal open={open} onClose={onClose} eyebrow="NEW LABEL / IDENTITY" title="Invent a brand" width={820} footer={<><span className="mono-xs muted">The generator writes a story, voice and packaging direction.</span><button className="btn btn--ghost btn--sm" onClick={onClose}>CANCEL</button><button className="btn btn--solid btn--sm" onClick={create}>CREATE LABEL</button></>}>
      <div className="form-grid">
        <div className="field"><label>NAME</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field"><label>ARCHETYPE</label>
          <select className="select" value={archetype} onChange={(e) => setArchetype(e.target.value)}>
            {BRAND_ARCHETYPES.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="field form-span"><label>COVER PLATE</label>
          <select className="select" value={coverAssetId} onChange={(e) => setCoverAssetId(e.target.value)}>
            {assets.filter((a) => a.kind !== 'layout').map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
          </select>
        </div>
      </div>
      <div className="create-preview">
        <Swatches palette={meta.palette} size={22} labels />
        <p>{meta.note}</p>
      </div>
    </Modal>
  )
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(/\s+/)
  let line = ''
  let cy = y
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cy)
      line = w
      cy += lineHeight
    } else line = test
  }
  if (line) ctx.fillText(line, x, cy)
}
