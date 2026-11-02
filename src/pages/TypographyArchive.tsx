import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Upload, Download, Type, ArrowUpRight, Check, AlignLeft, AlignCenter, AlignRight,
  RotateCcw, Sparkles, Send, FileType2, Layers,
} from 'lucide-react'
import { PageHeader, Slider, SectionHead, CopyButton } from '../components/UI'
import { useApp, uid } from '../lib/store'
import { FONT_LIBRARY, FONT_PAIRINGS } from '../lib/presets'
import { canvasToBlob, downloadBlob, loadStoredFonts, saveFontFile } from '../lib/imageStore'

interface FontEntry {
  name: string
  css: string
  category: string
  note: string
  custom?: boolean
}

const FALLBACK_STACK = 'Georgia, serif'

function stackFor(name: string, fonts: FontEntry[]) {
  const entry = fonts.find((f) => f.name === name)
  return entry?.css ?? `'${name}', ${FALLBACK_STACK}`
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

export function TypographyArchive() {
  const assets = useApp((s) => s.assets)
  const typePairing = useApp((s) => s.typePairing)
  const setTypePairing = useApp((s) => s.setTypePairing)
  const addExport = useApp((s) => s.addExport)
  const toast = useApp((s) => s.toast)
  const navigate = useApp((s) => s.navigate)

  const [customFonts, setCustomFonts] = useState<string[]>([])
  const [displayFont, setDisplayFont] = useState(typePairing?.display ?? FONT_LIBRARY[0].name)
  const [bodyFont, setBodyFont] = useState(typePairing?.body ?? FONT_LIBRARY[2].name)
  const [sample, setSample] = useState('A photograph is a way of keeping something that has already happened.')
  const [size, setSize] = useState(74)
  const [tracking, setTracking] = useState(-1)
  const [leading, setLeading] = useState(1.02)
  const [weight, setWeight] = useState(500)
  const [align, setAlign] = useState<'left' | 'center' | 'right'>('left')
  const [uppercase, setUppercase] = useState(false)
  const [italic, setItalic] = useState(false)
  const [ink, setInk] = useState('#171512')
  const [paper, setPaper] = useState('#efe8d8')
  const [accent, setAccent] = useState('#9b5e63')
  const [mode, setMode] = useState<'duo' | 'display' | 'body'>('duo')
  const [search, setSearch] = useState('')
  const [working, setWorking] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadStoredFonts().then((fonts) => setCustomFonts(fonts.map((f) => f.name))).catch(() => {})
  }, [])

  const allFonts: FontEntry[] = useMemo(() => [
    ...FONT_LIBRARY.map((f) => ({ ...f })),
    ...customFonts.map((name) => ({
      name,
      css: `'${name}', ${FALLBACK_STACK}`,
      category: 'Uploaded',
      note: 'A local typeface stored in this browser and re-registered on every visit.',
      custom: true,
    })),
  ], [customFonts])

  const displayStack = stackFor(displayFont, allFonts)
  const bodyStack = stackFor(bodyFont, allFonts)
  const filteredFonts = allFonts.filter((f) => !search || `${f.name} ${f.category} ${f.note}`.toLowerCase().includes(search.toLowerCase()))
  const pairingLabel = `${displayFont} / ${bodyFont}`

  const uploadFont = async (file?: File | null) => {
    if (!file) return
    if (!/\.(woff2?|ttf|otf)$/i.test(file.name)) {
      toast('Unsupported file', 'Upload a .woff2, .woff, .ttf or .otf typeface.', 'error')
      return
    }
    try {
      const buffer = await file.arrayBuffer()
      const name = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim()
      const face = new FontFace(name, buffer)
      await face.load()
      document.fonts.add(face)
      await saveFontFile(name, buffer)
      setCustomFonts((names) => names.includes(name) ? names : [...names, name])
      setDisplayFont(name)
      toast('Typeface installed', `${name} is available in the archive and stored locally.`, 'success')
    } catch {
      toast('Could not install the font', 'The file may be damaged or the browser may have refused it.', 'error')
    }
  }

  const applyPairing = () => {
    setTypePairing({ display: displayFont, body: bodyFont, note: `${displayFont} / ${bodyFont}` })
    toast('Type pairing saved', `${displayFont} and ${bodyFont} now set the studio default.`, 'success')
  }

  const sendToEditorial = () => {
    setTypePairing({ display: displayFont, body: bodyFont, note: `${displayFont} / ${bodyFont}` })
    toast('Sent to the Editorial Lab', 'The next layout will open with this pairing.', 'success')
    navigate('editorial')
  }

  const resetSpecimen = () => {
    setSize(74)
    setTracking(-1)
    setLeading(1.02)
    setWeight(500)
    setAlign('left')
    setUppercase(false)
    setItalic(false)
    setInk('#171512')
    setPaper('#efe8d8')
    setAccent('#9b5e63')
  }

  const exportSpecimen = async () => {
    setWorking(true)
    try {
      await document.fonts.ready
      const W = 1600
      const H = 2200
      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = paper
      ctx.fillRect(0, 0, W, H)
      const margin = 110
      ctx.fillStyle = ink
      ctx.textBaseline = 'top'
      ctx.font = `11px 'IBM Plex Mono', monospace`
      ctx.fillText('CAMPAIGN 04 / TYPE SPECIMEN / 001', margin, 64)
      ctx.textAlign = 'right'
      ctx.fillText(pairingLabel.toUpperCase(), W - margin, 64)
      ctx.textAlign = 'left'
      ctx.strokeStyle = 'rgba(23,21,18,0.3)'
      ctx.beginPath()
      ctx.moveTo(margin, 96)
      ctx.lineTo(W - margin, 96)
      ctx.stroke()
      ctx.fillStyle = accent
      ctx.font = `10px 'IBM Plex Mono', monospace`
      ctx.fillText(`${displayFont.toUpperCase()} / DISPLAY`, margin, 128)
      ctx.fillStyle = ink
      ctx.font = `500 260px ${displayStack}`
      ctx.fillText('Aa', margin - 8, 160)
      ctx.font = `14px 'IBM Plex Mono', monospace`
      ctx.fillStyle = 'rgba(23,21,18,0.6)'
      ctx.fillText('ABCDEFGHIJKLMNOPQRSTUVWXYZ', margin, 500)
      ctx.fillText('abcdefghijklmnopqrstuvwxyz 0123456789', margin, 524)
      ctx.fillText('.,:;!? & @ # £ $ % — “ ” ( )', margin, 548)

      ctx.fillStyle = ink
      const headline = uppercase ? sample.toUpperCase() : sample
      const displaySize = 96
      ctx.font = `${italic ? 'italic ' : ''}${weight} ${displaySize}px ${displayStack}`
      const lines = wrapLines(ctx, headline, W - margin * 2)
      let y = 640
      lines.slice(0, 4).forEach((line) => {
        ctx.fillText(line, margin, y)
        y += displaySize * 1.02
      })

      ctx.strokeStyle = 'rgba(23,21,18,0.25)'
      ctx.beginPath()
      ctx.moveTo(margin, 1120)
      ctx.lineTo(W - margin, 1120)
      ctx.stroke()
      ctx.fillStyle = accent
      ctx.font = `10px 'IBM Plex Mono', monospace`
      ctx.fillText(`${bodyFont.toUpperCase()} / BODY`, margin, 1152)
      ctx.fillStyle = ink
      ctx.font = `400 28px ${bodyStack}`
      const bodyCopy = 'The image is not the memory. The image is the argument you make about the memory. Set it small, set it with air, and let the reader arrive at the feeling without being told what to feel.'
      const bodyLines = wrapLines(ctx, bodyCopy, W - margin * 2)
      bodyLines.forEach((line, i) => ctx.fillText(line, margin, 1200 + i * 42))

      ctx.font = `italic 22px ${bodyStack}`
      ctx.fillStyle = 'rgba(23,21,18,0.7)'
      ctx.fillText('An archive of almost. Photographed at home, between one life and the next.', margin, 1200 + bodyLines.length * 42 + 26)

      ctx.fillStyle = ink
      ctx.font = `10px 'IBM Plex Mono', monospace`
      ctx.fillText('THE PAIRING', margin, 1660)
      ctx.font = `500 62px ${displayStack}`
      ctx.fillText(displayFont, margin, 1700)
      ctx.font = `11px 'IBM Plex Mono', monospace`
      ctx.fillStyle = 'rgba(23,21,18,0.6)'
      ctx.fillText('DISPLAY / HEADLINES / WORDMARK', margin, 1778)
      ctx.fillStyle = ink
      ctx.font = `400 44px ${bodyStack}`
      ctx.fillText(bodyFont, margin, 1826)
      ctx.font = `11px 'IBM Plex Mono', monospace`
      ctx.fillStyle = 'rgba(23,21,18,0.6)'
      ctx.fillText('BODY / EDITORIAL / CAPTIONS', margin, 1884)

      ctx.fillStyle = accent
      ctx.fillRect(margin, 1970, 160, 2)
      ctx.fillStyle = ink
      ctx.font = `10px 'IBM Plex Mono', monospace`
      ctx.fillText(`SET IN ${displayFont.toUpperCase()} AND ${bodyFont.toUpperCase()}`, margin, 1996)
      ctx.textAlign = 'right'
      ctx.fillText('CAMPAIGN 04 / VOL. 001 / 2026', W - margin, 1996)
      ctx.textAlign = 'left'
      ctx.fillStyle = 'rgba(23,21,18,0.45)'
      ctx.font = `9px 'IBM Plex Mono', monospace`
      ctx.fillText('This specimen was rendered from the fonts currently loaded in the browser.', margin, 2090)

      const blob = await canvasToBlob(canvas, 'image/png')
      const name = `campaign04-type-specimen-${displayFont.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`
      downloadBlob(blob, name)
      addExport({ id: uid('exp'), name, format: 'PNG', width: W, height: H, createdAt: Date.now() })
      toast('Specimen exported', 'A 1600 × 2200 PNG is on your desktop.', 'success')
    } catch (err) {
      toast('Export failed', err instanceof Error ? err.message : 'The specimen could not be rendered.', 'error')
    } finally {
      setWorking(false)
    }
  }

  const specimenStyle = {
    background: paper,
    color: ink,
    fontFamily: bodyStack,
  }

  return (
    <div className="page type-archive">
      <PageHeader
        index="13"
        kicker="TYPE / TYPOGRAPHY ARCHIVE"
        title={<>THE TYPE <span className="ital">ARCHIVE</span></>}
        description="A working type library: seven studio faces, local uploads, live specimens and six editorial pairings. Choose a pairing, set the measure, and send it to the layout bench as a real default."
        actions={
          <>
            <button className="btn btn--ghost" onClick={() => fileRef.current?.click()}><Upload size={12} /> UPLOAD TYPEFACE</button>
            <button className="btn btn--ghost" onClick={applyPairing} disabled={!displayFont || !bodyFont}><Check size={12} /> SET AS STUDIO PAIRING</button>
            <button className="btn btn--solid" onClick={sendToEditorial}><Send size={12} /> SEND TO EDITORIAL</button>
          </>
        }
        meta={<div className="page-meta"><span>{allFonts.length} typefaces</span><span>{FONT_PAIRINGS.length} pairings</span><span>{pairingLabel}</span><span>{typePairing ? 'studio pairing live' : 'pairing not set'}</span></div>}
      />

      <input
        ref={fileRef}
        type="file"
        accept=".woff2,.woff,.ttf,.otf"
        style={{ display: 'none' }}
        onChange={(e) => { uploadFont(e.target.files?.[0]); e.target.value = '' }}
      />

      <div className="type-layout">
        <aside className="type-rail">
          <div className="type-rail-head">
            <span className="mono-xs">TYPE LIBRARY</span>
            <span className="mono-xs muted">{filteredFonts.length}</span>
          </div>
          <label className="search type-search">
            <Type size={11} />
            <input className="input" placeholder="Search the archive" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <div className="type-font-list">
            {filteredFonts.map((f) => (
              <div key={f.name} className={`type-font-card ${displayFont === f.name ? 'active' : ''}`}>
                <button className="type-font-main" onClick={() => setDisplayFont(f.name)}>
                  <span className="type-font-aa" style={{ fontFamily: f.css }}>Aa</span>
                  <span className="type-font-meta">
                    <strong>{f.name}</strong>
                    <span>{f.category}</span>
                  </span>
                  {f.custom && <span className="chip">LOCAL</span>}
                </button>
                <div className="type-font-actions">
                  <button className={displayFont === f.name ? 'active' : ''} onClick={() => setDisplayFont(f.name)}>DISPLAY</button>
                  <button className={bodyFont === f.name ? 'active' : ''} onClick={() => setBodyFont(f.name)}>BODY</button>
                </div>
              </div>
            ))}
          </div>
          <div
            className="type-drop"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('is-dragging') }}
            onDragLeave={(e) => e.currentTarget.classList.remove('is-dragging')}
            onDrop={(e) => {
              e.preventDefault()
              e.currentTarget.classList.remove('is-dragging')
              uploadFont(e.dataTransfer.files?.[0])
            }}
          >
            <Upload size={14} />
            <strong>DROP A TYPEFACE</strong>
            <span>woff2 / woff / ttf / otf · stored in this browser</span>
          </div>
          <p className="mini-note">Uploaded fonts live in IndexedDB and are re-registered when the studio opens. They are not uploaded to a server.</p>
        </aside>

        <section className="type-stage">
          <div className="type-stage-bar">
            <div>
              <span className="mono-xs accent">LIVE SPECIMEN</span>
              <span className="mono-xs muted" style={{ marginLeft: 14 }}>{pairingLabel}</span>
            </div>
            <div className="stage-tools">
              <CopyButton text={sample} label="COPY TEXT" />
              <button className="icon-btn tooltip" data-tip="Reset specimen" onClick={resetSpecimen}><RotateCcw size={12} /></button>
            </div>
          </div>

          <div className="specimen-paper" style={specimenStyle}>
            <div className="specimen-top">
              <span>CAMPAIGN 04 / TYPE SPECIMEN / 001</span>
              <span style={{ color: accent }}>{pairingLabel.toUpperCase()}</span>
            </div>
            <div className="specimen-display">
              {mode !== 'body' && (
                <>
                  <div className="specimen-aa" style={{ fontFamily: displayStack, fontWeight: weight, fontStyle: italic ? 'italic' : 'normal', color: accent }}>Aa</div>
                  <div
                    className="specimen-headline"
                    style={{
                      fontFamily: displayStack,
                      fontSize: `clamp(34px, ${Math.max(2.6, size / 12)}vw, ${size * 1.5}px)`,
                      letterSpacing: `${tracking}px`,
                      lineHeight: leading,
                      fontWeight: weight,
                      textTransform: uppercase ? 'uppercase' : 'none',
                      fontStyle: italic ? 'italic' : 'normal',
                      textAlign: align,
                    }}
                  >
                    {sample || 'Type something worth setting.'}
                  </div>
                </>
              )}
              {mode === 'body' && (
                <div
                  className="specimen-body-only"
                  style={{ fontFamily: bodyStack, fontSize: `${Math.max(16, size / 3)}px`, lineHeight: leading + 0.22, textAlign: align }}
                >
                  {sample || 'Type something worth setting.'}
                </div>
              )}
            </div>
            <div className="specimen-rule" style={{ background: ink, opacity: 0.22 }} />
            <div className="specimen-lower">
              <div>
                <span className="specimen-label" style={{ color: accent }}>{bodyFont.toUpperCase()} / BODY</span>
                <p style={{ fontFamily: bodyStack }}>
                  The image is not the memory. The image is the argument you make about the memory. Set it small, set it with air,
                  and let the reader arrive at the feeling without being told what to feel.
                </p>
                <p className="specimen-italic" style={{ fontFamily: bodyStack }}>
                  An archive of almost. Photographed at home, between one life and the next.
                </p>
              </div>
              <div className="specimen-alphabet" style={{ fontFamily: displayStack }}>
                <span>ABCDEFGHIJKLMNOPQRSTUVWXYZ</span>
                <span>abcdefghijklmnopqrstuvwxyz</span>
                <span>0123456789 .,:;!? &amp; @ # £ $ % —</span>
              </div>
            </div>
            <div className="specimen-foot">
              <span>SET IN {displayFont.toUpperCase()} AND {bodyFont.toUpperCase()}</span>
              <span>CAMPAIGN 04 / VOL. 001 / 2026</span>
            </div>
          </div>

          <div className="type-stage-foot">
            <div><span className="mono-xs">DISPLAY</span><strong>{displayFont}</strong></div>
            <div><span className="mono-xs">BODY</span><strong>{bodyFont}</strong></div>
            <div><span className="mono-xs">SIZE</span><strong>{size} px</strong></div>
            <div><span className="mono-xs">TRACKING</span><strong>{tracking} px</strong></div>
            <div><span className="mono-xs">LEADING</span><strong>{leading.toFixed(2)}</strong></div>
            <button className="btn btn--ghost btn--sm" style={{ marginLeft: 'auto' }} onClick={exportSpecimen} disabled={working}><Download size={11} /> {working ? 'RENDERING…' : 'EXPORT SPECIMEN'}</button>
          </div>
        </section>

        <aside className="type-inspector">
          <div className="type-inspector-head">
            <span className="mono-xs">SPECIMEN / CONTROLS</span>
            <span className="mono-xs muted">LIVE</span>
          </div>

          <div className="type-block">
            <div className="block-label">01 / PAIRING</div>
            <div className="field"><label>DISPLAY FACE</label>
              <select className="select" value={displayFont} onChange={(e) => setDisplayFont(e.target.value)}>
                {allFonts.map((f) => <option key={f.name} value={f.name}>{f.name} — {f.category}</option>)}
              </select>
            </div>
            <div className="field"><label>BODY FACE</label>
              <select className="select" value={bodyFont} onChange={(e) => setBodyFont(e.target.value)}>
                {allFonts.map((f) => <option key={f.name} value={f.name}>{f.name} — {f.category}</option>)}
              </select>
            </div>
            <button className="btn btn--ghost btn--sm btn--wide" onClick={applyPairing}><Check size={11} /> SAVE AS STUDIO PAIRING</button>
          </div>

          <div className="type-block">
            <div className="block-label">02 / SAMPLE</div>
            <textarea className="textarea" rows={4} value={sample} onChange={(e) => setSample(e.target.value)} />
            <div className="seg type-mode">
              <button className={mode === 'duo' ? 'active' : ''} onClick={() => setMode('duo')}>DUO</button>
              <button className={mode === 'display' ? 'active' : ''} onClick={() => setMode('display')}>DISPLAY</button>
              <button className={mode === 'body' ? 'active' : ''} onClick={() => setMode('body')}>BODY</button>
            </div>
          </div>

          <div className="type-block">
            <div className="block-label">03 / MEASURE</div>
            <Slider label="Display size" value={size} min={28} max={160} onChange={setSize} low="whisper" high="shout" />
            <Slider label="Tracking" value={tracking} min={-5} max={24} onChange={setTracking} low="tight" high="wide" />
            <Slider label="Leading" value={leading} min={0.78} max={2} step={0.02} onChange={setLeading} format={(v) => v.toFixed(2)} low="stacked" high="airy" />
            <Slider label="Weight" value={weight} min={300} max={800} step={100} onChange={setWeight} />
            <div className="seg type-align">
              <button className={align === 'left' ? 'active' : ''} onClick={() => setAlign('left')}><AlignLeft size={12} /> LEFT</button>
              <button className={align === 'center' ? 'active' : ''} onClick={() => setAlign('center')}><AlignCenter size={12} /> CENTRE</button>
              <button className={align === 'right' ? 'active' : ''} onClick={() => setAlign('right')}><AlignRight size={12} /> RIGHT</button>
            </div>
            <div className="type-checks">
              <label className="check"><input type="checkbox" checked={uppercase} onChange={(e) => setUppercase(e.target.checked)} /> UPPERCASE</label>
              <label className="check"><input type="checkbox" checked={italic} onChange={(e) => setItalic(e.target.checked)} /> ITALIC</label>
            </div>
          </div>

          <div className="type-block">
            <div className="block-label">04 / INK & PAPER</div>
            <div className="colour-row">
              <label>INK<input type="color" value={ink} onChange={(e) => setInk(e.target.value)} /></label>
              <label>PAPER<input type="color" value={paper} onChange={(e) => setPaper(e.target.value)} /></label>
              <label>ACCENT<input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} /></label>
            </div>
            <button className="mini-link" style={{ marginTop: 10 }} onClick={() => { setInk(paper); setPaper(ink) }}>INVERT INK & PAPER <ArrowUpRight size={10} /></button>
          </div>

          <div className="type-block type-block--last">
            <button className="btn btn--accent btn--wide" onClick={exportSpecimen} disabled={working}><Download size={12} /> EXPORT SPECIMEN</button>
            <button className="btn btn--ghost btn--sm btn--wide" onClick={sendToEditorial}><Layers size={11} /> USE IN THE EDITORIAL LAB</button>
            <p className="desk-note">Specimens render at 1600 × 2200 px from the fonts loaded in this browser. Uploaded fonts must remain available on this device.</p>
          </div>
        </aside>
      </div>

      <section className="section">
        <SectionHead index="14" title="Editorial pairings" link={<span className="mono-xs muted">SIX STARTING POSITIONS</span>} />
        <div className="pairing-grid">
          {FONT_PAIRINGS.map((p) => {
            const active = displayFont === p.display && bodyFont === p.body
            return (
              <button key={`${p.display}-${p.body}`} className={`pairing-card ${active ? 'active' : ''}`} onClick={() => {
                setDisplayFont(p.display)
                setBodyFont(p.body)
                setTypePairing({ display: p.display, body: p.body, note: p.note })
                toast('Pairing loaded', `${p.display} / ${p.body}.`, 'success')
              }}>
                <div className="pairing-types">
                  <span style={{ fontFamily: stackFor(p.display, allFonts) }}>Aa</span>
                  <span style={{ fontFamily: stackFor(p.body, allFonts) }}>Aa</span>
                </div>
                <h3>{p.display} <i>/</i> {p.body}</h3>
                <p>{p.note}</p>
                <span className="mono-xs muted">{p.use}</span>
                {active && <b className="pairing-active"><Check size={10} /> IN USE</b>}
              </button>
            )
          })}
        </div>
      </section>

      <section className="section type-anatomy-section">
        <SectionHead index="15" title="Anatomy of a decision" />
        <div className="type-anatomy-grid">
          {[
            { n: '01', t: 'The display face is a gesture.', d: 'A cover headline is not information. It is the first physical decision the reader sees. Choose a face with a point of view, then give it room.' },
            { n: '02', t: 'The body face is infrastructure.', d: 'It should disappear into the reading. Match it to the display face by temperature, not by family. Contrast is more useful than harmony.' },
            { n: '03', t: 'Mono is evidence.', d: 'Dates, file names, seed numbers, coordinates. Technical type tells the reader that a real process took place behind the image.' },
            { n: '04', t: 'Handwriting is a witness.', d: 'Use it once per page. A note in the margin is more intimate than a paragraph of copy. Never set a whole sentence in it.' },
          ].map((a) => (
            <div key={a.n} className="type-anatomy-card">
              <span className="mono-xs accent">{a.n}</span>
              <h3>{a.t}</h3>
              <p>{a.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="type-footer">
          <FileType2 size={16} />
          <p>{allFonts.length} typefaces registered · {customFonts.length} local uploads · pairing {typePairing ? `${typePairing.display} / ${typePairing.body}` : 'not saved'}</p>
          <button className="mini-link" onClick={() => navigate('editorial')}>OPEN THE EDITORIAL LAB <Sparkles size={10} /></button>
        </div>
      </section>
    </div>
  )
}
