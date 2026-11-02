import { useMemo, useState } from 'react'
import {
  Sparkles, ArrowUpRight, Wand2, Shuffle, Plus, X, Aperture, Heart, Layers,
  RefreshCw, Copy, SlidersHorizontal, ChevronDown, ImagePlus, AlertCircle, Clock,
  Search, Library,
} from 'lucide-react'
import { useApp } from '../lib/store'
import { ImagePlate, PageHeader, Slider, Swatches, Modal, Drawer, CopyButton } from '../components/UI'
import { UploadPlate } from '../components/UploadPlate'
import { CONTROL_DEFS, DEFAULT_CONTROLS, EXAMPLE_IDEAS, STYLE_PRESETS, STYLE_MAP } from '../lib/presets'
import { generateBrief, controlsFromStyle, styleToPreset, clampControls, blendStyles } from '../lib/director'
import { dimensionsFor, MODEL_OPTIONS } from '../lib/imageProvider'
import type { Asset, Controls } from '../lib/types'

export function Studio() {
  const studio = useApp((s) => s.studio)
  const updateStudio = useApp((s) => s.updateStudio)
  const assets = useApp((s) => s.assets)
  const customStyles = useApp((s) => s.customStyles)
  const jobs = useApp((s) => s.jobs)
  const startJob = useApp((s) => s.startJob)
  const navigate = useApp((s) => s.navigate)
  const settings = useApp((s) => s.settings)
  const usage = useApp((s) => s.usage)
  const cancelJob = useApp((s) => s.cancelJob)
  const toast = useApp((s) => s.toast)
  const [controlsOpen, setControlsOpen] = useState(false)
  const [refOpen, setRefOpen] = useState(false)
  const [refQuery, setRefQuery] = useState('')
  const [attachAsset, setAttachAsset] = useState<string | null>(null)
  const [selected, setSelected] = useState<Asset | null>(null)

  const allStyles = useMemo(
    () => [...STYLE_PRESETS, ...customStyles.map(styleToPreset)],
    [customStyles],
  )
  const style = allStyles.find((s) => s.id === studio.styleId) ?? STYLE_MAP['romantic-archive']
  const history = studio.history.map((id) => assets.find((a) => a.id === id)).filter(Boolean) as Asset[]
  const references = studio.referenceIds.map((id) => assets.find((a) => a.id === id)).filter(Boolean) as Asset[]
  const shelf = useMemo(
    () => assets.filter((a) => a.kind !== 'layout' && !studio.history.includes(a.id)).slice(0, 8),
    [assets, studio.history],
  )
  const availableRefs = useMemo(() => {
    const q = refQuery.trim().toLowerCase()
    return assets
      .filter((a) => a.analysis && a.kind !== 'layout')
      .filter((a) => !q || `${a.title} ${a.collection ?? ''} ${(a.tags ?? []).join(' ')}`.toLowerCase().includes(q))
      .slice(0, 60)
  }, [assets, refQuery])
  const studioJobs = jobs.filter((j) => j.target?.kind === 'studio' || (!j.target && j.status !== 'done'))
  const active = jobs.find((j) => ['queued', 'submitting', 'waiting', 'downloading'].includes(j.status) && j.target?.kind === 'studio')

  const referencePrompt = () => {
    const notes = references
      .map((a, i) => {
        const an = a.analysis
        if (!an) return ''
        return `reference ${i + 1}: ${an.lighting}, palette ${an.palette.slice(0, 3).join(' ')}, ${an.mood.slice(0, 3).join(', ')}, ${an.composition[0]}`
      })
      .filter(Boolean)
      .join('; ')
    return notes ? `, visual reference guidance: ${notes}` : ''
  }

  const enqueue = (count = 1) => {
    if (!studio.prompt.trim()) {
      toast('Write something first', 'An idea, an object, a feeling. The studio needs a direction.', 'error')
      return
    }
    const seed = Math.floor(Math.random() * 900000)
    const brief = generateBrief({ idea: studio.prompt, styleId: studio.styleId, controls: studio.controls, seed })
    const prompt = `${brief.prompt}${referencePrompt()}`
    const dims = dimensionsFor(studio.aspect)
    const model = studio.model || settings.defaultModel
    for (let i = 0; i < count; i++) {
      startJob({
        prompt: count > 1 ? `${prompt}, variation ${i + 1} of ${count}, same visual direction` : prompt,
        negative: style.negative,
        width: dims.width,
        height: dims.height,
        model,
        styleId: style.id,
        seed: seed + i,
        target: { kind: 'studio' },
      })
    }
    useApp.getState().setUsage({ credits: Math.max(0, usage.credits - count) })
    toast(count > 1 ? `${count} plates sent to the lab` : 'Sent to the lab', `Direction: ${style.name}. The queue can take a few minutes with the free provider.`, 'success')
  }

  const surprise = () => {
    const s = STYLE_PRESETS[Math.floor(Math.random() * STYLE_PRESETS.length)]
    const idea = EXAMPLE_IDEAS[Math.floor(Math.random() * EXAMPLE_IDEAS.length)]
    updateStudio({ prompt: idea, styleId: s.id, controls: controlsFromStyle(s) })
    useApp.getState().toast('Direction selected', `${s.name} / ${s.era}.`, 'default')
  }

  const setControl = (key: keyof Controls, value: number) => {
    updateStudio({ controls: { ...studio.controls, [key]: value } })
  }

  const useStyle = (id: string) => {
    const s = allStyles.find((x) => x.id === id)
    if (!s) return
    updateStudio({ styleId: id, controls: controlsFromStyle(s) })
  }

  return (
    <div className="page studio-page">
      <PageHeader
        index="02"
        kicker="IMAGE-MAKING / THE STUDIO"
        title={<>THE <span className="ital">STUDIO</span></>}
        description="Write a direction, choose a visual language, and let the lab develop original plates. References guide the palette and light — you keep the final decision."
        actions={
          <>
            <button className="btn btn--ghost" onClick={() => navigate('director')}>
              <Sparkles size={12} /> ART DIRECTOR
            </button>
            <button className="btn btn--solid" onClick={surprise}>
              <Shuffle size={12} /> SURPRISE ME
            </button>
          </>
        }
      />

      <div className="studio-layout">
        <aside className="studio-controls">
          <div className="studio-block">
            <div className="block-label">
              <span>01 / THE IDEA</span>
              <button className="mini-link" onClick={() => navigate('director')}>DEVELOP IT <ArrowUpRight size={10} /></button>
            </div>
            <textarea
              className="textarea studio-prompt"
              value={studio.prompt}
              onChange={(e) => updateStudio({ prompt: e.target.value })}
              placeholder="A campaign for a fictional perfume called AFTER THE RAIN. Very 2006, American Apparel photography, French editorial, Tumblr melancholy."
            />
            <div className="prompt-foot">
              <span className="mono-xs">{studio.prompt.length} CHR</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="mini-link" onClick={() => updateStudio({ prompt: EXAMPLE_IDEAS[Math.floor(Math.random() * EXAMPLE_IDEAS.length)] })}>
                  TRY AN EXAMPLE
                </button>
              </div>
            </div>
          </div>

          <div className="studio-block">
            <div className="block-label">
              <span>02 / VISUAL DIRECTION</span>
              <button className="mini-link" onClick={() => navigate('styles')}>LIBRARY <ArrowUpRight size={10} /></button>
            </div>
            <select className="select" value={studio.styleId} onChange={(e) => useStyle(e.target.value)}>
              {allStyles.map((s) => (
                <option key={s.id} value={s.id}>{s.name} — {s.family}</option>
              ))}
            </select>
            <div className="style-mini">
              <div>
                <div className="style-mini-name">{style.name}</div>
                <p>{style.blurb}</p>
              </div>
              <Swatches palette={style.palette} size={14} />
            </div>
          </div>

          <div className="studio-block">
            <div className="block-label"><span>03 / FRAME</span><span className="mono-xs">{studio.aspect} / {dimensionsFor(studio.aspect).width}×{dimensionsFor(studio.aspect).height}</span></div>
            <div className="seg" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)' }}>
              {['3:4', '4:5', '2:3', '1:1', '16:9', '9:16'].map((a) => (
                <button key={a} className={studio.aspect === a ? 'active' : ''} onClick={() => updateStudio({ aspect: a })}>{a}</button>
              ))}
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label>IMAGE MODEL</label>
              <select className="select" value={studio.model} onChange={(e) => updateStudio({ model: e.target.value as typeof studio.model })}>
                {MODEL_OPTIONS.map((m) => <option key={m.id} value={m.id}>{m.label} — {m.note}</option>)}
              </select>
            </div>
          </div>

          <div className="studio-block">
            <div className="block-label">
              <span>04 / REFERENCES</span>
              <button className="mini-link" onClick={() => setRefOpen(true)}><Plus size={10} /> ADD</button>
            </div>
            <div className="ref-row">
              {references.map((r) => (
                <div key={r.id} className="ref-thumb">
                  <img src={r.src} alt={r.title} />
                  <button onClick={() => updateStudio({ referenceIds: studio.referenceIds.filter((id) => id !== r.id) })}><X size={9} /></button>
                </div>
              ))}
              <button className="ref-add" onClick={() => setRefOpen(true)}><ImagePlus size={16} /></button>
            </div>
            <p className="ref-note">References are analysed and translated into palette, light and framing guidance. They do not copy compositions.</p>
          </div>

          <div className="studio-block">
            <button className="controls-toggle" onClick={() => setControlsOpen(!controlsOpen)}>
              <span>05 / CREATIVE CONTROLS</span>
              <ChevronDown size={12} style={{ transform: controlsOpen ? 'rotate(180deg)' : undefined, transition: 'transform 200ms' }} />
            </button>
            {controlsOpen ? (
              <div className="control-grid">
                {CONTROL_DEFS.map((c) => (
                  <Slider key={c.key} label={c.label} value={studio.controls[c.key]} onChange={(v) => setControl(c.key, v)} low={c.low} high={c.high} />
                ))}
                <div style={{ display: 'flex', gap: 6, gridColumn: '1 / -1', marginTop: 4 }}>
                  <button className="btn btn--ghost btn--sm" style={{ flex: 1 }} onClick={() => updateStudio({ controls: controlsFromStyle(style) })}>
                    RESET TO STYLE
                  </button>
                  <button className="btn btn--ghost btn--sm" style={{ flex: 1 }} onClick={() => {
                    const next = { ...studio.controls }
                    const keys = Object.keys(next) as (keyof Controls)[]
                    keys.forEach((k) => (next[k] = Math.round(20 + Math.random() * 70)))
                    updateStudio({ controls: clampControls(next) })
                  }}>
                    RANDOMISE
                  </button>
                </div>
              </div>
            ) : (
              <div className="control-peek">
                {CONTROL_DEFS.slice(0, 4).map((c) => (
                  <div key={c.key}><span>{c.label}</span><i style={{ width: `${studio.controls[c.key]}%` }} /></div>
                ))}
              </div>
            )}
          </div>

          <div className="studio-generate">
            <button className="btn btn--accent btn--lg btn--wide" onClick={() => enqueue(1)} disabled={usage.credits <= 0}>
              <Wand2 size={13} /> DEVELOP PLATE
            </button>
            <button className="btn btn--ghost btn--sm" onClick={() => enqueue(4)} disabled={usage.credits < 4}>
              <Layers size={12} /> CONTACT SHEET ×4
            </button>
            <div className="generate-meta">
              <span>{usage.credits} FRAMES LEFT</span>
              <span>FREE PROVIDER / QUEUE</span>
            </div>
          </div>
        </aside>

        <section className="studio-stage">
          <div className="stage-head">
            <div>
              <div className="eyebrow">SESSION 001 / CONTACT SHEET</div>
              <h2 className="stage-title">{style.name.toUpperCase()} <span>/ {studio.aspect}</span></h2>
            </div>
            <div className="stage-tools">
              <span className="mono-xs muted">{history.length} SESSION / {assets.length.toLocaleString()} ARCHIVE</span>
              <button className="btn btn--ghost btn--sm" onClick={() => navigate('archive')}>
                <Library size={11} /> PHOTO LIBRARY
              </button>
              <button className="icon-btn tooltip" data-tip="Copied reference prompt" onClick={async () => {
                const brief = generateBrief({ idea: studio.prompt, styleId: studio.styleId, controls: studio.controls })
                await navigator.clipboard.writeText(brief.prompt + referencePrompt())
                toast('Prompt copied', 'The full direction is on your clipboard.')
              }}><Copy size={12} /></button>
            </div>
          </div>

          {active && (
            <div className="stage-progress panel">
              <div className="stage-progress-top">
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="lab-dot" />
                  <span className="mono-xs" style={{ color: 'var(--accent)' }}>
                    {active.status === 'waiting' ? `IN QUEUE / POSITION ${active.queuePosition ?? '—'}` : active.status.toUpperCase()}
                  </span>
                </div>
                <button className="mini-link" onClick={() => cancelJob(active.id)}>CANCEL</button>
              </div>
              <div className="stage-progress-prompt">{active.prompt.slice(0, 180)}…</div>
              <div className="loading-line" style={{ marginTop: 8 }} />
              <div className="stage-progress-meta">
                <span>{active.model?.toUpperCase()}</span>
                <span>{active.eta ? `ETA ${Math.ceil(active.eta / 60)} MIN` : 'DEVELOPING'}</span>
              </div>
            </div>
          )}

          {history.length ? (
            <div className="studio-results">
              {history.map((a, i) => (
                <div className="studio-result" key={a.id}>
                  <ImagePlate
                    src={a.src}
                    alt={a.title}
                    ratio={studio.aspect}
                    tag={a.source === 'seed' ? 'ARCHIVE PLATE' : 'STUDIO OUTPUT'}
                    caption={`${String(i + 1).padStart(2, '0')} / ${a.caption ?? a.title.toUpperCase()}`}
                    onClick={() => setSelected(a)}
                    actions={
                      <>
                        <button className="tooltip" data-tip="Develop" onClick={(e) => { e.stopPropagation(); useApp.getState().setFocusAsset(a.id); navigate('darkroom') }}><Aperture size={11} /></button>
                        <button className="tooltip" data-tip="Add to campaign" onClick={(e) => { e.stopPropagation(); setAttachAsset(a.id) }}><Layers size={11} /></button>
                        <button className="tooltip" data-tip={a.favorite ? 'Unfavourite' : 'Favourite'} onClick={(e) => { e.stopPropagation(); useApp.getState().toggleFavorite(a.id) }}><Heart size={11} fill={a.favorite ? 'currentColor' : 'none'} /></button>
                      </>
                    }
                  />
                  <div className="studio-result-meta">
                    <span>{a.title}</span>
                    <span>{a.source === 'seed' ? 'REFERENCE' : a.meta?.model ?? 'ORIGINAL'}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="stage-empty">
              <div className="stage-empty-mark">04</div>
              <h3>Nothing developed yet.</h3>
              <p>Start with an idea, or choose a direction from the library. The first plate is always the hardest.</p>
              <button className="btn btn--solid" onClick={() => enqueue(1)}><Wand2 size={12} /> DEVELOP THE FIRST PLATE</button>
            </div>
          )}

          {!!shelf.length && (
            <div className="studio-shelf">
              <div className="studio-shelf-head">
                <div>
                  <div className="eyebrow">FROM THE PHOTO LIBRARY / {assets.length.toLocaleString()} PLATES</div>
                  <h3>MORE FROM THE ARCHIVE</h3>
                </div>
                <button className="btn btn--ghost btn--sm" onClick={() => navigate('archive')}>
                  BROWSE ALL <ArrowUpRight size={10} />
                </button>
              </div>
              <div className="studio-shelf-grid">
                {shelf.map((a) => (
                  <button key={a.id} className="studio-shelf-card" onClick={() => setSelected(a)}>
                    <ImagePlate src={a.src} alt={a.title} ratio="4 / 5" tag={a.source === 'open' ? 'OPEN' : a.source === 'seed' ? 'ARCHIVE' : 'PLATE'} />
                    <span>{a.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="stage-foot">
            <div className="stage-foot-left">
              <span className="mono-xs">CURRENT PROMPT</span>
              <p>{studio.prompt}</p>
            </div>
            <div className="stage-foot-right">
              <CopyButton text={studio.prompt} label="COPY IDEA" />
              <button className="btn btn--ghost btn--sm" onClick={() => { useApp.getState().setEditorDraft({ styleId: studio.styleId }); navigate('director') }}>
                <Sparkles size={11} /> TURN INTO A BRIEF
              </button>
            </div>
          </div>
        </section>
      </div>

      <Modal open={refOpen} onClose={() => setRefOpen(false)} eyebrow="REFERENCE INTELLIGENCE" title="Add a reference" width={900} footer={<><span className="mono-xs muted">Selected references guide palette and light.</span><button className="btn btn--solid btn--sm" onClick={() => setRefOpen(false)}>DONE</button></>}>
        <div className="ref-picker-tools">
          <div className="search">
            <Search size={12} />
            <input className="input" value={refQuery} onChange={(e) => setRefQuery(e.target.value)} placeholder="Search all read plates by title, collection or tag…" />
          </div>
          <span className="mono-xs muted">{availableRefs.length} SHOWN / {assets.filter((a) => a.analysis).length} READ</span>
        </div>
        <div className="ref-picker">
          <UploadPlate
            label="UPLOAD + USE"
            onPicked={(a) => updateStudio({ referenceIds: [...studio.referenceIds, a.id].slice(-4) })}
          />
          {availableRefs.map((a) => {
            const selected = studio.referenceIds.includes(a.id)
            return (
              <button key={a.id} className={`ref-pick ${selected ? 'active' : ''}`} onClick={() => {
                const ids = selected ? studio.referenceIds.filter((id) => id !== a.id) : [...studio.referenceIds, a.id].slice(-4)
                updateStudio({ referenceIds: ids })
              }}>
                <ImagePlate src={a.src} alt={a.title} ratio="1 / 1" />
                <span>{a.title}</span>
                {selected && <b>SELECTED</b>}
              </button>
            )
          })}
        </div>
        {!availableRefs.length && (
          <div className="ref-picker-empty">
            <p>No read plates match. Bulk-imported images can be read from the archive drawer, then used here.</p>
            <button className="btn btn--ghost btn--sm" onClick={() => { setRefOpen(false); navigate('archive') }}>OPEN THE ARCHIVE</button>
          </div>
        )}
      </Modal>

      <AttachModal assetId={attachAsset} onClose={() => setAttachAsset(null)} />

      <Drawer open={!!selected} onClose={() => setSelected(null)} eyebrow="PLATE / DETAIL" title={selected?.title ?? ''} footer={
        selected && <>
          <button className="btn btn--solid btn--sm" onClick={() => { useApp.getState().setFocusAsset(selected.id); navigate('darkroom') }}><Aperture size={11} /> DEVELOP</button>
          <button className="btn btn--ghost btn--sm" onClick={() => setAttachAsset(selected.id)}><Layers size={11} /> USE IN CAMPAIGN</button>
        </>
      }>
        {selected && (
          <div>
            <ImagePlate src={selected.src} alt={selected.title} ratio="3 / 4" />
            <div style={{ marginTop: 18 }} className="detail-list">
              <div className="kv"><span>Source</span><span>{selected.source}</span></div>
              <div className="kv"><span>Collection</span><span>{selected.collection ?? '—'}</span></div>
              <div className="kv"><span>Created</span><span>{new Date(selected.createdAt).toLocaleDateString()}</span></div>
              <div className="kv"><span>Model</span><span>{selected.meta?.model ?? 'archive'}</span></div>
              <div className="kv"><span>Seed</span><span>{selected.meta?.seed ?? '—'}</span></div>
            </div>
            {selected.prompt && (
              <div style={{ marginTop: 16 }}>
                <div className="block-label">PROMPT</div>
                <p className="detail-prompt">{selected.prompt}</p>
                <CopyButton text={selected.prompt} label="COPY PROMPT" />
              </div>
            )}
            <div className="note" style={{ marginTop: 20 }}>{selected.note ?? 'keep the frame that feels wrong.'}</div>
            <div style={{ marginTop: 20 }}>
              <button className="btn btn--ghost btn--sm" onClick={() => {
                const prompt = selected.prompt ?? studio.prompt
                updateStudio({ prompt, styleId: selected.styleId ?? studio.styleId })
                setSelected(null)
                toast('Prompt recovered', 'The direction is back in the composer.')
              }}><RefreshCw size={11} /> USE AS VARIATION</button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}

function AttachModal({ assetId, onClose }: { assetId: string | null; onClose: () => void }) {
  const campaigns = useApp((s) => s.campaigns)
  const attach = useApp((s) => s.attachAsset)
  const toast = useApp((s) => s.toast)
  const available = campaigns.flatMap((c) => c.assets.filter((a) => !a.assetId || a.status === 'empty').map((a) => ({ campaign: c, slot: a })))
  return (
    <Modal open={!!assetId} onClose={onClose} eyebrow="CAMPAIGN CONTINUITY" title="Use this plate" footer={<><span className="mono-xs muted">Asset will be locked into the selected slot.</span><button className="btn btn--ghost btn--sm" onClick={onClose}>CANCEL</button></>}>
      {available.length ? (
        <div className="attach-list">
          {available.slice(0, 12).map(({ campaign, slot }) => (
            <button key={campaign.id + slot.id} className="attach-row" onClick={() => {
              if (!assetId) return
              attach(campaign.id, slot.id, assetId)
              toast('Added to campaign', `${campaign.title} / ${slot.label}.`, 'success')
              onClose()
            }}>
              <span className="mono-xs accent">{campaign.title}</span>
              <strong>{slot.label}</strong>
              <span className="mono-xs muted">{slot.status.toUpperCase()}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty"><h3>Every slot is full.</h3><p>Create another campaign or clear a slot in the campaign builder.</p></div>
      )}
    </Modal>
  )
}
