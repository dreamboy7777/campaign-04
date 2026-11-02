import { useMemo, useState } from 'react'
import { Search, SlidersHorizontal, ArrowUpRight, Plus, Trash2, Wand2, X, Blend, Check } from 'lucide-react'
import { PageHeader, Drawer, Slider, Swatches, SectionHead, CopyButton, ImagePlate } from '../components/UI'
import { useApp, uid } from '../lib/store'
import { CONTROL_DEFS, STYLE_PRESETS } from '../lib/presets'
import { blendStyles, controlsFromStyle, styleToPreset } from '../lib/director'
import type { StylePreset } from '../lib/types'

export function StyleLibrary() {
  const navigate = useApp((s) => s.navigate)
  const customStyles = useApp((s) => s.customStyles)
  const addCustomStyle = useApp((s) => s.addCustomStyle)
  const removeCustomStyle = useApp((s) => s.removeCustomStyle)
  const setEditorDraft = useApp((s) => s.setEditorDraft)
  const updateStudio = useApp((s) => s.updateStudio)
  const toast = useApp((s) => s.toast)

  const [query, setQuery] = useState('')
  const [family, setFamily] = useState('All directions')
  const [selected, setSelected] = useState<StylePreset | null>(null)
  const [mixOpen, setMixOpen] = useState(false)
  const [mixIds, setMixIds] = useState<string[]>(['american-archive', 'tumblr-forever', 'id-experimental', 'indie-after-hours'])
  const [weights, setWeights] = useState<Record<string, number>>({
    'american-archive': 40,
    'tumblr-forever': 25,
    'id-experimental': 20,
    'indie-after-hours': 15,
  })

  const families = useMemo(() => ['All directions', ...Array.from(new Set(STYLE_PRESETS.map((s) => s.family)))], [])
  const filtered = STYLE_PRESETS.filter((s) => {
    const matchesFamily = family === 'All directions' || s.family === family
    const q = query.trim().toLowerCase()
    const matchesQuery = !q || `${s.name} ${s.family} ${s.era} ${s.blurb} ${s.description} ${s.photography.join(' ')} ${s.colorWords.join(' ')}`.toLowerCase().includes(q)
    return matchesFamily && matchesQuery
  })

  const apply = (preset: StylePreset) => {
    updateStudio({ styleId: preset.id, controls: controlsFromStyle(preset) })
    toast('Direction applied', `${preset.name} is now live in the studio.`, 'success')
    navigate('studio')
  }

  const develop = (preset: StylePreset) => {
    setEditorDraft({ styleId: preset.id })
    navigate('director')
  }

  const ingredients = mixIds.map((id) => ({ styleId: id, weight: weights[id] ?? 10 })).filter((i) => i.weight > 0)
  const blend = useMemo(() => (ingredients.length ? blendStyles(ingredients) : null), [mixIds, weights])
  const totalWeight = ingredients.reduce((s, i) => s + i.weight, 0)

  const toggleMix = (id: string) => {
    setMixIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id].slice(-5)))
    setWeights((w) => ({ ...w, [id]: w[id] ?? 20 }))
  }

  const saveMix = () => {
    if (!blend) return
    addCustomStyle({ ...blend, id: uid('mix') })
    toast('Style saved', `${blend.name} is now part of your library.`, 'success')
  }

  const useMix = () => {
    if (!blend) return
    const custom = { ...blend, id: uid('mix') }
    updateStudio({ styleId: custom.id, controls: custom.controls })
    addCustomStyle(custom)
    toast('Custom direction applied', `${blend.name}.`, 'success')
    navigate('studio')
  }

  return (
    <div className="page styles-page">
      <PageHeader
        index="04"
        kicker="VISUAL LANGUAGE / STYLE LIBRARY"
        title={<>THE STYLE <span className="ital">LIBRARY</span></>}
        description="Twenty complete directions — not filters. Each one carries photographic rules, lighting logic, composition, palette, type and a production prompt. Mix them into a private visual signature."
        actions={
          <>
            <button className="btn btn--ghost" onClick={() => setMixOpen(true)}><Blend size={12} /> STYLE MIXER</button>
            <button className="btn btn--solid" onClick={() => { setMixOpen(true) }}><Plus size={12} /> NEW SIGNATURE</button>
          </>
        }
        meta={
          <div className="page-meta">
            <span>{STYLE_PRESETS.length} directions</span>
            <span>{families.length - 1} families</span>
            <span>{customStyles.length} custom mixes</span>
            <span>updated 2026</span>
          </div>
        }
      />

      <div className="library-toolbar">
        <div className="search library-search">
          <Search size={13} />
          <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search style, era, lighting, colour…" />
        </div>
        <div className="family-row">
          {families.map((f) => (
            <button key={f} className={`chip ${family === f ? 'active' : ''}`} onClick={() => setFamily(f)}>{f}</button>
          ))}
        </div>
        <span className="mono-xs muted" style={{ marginLeft: 'auto' }}>{filtered.length} SHOWN</span>
      </div>

      {customStyles.length > 0 && (
        <div className="custom-strip">
          <div className="custom-strip-label"><span className="mono-xs accent">YOUR SIGNATURES</span><span className="mono-xs muted">SAVED LOCALLY</span></div>
          <div className="custom-strip-grid">
            {customStyles.map((c) => {
              const preset = styleToPreset(c)
              return (
                <div key={c.id} className="custom-card">
                  <button className="custom-card-main" onClick={() => setSelected(preset)}>
                    <div className="custom-card-head"><span className="mono-xs">{c.blurb.split(' · ')[0]}</span><span className="mono-xs muted">MIX</span></div>
                    <div className="custom-card-name">{c.name}</div>
                    <p>{c.blurb}</p>
                    <Swatches palette={c.palette} size={15} />
                  </button>
                  <div className="custom-card-foot">
                    <button className="mini-link" onClick={() => apply(preset)}>APPLY <ArrowUpRight size={10} /></button>
                    <button className="mini-link" onClick={() => { if (confirm(`Remove ${c.name}?`)) removeCustomStyle(c.id) }}><Trash2 size={10} /></button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="style-grid">
        {filtered.map((s) => (
          <StyleCard key={s.id} style={s} onOpen={() => setSelected(s)} onApply={() => apply(s)} />
        ))}
      </div>

      {!filtered.length && (
        <div className="empty" style={{ marginTop: 20 }}>
          <h3>No direction matches.</h3>
          <p>Try a broader word — “flash”, “romantic”, “2006”, “zine” — or clear the filters.</p>
          <button className="btn btn--ghost btn--sm" style={{ marginTop: 14 }} onClick={() => { setQuery(''); setFamily('All directions') }}>CLEAR FILTERS</button>
        </div>
      )}

      <section className="section">
        <SectionHead index="05" title="Anatomy of a direction" />
        <div className="anatomy-grid">
          {[
            { n: '01', t: 'Photography', d: 'How the image is made: flash, distance, grain, framing, casting. The physical facts of the picture.' },
            { n: '02', t: 'Light', d: 'The source, its hardness and what it does to the room. Light is the first decision, not a post effect.' },
            { n: '03', t: 'Composition', d: 'Where the subject sits, what is cropped, how much air the frame carries.' },
            { n: '04', t: 'Typography', d: 'A complete pairing, not a font suggestion. Display, body, scale and the behaviour of type on a page.' },
          ].map((x) => (
            <div key={x.n} className="anatomy-card">
              <span className="mono-xs accent">{x.n}</span>
              <h3>{x.t}</h3>
              <p>{x.d}</p>
            </div>
          ))}
        </div>
      </section>

      <StyleDrawer style={selected} onClose={() => setSelected(null)} onApply={apply} onDevelop={develop} />

      <Drawer open={mixOpen} onClose={() => setMixOpen(false)} eyebrow="STYLE MIXER / WEIGHTED COMBINATION" title="Make a signature" footer={
        blend ? <>
          <button className="btn btn--ghost btn--sm" onClick={saveMix}>SAVE TO LIBRARY</button>
          <button className="btn btn--solid btn--sm" onClick={useMix}>USE IN STUDIO</button>
        </> : <span className="mono-xs muted">Choose at least one direction.</span>
      }>
        <p className="drawer-lede">A mix is more than a mood board. The weights are blended into real controls, palette and a layered production prompt. Four is usually enough; five is a fight.</p>
        <div className="mixer-picker">
          {STYLE_PRESETS.map((s) => {
            const on = mixIds.includes(s.id)
            return (
              <button key={s.id} className={`mixer-pick ${on ? 'active' : ''}`} onClick={() => toggleMix(s.id)}>
                <span className="mono-xs">{s.index}</span>
                <span>{s.name}</span>
                {on ? <Check size={11} /> : <Plus size={11} />}
              </button>
            )
          })}
        </div>
        {blend && (
          <>
            <div className="mixer-preview">
              <div>
                <div className="block-label">WORKING TITLE</div>
                <h3 className="mixer-name">{blend.name}</h3>
                <p>{blend.blurb}</p>
                <Swatches palette={blend.palette} size={24} />
              </div>
              <div className="mixer-total">
                <span className="mono-xs">TOTAL WEIGHT</span>
                <strong>{totalWeight}</strong>
                <span className="mono-xs muted">{blend.ingredients.length} INGREDIENTS</span>
              </div>
            </div>
            <div className="mixer-weights">
              {blend.ingredients.map((i) => (
                <Slider
                  key={i.styleId}
                  label={`${STYLE_PRESETS.find((s) => s.id === i.styleId)?.name ?? i.styleId} · ${Math.round((i.weight / Math.max(1, totalWeight)) * 100)}%`}
                  value={i.weight}
                  onChange={(v) => setWeights((w) => ({ ...w, [i.styleId]: v }))}
                  low="whisper"
                  high="dominant"
                />
              ))}
            </div>
            <div className="mixer-controls">
              {CONTROL_DEFS.slice(0, 6).map((c) => (
                <div key={c.key} className="mixer-bar">
                  <span>{c.label}</span>
                  <div><i style={{ width: `${blend.controls[c.key]}%` }} /></div>
                  <em>{blend.controls[c.key]}</em>
                </div>
              ))}
            </div>
            <div className="mixer-prompt">
              <div className="block-label">LAYERED PROMPT</div>
              <p>{blend.promptCore}</p>
              <CopyButton text={blend.promptCore} label="COPY PROMPT" />
            </div>
          </>
        )}
      </Drawer>
    </div>
  )
}

function StyleCard({ style, onOpen, onApply }: { style: StylePreset; onOpen: () => void; onApply: () => void }) {
  return (
    <article className="style-card">
      <button className="style-card-image" onClick={onOpen}>
        <ImagePlate src={style.cover} alt={style.name} ratio="4 / 5" tag={`${style.index} / ${style.family}`} caption={style.era} />
        <span className="style-card-open">OPEN DIRECTION <ArrowUpRight size={11} /></span>
      </button>
      <div className="style-card-body">
        <div className="style-card-head">
          <h3>{style.name}</h3>
          <span className="mono-xs">{style.index}</span>
        </div>
        <p className="style-card-blurb">{style.blurb}</p>
        <div className="style-card-swatches"><Swatches palette={style.palette} size={13} /></div>
        <div className="style-card-tags">
          {style.colorWords.slice(0, 3).map((w) => <span key={w} className="chip">{w}</span>)}
          <span className="style-card-film">{style.film}</span>
        </div>
        <div className="style-card-actions">
          <button className="btn btn--ghost btn--sm" onClick={onOpen}>READ THE RULES</button>
          <button className="btn btn--solid btn--sm" onClick={onApply}>USE</button>
        </div>
      </div>
    </article>
  )
}

function StyleDrawer({ style, onClose, onApply, onDevelop }: { style: StylePreset | null; onClose: () => void; onApply: (s: StylePreset) => void; onDevelop: (s: StylePreset) => void }) {
  const { setEditorDraft } = useApp.getState()
  if (!style) return null
  return (
    <Drawer
      open={!!style}
      onClose={onClose}
      eyebrow={`${style.index} / ${style.family.toUpperCase()}`}
      title={style.name}
      footer={
        <>
          <button className="btn btn--solid btn--sm" onClick={() => onApply(style)}><Wand2 size={11} /> USE IN STUDIO</button>
          <button className="btn btn--ghost btn--sm" onClick={() => onDevelop(style)}>DEVELOP A BRIEF</button>
        </>
      }
    >
      <ImagePlate src={style.cover} alt={style.name} ratio="4 / 3" caption={`${style.era} / ${style.film}`} />
      <p className="drawer-lede">{style.description}</p>
      <div className="style-drawer-meta">
        <div><span className="mono-xs">ERA</span><strong>{style.era}</strong></div>
        <div><span className="mono-xs">FAMILY</span><strong>{style.family}</strong></div>
        <div><span className="mono-xs">FILM</span><strong>{style.film}</strong></div>
      </div>

      <div className="style-drawer-block">
        <div className="block-label">PALETTE / COLOUR WORDS</div>
        <Swatches palette={style.palette} size={30} labels />
        <div className="word-row">{style.colorWords.map((w) => <span key={w} className="chip">{w}</span>)}</div>
      </div>

      <RuleList label="PHOTOGRAPHY" items={style.photography} />
      <RuleList label="LIGHTING" items={style.lighting} />
      <RuleList label="COMPOSITION" items={style.composition} />

      <div className="style-drawer-block">
        <div className="block-label">TYPOGRAPHY</div>
        <div className="type-sample" style={{ fontFamily: `'${style.typography.display}', serif` }}>{style.name.toUpperCase()}</div>
        <p className="type-note"><b>{style.typography.display}</b> / <b>{style.typography.body}</b> — {style.typography.note}</p>
        <button className="mini-link" onClick={() => { onClose(); setEditorDraft({ styleId: style.id }); }}>SEND TO EDITORIAL <ArrowUpRight size={10} /></button>
      </div>

      <div className="style-drawer-block">
        <div className="block-label">CONTROLS</div>
        <div className="mini-controls">
          {CONTROL_DEFS.map((c) => (
            <div key={c.key} className="mixer-bar">
              <span>{c.label}</span>
              <div><i style={{ width: `${style.controls[c.key] ?? 50}%` }} /></div>
              <em>{style.controls[c.key] ?? 50}</em>
            </div>
          ))}
        </div>
      </div>

      <div className="style-drawer-block">
        <div className="block-label">PRODUCTION PROMPT</div>
        <p className="detail-prompt">{style.promptCore}</p>
        <CopyButton text={style.promptCore} label="COPY PROMPT" />
        <div className="block-label" style={{ marginTop: 16 }}>NEGATIVE</div>
        <p className="detail-prompt">{style.negative}</p>
      </div>
    </Drawer>
  )
}

function RuleList({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="style-drawer-block">
      <div className="block-label">{label}</div>
      <ul className="rule-list">{items.map((i) => <li key={i}>{i}</li>)}</ul>
    </div>
  )
}
