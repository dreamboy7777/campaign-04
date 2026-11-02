import { useEffect, useMemo, useState } from 'react'
import {
  Plus, Wand2, Lock, Unlock, RefreshCw, Trash2, Copy, Aperture, Layers,
  ArrowUpRight, Check, CircleSlash, Sparkles, X, ImagePlus, Download,
} from 'lucide-react'
import { PageHeader, Modal, Drawer, ImagePlate, Swatches, Slider, SectionHead, CopyButton } from '../components/UI'
import { UploadPlate } from '../components/UploadPlate'
import { useApp, uid } from '../lib/store'
import { STYLE_MAP, STYLE_PRESETS, DELIVERABLE_SETS } from '../lib/presets'
import { controlsFromStyle, generateBrief, styleToPreset } from '../lib/director'
import { dimensionsFor } from '../lib/imageProvider'
import type { Campaign, CampaignAsset } from '../lib/types'

const SLOTS = [
  ['hero', 'Hero campaign', 'The image that carries the entire campaign.'],
  ['portrait-1', 'Portrait 01', 'Editorial portrait, close and unposed.'],
  ['portrait-2', 'Portrait 02', 'A quieter frame between the hero images.'],
  ['product', 'Product study', 'The object as evidence, not a demonstration.'],
  ['cover', 'Magazine cover', 'A cover built from the campaign portraits.'],
  ['poster', 'Campaign poster', 'One image, one line of copy, no explanation.'],
] as const

