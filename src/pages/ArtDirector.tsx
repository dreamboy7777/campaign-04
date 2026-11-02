import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Sparkles, ArrowUpRight, CornerDownLeft, Wand2, Save, Layers, RefreshCw,
  MessageSquare, SlidersHorizontal, Check, Plus, ArrowRight,
} from 'lucide-react'
import { PageHeader, Slider, Swatches, CopyButton, SectionHead } from '../components/UI'
import { useApp, uid } from '../lib/store'
import { CONTROL_DEFS, EXAMPLE_IDEAS, STYLE_MAP, STYLE_PRESETS } from '../lib/presets'
import { controlsFromStyle, generateBrief, reviseControls, styleToPreset } from '../lib/director'
import type { Campaign, Controls, Brief } from '../lib/types'

type Msg = { id: string; role: 'director' | 'you'; text: string; notes?: string[] }

export function ArtDirector() {
  const navigate = useApp((s) => s.navigate)
  const editorDraft = useApp((s) => s.editorDraft)
  const setEditorDraft = useApp((s) => s.setEditorDraft)
  const addBrief = useApp((s) => s.addBrief)
  const addCampaign = useApp((s) => s.addCampaign)
  const updateStudio = useApp((s) => s.updateStudio)
  const toast = useApp((s) => s.toast)
  const customStyles = useApp((s) => s.customStyles)

  const initialStyle = editorDraft?.styleId && STYLE_MAP[editorDraft.styleId] ? editorDraft.styleId : 'romantic-archive'
  const [idea, setIdea] = useState(
    useApp.getState().studio.prompt ||
      'A perfume called AFTER THE RAIN. Being in love with someone you have not seen in years. Very 2006, American Photographic, French editorial, Tumblr melancholy.',
  )
  const [styleId, setStyleId] = useState(initialStyle)
  const [controls, setControls] = useState<Controls>(() => controlsFromStyle(STYLE_MAP[initialStyle] ?? STYLE_PRESETS[5]))
  const [revision, setRevision] = useState(0)
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: 'opening',
      role: 'director',
      text: 'Give me an idea in plain language. I will turn it into a full art direction — photography rules, casting, locations, light, palette, type and copy. Then we can argue about it.',
    },
  ])
  const [tab, setTab] = useState<'brief' | 'controls'>('brief')
  const [compact, setCompact] = useState(false)

  const allStyles = useMemo(() => [...STYLE_PRESETS, ...customStyles.map(styleToPreset)], [customStyles])
  const style = allStyles.find((s) => s.id === styleId) ?? STYLE_MAP['romantic-archive']

  const brief = useMemo(
    () => generateBrief({ idea, styleId, controls, revision }),
    [idea, styleId, controls, revision],
  )

  useEffect(() => {
    if (editorDraft?.styleId) {
      const s = STYLE_MAP[editorDraft.styleId]
      if (s) {
        setStyleId(s.id)
        setControls(controlsFromStyle(s))
      }
    }
  }, [editorDraft?.styleId])

  const setControl = (key: keyof Controls, value: number) => {
    setControls((c) => ({ ...c, [key]: value }))
  }

  const useStyle = (id: string) => {
    const s = allStyles.find((x) => x.id === id)
    if (!s) return
    setStyleId(id)
    setControls(controlsFromStyle(s))
    setRevision((r) => r + 1)
  }

  const send = () => {
    const text = message.trim()
    if (!text) return
    const revised = reviseControls(controls, styleId, text)
    setControls(revised.controls)
    setStyleId(revised.styleId)
    setRevision((r) => r + 1)
    setMessages((m) => [
      ...m,
      { id: uid('msg'), role: 'you', text },
      {
        id: uid('msg'),
        role: 'director',
        text: `Direction updated. ${revised.notes.length > 1 ? 'I changed the brief in several places.' : 'I made one decisive change.'} The controls on the right are now the real ones — not a suggestion.`,
        notes: revised.notes,
      },
    ])
    setMessage('')
  }

  const saveBrief = () => {
    const saved = { ...brief, id: uid('brief') }
    addBrief(saved)
    toast('Brief saved', `${saved.title} is now in the project archive.`, 'success')
  }

  const useInStudio = () => {
    updateStudio({ prompt: idea, styleId, controls, aspect: '3:4' })
    toast('Direction sent to the studio', `${style.name} / ${brief.title}.`, 'success')
    navigate('studio')
  }

  const buildCampaign = () => {
    const savedId = uid('brief')
    const briefWithId: Brief = { ...brief, id: savedId }
    addBrief(briefWithId)
    const campaign: Campaign = {
      id: uid('cmp'),
      title: brief.title,
      brand: brief.title,
      season: `${style.era} / ${style.family}`,
      concept: brief.concept,
      styleId,
      palette: brief.palette,
      typography: brief.typography,
      copy: brief.copy[0]?.replace(/[“”]/g, '') ?? brief.headlines[0],
      prompt: brief.prompt,
      negative: brief.negative,
      seed: Math.floor(Math.random() * 900000),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'draft',
      briefId: savedId,
      assets: brief.deliverables.slice(0, 6).map((label, i) => ({
        id: uid('ca'),
        slot: `slot-${i + 1}`,
        label,
        description: i === 0 ? 'The image that carries the whole campaign.' : `Campaign deliverable ${i + 1} — keep the same visual DNA.`,
        prompt: `${label}, ${style.promptCore}`,
        status: 'empty' as const,
        locked: false,
      })),
    }
    addCampaign(campaign)
    setEditorDraft({ campaignId: campaign.id, briefId: savedId, styleId })
    toast('Campaign created', `${campaign.title} has six empty slots waiting for images.`, 'success')
    navigate('campaigns')
  }

  return (
    <div className="page director-page">
      <PageHeader
        index="03"
        kicker="CREATIVE INTELLIGENCE / ART DIRECTOR"
        title={<>THE ART <span className="ital">DIRECTOR</span></>}
        description="An idea becomes a direction. Every line here is generated locally from your words, the chosen visual language and the controls — then it can be revised by conversation and sent straight into production."
        actions={
          <>
            <button className="btn btn--ghost" onClick={() => setIdea(EXAMPLE_IDEAS[Math.floor(Math.random() * EXAMPLE_IDEAS.length)])}>
              <RefreshCw size={12} /> ANOTHER IDEA
            </button>
            <button className="btn btn--solid" onClick={buildCampaign}>
              <Layers size={12} /> BUILD CAMPAIGN
            </button>
          </>
        }
      />

      <div className={`director-layout ${compact ? 'is-compact' : ''}`}>
        <aside className="director-desk">
          <div className="desk-block">
            <div className="block-label"><span>01 / THE IDEA</span><span className="mono-xs muted">{idea.length} CHR</span></div>
            <textarea className="textarea director-idea" value={idea} onChange={(e) => setIdea(e.target.value)} />
            <div className="desk-inline">
              <button className="mini-link" onClick={() => setIdea(EXAMPLE_IDEAS[(EXAMPLE_IDEAS.indexOf(idea) + 1) % EXAMPLE_IDEAS.length])}>CYCLE EXAMPLES</button>
              <button className="mini-link" onClick={() => setRevision((r) => r + 1)}><RefreshCw size={10} /> REFRESH VARIATION</button>
            </div>
          </div>

          <div className="desk-block">
            <div className="block-label"><span>02 / VISUAL LANGUAGE</span><span className="mono-xs muted">{STYLE_PRESETS.length} DIRECTIONS</span></div>
            <select className="select" value={styleId} onChange={(e) => useStyle(e.target.value)}>
              {allStyles.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.family}</option>)}
            </select>
            <div className="style-mini">
              <div>
                <div className="style-mini-name">{style.name}</div>
                <p>{style.blurb}</p>
              </div>
              <Swatches palette={style.palette} size={14} />
            </div>
          </div>

          <div className="desk-block">
            <div className="block-label">
              <span>03 / REVISION DESK</span>
              <MessageSquare size={11} />
            </div>
            <div className="director-chat">
              {messages.map((m) => (
                <div key={m.id} className={`chat-msg chat-msg--${m.role}`}>
                  <span className="chat-role">{m.role === 'you' ? 'YOU' : 'DIRECTOR'}</span>
                  <p>{m.text}</p>
                  {m.notes && (
                    <ul className="chat-notes">
                      {m.notes.map((n, i) => <li key={i}><Check size={9} /> {n}</li>)}
                    </ul>
                  )}
                </div>
              ))}
            </div>
            <div className="chat-compose">
              <textarea
                className="textarea"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    send()
                  }
                }}
                placeholder="Make it less polished. More direct flash. Shift it toward Tumblr. Reduce the colour."
                rows={3}
              />
              <button className="btn btn--solid btn--sm" onClick={send}><CornerDownLeft size={11} /> SEND</button>
            </div>
            <div className="chat-hints">
              {['more flash', 'less polish', 'closer', 'shift to zine', 'more negative space'].map((h) => (
                <button key={h} className="chip" onClick={() => { setMessage(h); }}>{h}</button>
              ))}
            </div>
          </div>

          <div className="desk-block desk-block--last">
            <div className="block-label"><span>04 / OUT</span></div>
            <button className="btn btn--accent btn--wide" onClick={useInStudio}><Wand2 size={12} /> SEND TO STUDIO</button>
            <div className="desk-two">
              <button className="btn btn--ghost btn--sm" onClick={saveBrief}><Save size={11} /> SAVE BRIEF</button>
              <CopyButton text={brief.prompt} label="COPY PROMPT" />
            </div>
            <p className="desk-note">The studio keeps your direction intact. Nothing is replaced unless you say so.</p>
          </div>
        </aside>

        <section className="director-stage">
          <div className="director-stage-bar">
            <div className="seg">
              <button className={tab === 'brief' ? 'active' : ''} onClick={() => setTab('brief')}>THE BRIEF</button>
              <button className={tab === 'controls' ? 'active' : ''} onClick={() => setTab('controls')}><SlidersHorizontal size={10} /> CONTROLS</button>
            </div>
            <div className="stage-tools">
              <span className="mono-xs muted">REV {String(revision + 1).padStart(2, '0')}</span>
              <button className="mini-link" onClick={() => setCompact(!compact)}>{compact ? 'WIDE SHEET' : 'COMPACT SHEET'}</button>
              <CopyButton text={`${brief.title}\n\n${brief.concept}\n\n${brief.copy.join('\n')}`} label="COPY BRIEF" />
            </div>
          </div>

          {tab === 'brief' ? (
            <article className="brief-sheet">
              <div className="brief-top">
                <span>CAMPAIGN 04 / ART DIRECTION</span>
                <span>BRIEF NO. {String(brief.title.length).padStart(3, '0')} · {style.era}</span>
                <span>{new Date(brief.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}</span>
              </div>

              <div className="brief-masthead">
                <div>
                  <div className="eyebrow no-rule" style={{ marginBottom: 12 }}>THE DIRECTION</div>
                  <h2 className="brief-title">{brief.title}</h2>
                  <p className="brief-subtitle">{brief.subtitle}</p>
                </div>
                <div className="brief-stamp">
                  <span>STUDIO 04</span>
                  <span>{style.index} / 20</span>
                  <span>{brief.controls.nostalgia} NOSTALGIA</span>
                </div>
              </div>

              <div className="brief-lede">
                <p>{brief.concept}</p>
                <div className="brief-palette-block">
                  <span className="mono-xs">PALETTE</span>
                  <Swatches palette={brief.palette} size={24} labels />
                </div>
              </div>

              <div className="brief-grid">
                <BriefSection label="PHOTOGRAPHY" items={brief.photography} />
                <BriefSection label="CASTING" items={brief.casting} />
                <BriefSection label="LOCATION" items={brief.location} />
                <BriefSection label="LIGHT" items={brief.lighting} />
                <BriefSection label="COMPOSITION" items={brief.composition} />
                <BriefSection label="TYPOGRAPHY" note={brief.typography.note}>
                  <div className="brief-typepair">
                    <span style={{ fontFamily: `'${brief.typography.display}', serif`, fontSize: 24 }}>{brief.title}</span>
                    <span style={{ fontFamily: `'${brief.typography.body}', sans-serif`, fontSize: 11 }}>{brief.typography.display} / {brief.typography.body}</span>
                  </div>
                </BriefSection>
              </div>

              <div className="brief-copy-block">
                <div>
                  <div className="block-label">COPY / HEADLINES</div>
                  {brief.headlines.map((h, i) => (
                    <div key={i} className="brief-headline"><span>0{i + 1}</span>{h}</div>
                  ))}
                </div>
                <div>
                  <div className="block-label">CAMPAIGN COPY</div>
                  {brief.copy.map((c, i) => <p key={i} className="brief-copy-line">{c}</p>)}
                  <div className="note" style={{ marginTop: 16 }}>one image is enough.</div>
                </div>
              </div>

              <div className="brief-deliverables">
                <div className="block-label">DELIVERABLES</div>
                <div className="deliverable-row">
                  {brief.deliverables.map((d, i) => <span key={i} className="deliverable"><b>{String(i + 1).padStart(2, '0')}</b>{d}</span>)}
                </div>
              </div>

              <div className="brief-prompt">
                <div className="block-label">PRODUCTION PROMPT</div>
                <p>{brief.prompt}</p>
                <div className="brief-prompt-actions">
                  <CopyButton text={brief.prompt} label="COPY PROMPT" />
                  <button className="btn btn--ghost btn--sm" onClick={useInStudio}><ArrowUpRight size={11} /> DEVELOP THIS</button>
                </div>
              </div>

              <div className="brief-foot">
                <span>CAMPAIGN 04 · INDEPENDENT IMAGE-MAKING STUDIO</span>
                <span>REVISION {String(revision + 1).padStart(2, '0')} · LOCAL CREATIVE ENGINE</span>
              </div>
            </article>
          ) : (
            <div className="controls-sheet">
              <div className="controls-sheet-head">
                <div>
                  <div className="eyebrow">LIVE CONTROLS / DIRECTION {style.index}</div>
                  <h2 className="controls-title">The real dials.</h2>
                  <p>Moving these changes the generated brief, the prompt and the image direction immediately. The chat above changes these same values.</p>
                </div>
                <button className="btn btn--ghost btn--sm" onClick={() => { setControls(controlsFromStyle(style)); setRevision((r) => r + 1) }}>
                  <RefreshCw size={11} /> RESET TO {style.name.toUpperCase()}
                </button>
              </div>
              <div className="controls-grid">
                {CONTROL_DEFS.map((c) => (
                  <Slider key={c.key} label={c.label} value={controls[c.key]} onChange={(v) => setControl(c.key, v)} low={c.low} high={c.high} />
                ))}
              </div>
              <div className="controls-notes">
                <div className="panel">
                  <div className="panel-head"><span className="panel-title"><span className="num">01</span> WHAT CHANGED</span></div>
                  <div className="panel-body" style={{ display: 'grid', gap: 8 }}>
                    <div className="kv"><span>Flash</span><span>{controls.flash > 62 ? 'direct, hard, unmodified' : controls.flash < 26 ? 'available light only' : 'mixed / gentle flash'}</span></div>
                    <div className="kv"><span>Distance</span><span>{controls.intimacy > 70 ? 'close enough to be intrusive' : 'respectful distance'}</span></div>
                    <div className="kv"><span>Era</span><span>{Math.round(1998 + (controls.nostalgia / 100) * 12)}</span></div>
                    <div className="kv"><span>Colour</span><span>{controls.color < 28 ? 'muted, soft contrast' : controls.color > 62 ? 'saturated, imperfect' : 'restrained'}</span></div>
                  </div>
                </div>
                <div className="panel">
                  <div className="panel-head"><span className="panel-title"><span className="num">02</span> PROMPT PREVIEW</span></div>
                  <div className="panel-body">
                    <p className="detail-prompt">{brief.prompt}</p>
                    <CopyButton text={brief.prompt} label="COPY PROMPT" />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="director-foot">
            <div>
              <span className="mono-xs">STYLE</span>
              <strong>{style.name}</strong>
            </div>
            <div>
              <span className="mono-xs">CONTROLS</span>
              <strong>{Object.values(controls).reduce((a, b) => a + b, 0)}</strong>
            </div>
            <div>
              <span className="mono-xs">HEADLINES</span>
              <strong>{brief.headlines.length}</strong>
            </div>
            <div>
              <span className="mono-xs">REVISION</span>
              <strong>{String(revision + 1).padStart(2, '0')}</strong>
            </div>
            <button className="btn btn--ghost btn--sm" onClick={buildCampaign} style={{ marginLeft: 'auto' }}>
              <Plus size={11} /> CREATE CAMPAIGN <ArrowRight size={11} />
            </button>
          </div>
        </section>
      </div>

      <section className="section">
        <SectionHead index="04" title="Brief archive" link={<span className="mono-xs muted">{useApp.getState().briefs.length} SAVED</span>} />
        <BriefArchive />
      </section>
    </div>
  )
}

function BriefSection({ label, items, note, children }: { label: string; items?: string[]; note?: string; children?: ReactNode }) {
  return (
    <div className="brief-section">
      <div className="block-label">{label}</div>
      {items && <ul>{items.map((it, i) => <li key={i}>{it}</li>)}</ul>}
      {note && <p>{note}</p>}
      {children}
    </div>
  )
}

function BriefArchive() {
  const briefs = useApp((s) => s.briefs)
  const updateStudio = useApp((s) => s.updateStudio)
  const navigate = useApp((s) => s.navigate)
  if (!briefs.length) {
    return (
      <div className="empty">
        <Sparkles size={16} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
        <h3>No saved briefs yet.</h3>
        <p>Save a direction and it will live here — with its controls, palette and production prompt intact.</p>
      </div>
    )
  }
  return (
    <div className="brief-archive">
      {briefs.map((b) => (
        <button key={b.id} className="brief-archive-card" onClick={() => {
          updateStudio({ prompt: b.idea, styleId: b.styleId, controls: b.controls })
          navigate('studio')
        }}>
          <div className="brief-archive-top"><span>{new Date(b.createdAt).toLocaleDateString('en-GB')}</span><span>REV {b.revision + 1}</span></div>
          <h3>{b.title}</h3>
          <p>{b.subtitle}</p>
          <Swatches palette={b.palette} size={12} />
          <div className="brief-archive-foot"><span>{b.deliverables.length} DELIVERABLES</span><ArrowUpRight size={11} /></div>
        </button>
      ))}
    </div>
  )
}