export function Campaigns() {
  const campaigns = useApp((s) => s.campaigns)
  const assets = useApp((s) => s.assets)
  const editorDraft = useApp((s) => s.editorDraft)
  const addCampaign = useApp((s) => s.addCampaign)
  const updateCampaign = useApp((s) => s.updateCampaign)
  const removeCampaign = useApp((s) => s.removeCampaign)
  const updateCampaignSlot = useApp((s) => s.updateCampaignSlot)
  const duplicateCampaign = useApp((s) => s.duplicateCampaign)
  const attachAsset = useApp((s) => s.attachAsset)
  const startJob = useApp((s) => s.startJob)
  const navigate = useApp((s) => s.navigate)
  const setFocusAsset = useApp((s) => s.setFocusAsset)
  const setEditorDraft = useApp((s) => s.setEditorDraft)
  const toast = useApp((s) => s.toast)
  const usage = useApp((s) => s.usage)
  const setUsage = useApp((s) => s.setUsage)

  const [selectedId, setSelectedId] = useState(editorDraft?.campaignId ?? campaigns[0]?.id)
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<CampaignAsset | null>(null)
  const [attachSlot, setAttachSlot] = useState<CampaignAsset | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  useEffect(() => {
    if (editorDraft?.campaignId && campaigns.some((c) => c.id === editorDraft.campaignId)) {
      setSelectedId(editorDraft.campaignId)
      setEditorDraft(null)
    }
  }, [editorDraft?.campaignId, campaigns, setEditorDraft])

  const selected = campaigns.find((c) => c.id === selectedId) ?? campaigns[0]
  const style = STYLE_MAP[selected?.styleId ?? 'american-archive'] ?? STYLE_PRESETS[0]
  const ready = selected?.assets.filter((a) => a.assetId).length ?? 0
  const generating = selected?.assets.filter((a) => a.status === 'queued').length ?? 0

  const enqueueSlot = (slot: CampaignAsset) => {
    if (!selected) return
    if (slot.locked) {
      toast('Slot is locked', 'Unlock the slot before regenerating it.', 'error')
      return
    }
    if (usage.credits <= 0) {
      toast('No frames left', 'Reset the counter in settings or use the archive.', 'error')
      return
    }
    const dims = dimensionsFor('3:4')
    startJob({
      prompt: `${selected.prompt}, ${slot.prompt}, campaign continuity: ${style.promptCore}, palette ${selected.palette.slice(0, 3).join(' ')}`,
      negative: selected.negative,
      width: dims.width,
      height: dims.height,
      model: useApp.getState().settings.defaultModel,
      styleId: selected.styleId,
      seed: selected.seed + selected.assets.findIndex((a) => a.id === slot.id) * 17,
      target: { kind: 'campaign', campaignId: selected.id, slot: slot.id },
    })
    updateCampaignSlot(selected.id, slot.id, { status: 'queued', locked: false })
    setUsage({ credits: Math.max(0, usage.credits - 1) })
    toast('Slot sent to the lab', `${selected.title} / ${slot.label}.`, 'success')
  }

  const generateAll = () => {
    if (!selected) return
    const empty = selected.assets.filter((a) => !a.assetId && !a.locked && a.status !== 'queued')
    if (!empty.length) {
      toast('Nothing to generate', 'Every unlocked slot already has an image.', 'default')
      return
    }
    empty.forEach((slot) => enqueueSlot(slot))
    toast('Campaign queued', `${empty.length} plates will develop one after another.`, 'success')
  }

  const clearSlot = (slot: CampaignAsset) => {
    if (!selected) return
    if (slot.locked && slot.assetId) {
      toast('Slot is locked', 'Unlock it first if you want to replace the image.', 'error')
      return
    }
    updateCampaignSlot(selected.id, slot.id, { assetId: undefined, status: 'empty', locked: false })
  }

  const openDetail = (slot: CampaignAsset) => {
    setSelectedSlot(slot)
    setDetailOpen(true)
  }

  const statusCounts = useMemo(() => ({
    complete: campaigns.filter((c) => c.status === 'complete').length,
    progress: campaigns.filter((c) => c.status === 'in progress').length,
    draft: campaigns.filter((c) => c.status === 'draft').length,
    slots: campaigns.reduce((s, c) => s + c.assets.filter((a) => a.assetId).length, 0),
  }), [campaigns])

  return (
    <div className="page campaigns-page">
      <PageHeader
        index="08"
        kicker="CAMPAIGN CONTINUITY / BRANDED WORLDS"
        title={<>THE <span className="ital">CAMPAIGNS</span></>}
        description="A campaign is not a folder of images. It is a set of rules that survive every frame. Lock what works, regenerate one plate, and keep the palette, light and casting consistent."
        actions={
          <>
            <button className="btn btn--ghost" onClick={() => setCreateOpen(true)}><Plus size={12} /> NEW CAMPAIGN</button>
            <button className="btn btn--solid" onClick={generateAll}><Wand2 size={12} /> DEVELOP EMPTY SLOTS</button>
          </>
        }
        meta={
          <div className="page-meta">
            <span>{campaigns.length} campaigns</span>
            <span>{statusCounts.complete} complete</span>
            <span>{statusCounts.slots} plates placed</span>
            <span>{generating} developing</span>
          </div>
        }
      />

      <div className="campaign-layout">
        <aside className="campaign-list">
          <div className="campaign-list-head">
            <span className="mono-xs">ALL CAMPAIGNS</span>
            <button className="mini-link" onClick={() => setCreateOpen(true)}><Plus size={10} /> NEW</button>
          </div>
          {campaigns.map((c) => {
            const cover = assets.find((a) => a.id === c.assets[0]?.assetId)
            const done = c.assets.filter((a) => a.assetId).length
            return (
              <button key={c.id} className={`campaign-card ${selected?.id === c.id ? 'active' : ''}`} onClick={() => setSelectedId(c.id)}>
                <div className="campaign-card-img">
                  {cover ? <img src={cover.src} alt="" /> : <div className="campaign-card-empty"><ImagePlus size={14} /></div>}
                </div>
                <div className="campaign-card-body">
                  <div className="campaign-card-top"><span className={`status-dot status-dot--${c.status.replace(' ', '-')}`} />{c.status.toUpperCase()}</div>
                  <h3>{c.title}</h3>
                  <p>{c.season}</p>
                  <div className="campaign-card-progress"><i style={{ width: `${(done / Math.max(1, c.assets.length)) * 100}%` }} /></div>
                  <span className="mono-xs muted">{done} / {c.assets.length} PLATES</span>
                </div>
              </button>
            )
          })}
        </aside>

        {selected ? (
          <section className="campaign-detail">
            <div className="campaign-detail-head">
              <div>
                <div className="eyebrow">CAMPAIGN / {selected.season.toUpperCase()}</div>
                <h2 className="campaign-title">{selected.title}</h2>
                <p className="campaign-concept">{selected.concept}</p>
                <div className="campaign-meta-row">
                  <Swatches palette={selected.palette} size={18} />
                  <span className="chip">{style.name}</span>
                  <span className="chip">SEED {selected.seed}</span>
                  <span className="chip">{selected.typography.display} / {selected.typography.body}</span>
                </div>
              </div>
              <div className="campaign-actions">
                <button className="btn btn--ghost btn--sm" onClick={() => duplicateCampaign(selected.id)}><Copy size={11} /> DUPLICATE</button>
                <button className="btn btn--ghost btn--sm" onClick={() => {
                  if (confirm(`Delete ${selected.title}?`)) {
                    removeCampaign(selected.id)
                    setSelectedId(campaigns.find((c) => c.id !== selected.id)?.id ?? '')
                    toast('Campaign deleted', selected.title)
                  }
                }}><Trash2 size={11} /></button>
                <button className="btn btn--ghost btn--sm" onClick={() => { setEditorDraft({ campaignId: selected.id }); navigate('editorial') }}><Layers size={11} /> LAYOUT</button>
                <button className="btn btn--solid btn--sm" onClick={generateAll}><Wand2 size={11} /> DEVELOP SLOTS</button>
              </div>
            </div>

            <div className="campaign-body-grid">
              <div className="campaign-slots">
                <div className="campaign-slot-head">
                  <span className="mono-xs">ASSET SLOTS / {ready} OF {selected.assets.length} READY</span>
                  <span className="mono-xs muted">CLICK A SLOT TO MANAGE</span>
                </div>
                <div className="campaign-slot-grid">
                  {selected.assets.map((slot, i) => {
                    const a = assets.find((x) => x.id === slot.assetId)
                    return (
                      <article key={slot.id} className={`campaign-slot ${slot.status === 'queued' ? 'is-queued' : ''} ${slot.locked ? 'is-locked' : ''}`}>
                        <div className="campaign-slot-img" onClick={() => openDetail(slot)}>
                          {a ? (
                            <ImagePlate src={a.src} alt={slot.label} ratio="3 / 4" tag={slot.locked ? 'LOCKED' : slot.status === 'queued' ? 'DEVELOPING' : 'READY'} />
                          ) : (
                            <div className="campaign-slot-empty">
                              {slot.status === 'queued' ? <><RefreshCw size={16} className="spin" /><span>DEVELOPING</span></> : <><ImagePlus size={17} /><span>EMPTY SLOT</span></>}
                            </div>
                          )}
                        </div>
                        <div className="campaign-slot-info">
                          <div>
                            <span className="mono-xs accent">{String(i + 1).padStart(2, '0')}</span>
                            <h4>{slot.label}</h4>
                            <p>{slot.description}</p>
                          </div>
                          <div className="campaign-slot-tools">
                            <button className="tooltip" data-tip={slot.locked ? 'Unlock' : 'Lock'} onClick={() => updateCampaignSlot(selected.id, slot.id, { locked: !slot.locked })}>
                              {slot.locked ? <Lock size={11} /> : <Unlock size={11} />}
                            </button>
                            <button className="tooltip" data-tip={a ? 'Regenerate' : 'Generate'} onClick={() => enqueueSlot(slot)}><Wand2 size={11} /></button>
                            <button className="tooltip" data-tip="Use archive plate" onClick={() => setAttachSlot(slot)}><ImagePlus size={11} /></button>
                            {a && <button className="tooltip" data-tip="Open in darkroom" onClick={() => { setFocusAsset(a.id); navigate('darkroom') }}><Aperture size={11} /></button>}
                            {a && <button className="tooltip" data-tip="Clear slot" onClick={() => clearSlot(slot)}><X size={11} /></button>}
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </div>

              <aside className="campaign-continuity">
                <div className="panel">
                  <div className="panel-head"><span className="panel-title"><span className="num">DNA</span> CONTINUITY</span><span className="mono-xs muted">LOCKED</span></div>
                  <div className="panel-body">
                    <div className="continuity-name">{style.name}</div>
                    <p>{style.blurb}</p>
                    <Swatches palette={selected.palette} size={22} labels />
                    <div className="continuity-bars">
                      {controlsFromStyle(style) && Object.entries(controlsFromStyle(style)).slice(0, 6).map(([k, v]) => (
                        <div key={k} className="dna-bar"><span>{k}</span><div><i style={{ width: `${v}%` }} /></div><em>{v}</em></div>
                      ))}
                    </div>
                    <div className="divider-label">RULES</div>
                    <ul className="continuity-rules">
                      {style.photography.slice(0, 3).map((p) => <li key={p}>{p}</li>)}
                      <li>Palette: {selected.palette.slice(0, 3).join(' / ')}</li>
                    </ul>
                  </div>
                </div>

                <div className="panel">
                  <div className="panel-head"><span className="panel-title"><span className="num">TXT</span> COPY</span><CopyButton text={selected.copy} label="COPY" /></div>
                  <div className="panel-body">
                    <p className="campaign-copy">“{selected.copy}”</p>
                    <div className="divider-label">TYPOGRAPHY</div>
                    <p className="campaign-type" style={{ fontFamily: `'${selected.typography.display}', serif` }}>{selected.typography.display}</p>
                    <p className="mono-xs muted">{selected.typography.body} · {selected.typography.note}</p>
                  </div>
                </div>

                <div className="panel">
                  <div className="panel-head"><span className="panel-title"><span className="num">PRM</span> PRODUCTION</span></div>
                  <div className="panel-body">
                    <p className="detail-prompt">{selected.prompt}</p>
                    <CopyButton text={selected.prompt} label="COPY PROMPT" />
                    <button className="btn btn--ghost btn--sm btn--wide" style={{ marginTop: 8 }} onClick={() => {
                      const brief = generateBrief({ idea: selected.concept, styleId: selected.styleId, controls: controlsFromStyle(style), seed: selected.seed })
                      updateCampaign(selected.id, { prompt: brief.prompt, negative: brief.negative, palette: brief.palette })
                      toast('Production prompt refreshed', 'The style and palette were re-read into the campaign.', 'success')
                    }}><RefreshCw size={11} /> REBUILD PROMPT</button>
                  </div>
                </div>

                <button className="btn btn--ghost btn--wide" onClick={() => { setEditorDraft({ campaignId: selected.id }); navigate('contactsheets') }}>
                  <Sparkles size={11} /> OPEN CONTACT SHEET
                </button>
              </aside>
            </div>
          </section>
        ) : (
          <div className="empty"><h3>No campaigns yet.</h3><p>Start with a brief in the Art Director, or create one here from scratch.</p><button className="btn btn--solid" style={{ marginTop: 14 }} onClick={() => setCreateOpen(true)}><Plus size={11} /> CREATE A CAMPAIGN</button></div>
        )}
      </div>

      <CreateCampaignModal open={createOpen} onClose={() => setCreateOpen(false)} onCreate={(c) => { addCampaign(c); setSelectedId(c.id); setCreateOpen(false) }} />
      <SlotDrawer
        open={detailOpen}
        slot={selectedSlot}
        campaign={selected}
        onClose={() => setDetailOpen(false)}
        onGenerate={() => selectedSlot && enqueueSlot(selectedSlot)}
        onRegenerate={() => selectedSlot && enqueueSlot(selectedSlot)}
        onClear={() => selectedSlot && clearSlot(selectedSlot)}
        onToggleLock={() => selectedSlot && selected && updateCampaignSlot(selected.id, selectedSlot.id, { locked: !selectedSlot.locked })}
        onReplace={() => { setDetailOpen(false); setAttachSlot(selectedSlot) }}
        onDarkroom={(id) => { setFocusAsset(id); navigate('darkroom') }}
      />
      <AttachModal campaign={selected} slot={attachSlot} onClose={() => setAttachSlot(null)} onAttach={(assetId) => {
        if (selected && attachSlot) {
          attachAsset(selected.id, attachSlot.id, assetId)
          toast('Plate placed', `${selected.title} / ${attachSlot.label}.`, 'success')
        }
        setAttachSlot(null)
      }} />
    </div>
  )
}

function CreateCampaignModal({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (c: Campaign) => void }) {
  const briefs = useApp((s) => s.briefs)
  const latest = briefs[0]
  const [title, setTitle] = useState(latest?.title ?? 'NEW CAMPAIGN')
  const [brand, setBrand] = useState(latest?.title ?? 'CAMPAIGN 04')
  const [season, setSeason] = useState('Independent / 2026')
  const [concept, setConcept] = useState(latest?.idea ?? 'A campaign about the distance between a memory and the photograph that preserved it.')
  const [styleId, setStyleId] = useState(latest?.styleId ?? 'american-archive')
  const [copy, setCopy] = useState(latest?.copy[0]?.replace(/[“”]/g, '') ?? 'Wear it like a memory.')
  const style = STYLE_MAP[styleId] ?? STYLE_PRESETS[0]

  const create = () => {
    const brief = generateBrief({ idea: concept, styleId, controls: latest?.controls, seed: Math.floor(Math.random() * 999999) })
    const campaign: Campaign = {
      id: uid('cmp'),
      title: title.toUpperCase(),
      brand: brand.toUpperCase(),
      season,
      concept,
      styleId,
      palette: style.palette,
      typography: style.typography,
      copy,
      prompt: brief.prompt,
      negative: brief.negative,
      seed: Math.floor(Math.random() * 900000),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'draft',
      assets: SLOTS.map(([slot, label, description], i) => ({
        id: uid('ca'),
        slot,
        label,
        description,
        prompt: `${style.promptCore}, ${label.toLowerCase()}, campaign image ${i + 1}`,
        status: 'empty' as const,
        locked: false,
      })),
    }
    onCreate(campaign)
  }

  return (
    <Modal open={open} onClose={onClose} eyebrow="NEW CAMPAIGN / CONTINUITY" title="Build a world" width={820} footer={<><span className="mono-xs muted">{SLOTS.length} empty asset slots · prompt generated from the chosen direction</span><button className="btn btn--ghost btn--sm" onClick={onClose}>CANCEL</button><button className="btn btn--solid btn--sm" onClick={create}>CREATE CAMPAIGN</button></>}>
      <div className="form-grid">
        <div className="field"><label>TITLE</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="field"><label>BRAND</label><input className="input" value={brand} onChange={(e) => setBrand(e.target.value)} /></div>
        <div className="field"><label>SEASON</label><input className="input" value={season} onChange={(e) => setSeason(e.target.value)} /></div>
        <div className="field"><label>VISUAL DIRECTION</label>
          <select className="select" value={styleId} onChange={(e) => setStyleId(e.target.value)}>
            {[...STYLE_PRESETS].map((s) => <option key={s.id} value={s.id}>{s.name} — {s.family}</option>)}
          </select>
        </div>
        <div className="field form-span"><label>CONCEPT / IDEA</label><textarea className="textarea" rows={4} value={concept} onChange={(e) => setConcept(e.target.value)} /></div>
        <div className="field form-span"><label>COPY LINE</label><input className="input" value={copy} onChange={(e) => setCopy(e.target.value)} /></div>
      </div>
      <div className="create-preview">
        <Swatches palette={style.palette} size={22} labels />
        <p>{style.blurb}</p>
        <div className="create-deliverables">{DELIVERABLE_SETS.campaign.map((d) => <span key={d} className="chip">{d}</span>)}</div>
      </div>
    </Modal>
  )
}

function SlotDrawer({ open, slot, campaign, onClose, onGenerate, onRegenerate, onClear, onToggleLock, onReplace, onDarkroom }: {
  open: boolean
  slot: CampaignAsset | null
  campaign?: Campaign
  onClose: () => void
  onGenerate: () => void
  onRegenerate: () => void
  onClear: () => void
  onToggleLock: () => void
  onReplace: () => void
  onDarkroom: (id: string) => void
}) {
  const assets = useApp((s) => s.assets)
  const asset = assets.find((a) => a.id === slot?.assetId)
  if (!slot || !campaign) return null
  return (
    <Drawer open={open} onClose={onClose} eyebrow={`${campaign.title} / SLOT`} title={slot.label} footer={
      <>
        <button className="btn btn--solid btn--sm" onClick={onGenerate}>{slot.assetId ? <RefreshCw size={11} /> : <Wand2 size={11} />} {slot.assetId ? 'REGENERATE' : 'GENERATE'}</button>
        <button className="btn btn--ghost btn--sm" onClick={onToggleLock}>{slot.locked ? <Unlock size={11} /> : <Lock size={11} />} {slot.locked ? 'UNLOCK' : 'LOCK'}</button>
      </>
    }>
      {asset ? <ImagePlate src={asset.src} alt={slot.label} ratio="3 / 4" caption={`${campaign.title} / ${slot.label.toUpperCase()}`} /> : <div className="empty"><h3>Empty slot</h3><p>Generate a new plate, or choose one from the archive.</p></div>}
      <p className="drawer-lede">{slot.description}</p>
      <div className="detail-list">
        <div className="kv"><span>Status</span><span>{slot.status}</span></div>
        <div className="kv"><span>Locked</span><span>{slot.locked ? 'yes' : 'no'}</span></div>
        <div className="kv"><span>Asset</span><span>{asset?.title ?? 'none'}</span></div>
        <div className="kv"><span>Direction</span><span>{STYLE_MAP[campaign.styleId]?.name ?? campaign.styleId}</span></div>
      </div>
      <div className="style-drawer-block">
        <div className="block-label">SLOT PROMPT</div>
        <p className="detail-prompt">{slot.prompt}</p>
        <CopyButton text={slot.prompt} label="COPY" />
      </div>
      <div className="drawer-tool-row">
        <button className="btn btn--ghost btn--sm" onClick={onReplace}><ImagePlus size={11} /> ARCHIVE PLATE</button>
        {asset && <button className="btn btn--ghost btn--sm" onClick={() => onDarkroom(asset.id)}><Aperture size={11} /> DARKROOM</button>}
        {asset && <button className="btn btn--ghost btn--sm" onClick={onClear}><CircleSlash size={11} /> CLEAR</button>}
      </div>
    </Drawer>
  )
}

function AttachModal({ campaign, slot, onClose, onAttach }: { campaign?: Campaign; slot: CampaignAsset | null; onClose: () => void; onAttach: (id: string) => void }) {
  const assets = useApp((s) => s.assets)
  return (
    <Modal open={!!slot} onClose={onClose} eyebrow={campaign?.title ?? 'CAMPAIGN'} title={`Choose a plate for ${slot?.label ?? 'slot'}`} width={980} footer={<><span className="mono-xs muted">The plate will be locked into the slot.</span><button className="btn btn--ghost btn--sm" onClick={onClose}>CANCEL</button></>}>
      <div className="attach-grid">
        <UploadPlate label="UPLOAD FROM LAPTOP" onPicked={(a) => onAttach(a.id)} />
        {assets.filter((a) => a.kind !== 'layout' || a.source === 'seed').slice(0, 40).map((a) => (
          <button key={a.id} className="attach-pick" onClick={() => onAttach(a.id)}>
            <ImagePlate src={a.src} alt={a.title} ratio="1 / 1" />
            <span>{a.title}</span>
          </button>
        ))}
      </div>
    </Modal>
  )
}
