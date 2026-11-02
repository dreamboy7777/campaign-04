import { useRef, useState } from 'react'
import {
  Save, Eye, EyeOff, KeyRound, Database, Download, Upload, Trash2, RefreshCw,
  Wifi, Check, AlertTriangle, HardDrive, Cpu, Camera, Palette, Info, Shield,
  SlidersHorizontal, Sun, Moon, FileJson, Server, Sparkles,
} from 'lucide-react'
import { PageHeader, SectionHead, Swatches } from '../components/UI'
import { useApp } from '../lib/store'
import { MODEL_OPTIONS, dimensionsFor } from '../lib/imageProvider'
import { clearStoredData, downloadBlob } from '../lib/imageStore'
import type { StudioSettings } from '../lib/types'

const API = 'https://stablehorde.net/api/v2'
const CLIENT_AGENT = 'CAMPAIGN04:1.0:github.com/campaign04/studio'

export function SettingsPage() {
  const theme = useApp((s) => s.theme)
  const setTheme = useApp((s) => s.setTheme)
  const settings = useApp((s) => s.settings)
  const updateSettings = useApp((s) => s.updateSettings)
  const updateStudio = useApp((s) => s.updateStudio)
  const usage = useApp((s) => s.usage)
  const setUsage = useApp((s) => s.setUsage)
  const assets = useApp((s) => s.assets)
  const campaigns = useApp((s) => s.campaigns)
  const exports = useApp((s) => s.exports)
  const toast = useApp((s) => s.toast)
  const [keyVisible, setKeyVisible] = useState(false)
  const [test, setTest] = useState<{ state: 'idle' | 'testing' | 'ok' | 'error'; message: string; latency?: number }>({ state: 'idle', message: 'Not tested this session.' })
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const setModel = (model: StudioSettings['defaultModel']) => {
    updateSettings({ defaultModel: model })
    updateStudio({ model })
    toast('Default model set', `${MODEL_OPTIONS.find((m) => m.id === model)?.label ?? model} will open in the Studio.`)
  }

  const setAspect = (aspect: string) => {
    updateSettings({ defaultAspect: aspect })
    updateStudio({ aspect })
    const dims = dimensionsFor(aspect)
    toast('Default frame set', `${aspect} · ${dims.width} × ${dims.height} px.`)
  }

  const testConnection = async () => {
    setTest({ state: 'testing', message: 'Contacting Stable Horde…' })
    const started = performance.now()
    try {
      const res = await fetch(`${API}/status/models`, {
        headers: { apikey: settings.hordeKey.trim() || '0000000000', 'Client-Agent': CLIENT_AGENT },
      })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      const data = (await res.json()) as unknown
      const count = Array.isArray(data) ? data.length : 0
      setTest({
        state: 'ok',
        message: `Reachable. ${count ? `${count} models advertised.` : 'The service answered.'}`,
        latency: Math.round(performance.now() - started),
      })
      toast('Provider reachable', 'The image service answered.', 'success')
    } catch (err) {
      setTest({
        state: 'error',
        message: err instanceof Error ? err.message : 'The service could not be reached.',
        latency: Math.round(performance.now() - started),
      })
      toast('Provider unreachable', 'Check your connection or the key.', 'error')
    }
  }

  const backup = () => {
    const state = useApp.getState()
    const portable = state.assets.map((a) => {
      const { src, ...meta } = a
      return { ...meta, src: src.startsWith('/seed/') ? src : '' }
    })
    const payload = {
      app: 'campaign-04',
      version: 1,
      exportedAt: new Date().toISOString(),
      note: 'Generated, edited and uploaded images are stored as blobs in IndexedDB and are not included in this JSON. Use the Export Room for image files.',
      data: {
        theme: state.theme,
        settings: state.settings,
        studio: state.studio,
        assets: portable,
        references: state.references,
        campaigns: state.campaigns,
        brands: state.brands,
        projects: state.projects,
        customStyles: state.customStyles,
        briefs: state.briefs,
        blog: state.blog,
        blogPosts: state.blogPosts,
        zinePages: state.zinePages,
        exports: state.exports,
        usage: state.usage,
        typePairing: state.typePairing,
      },
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    downloadBlob(blob, `campaign04-backup-${new Date().toISOString().slice(0, 10)}.json`)
    toast('Backup exported', 'Studio metadata is in a JSON file. Image files are separate.', 'success')
  }

  const restore = async (file?: File | null) => {
    if (!file) return
    setImporting(true)
    try {
      const text = await file.text()
      const raw = JSON.parse(text) as { app?: string; data?: Record<string, unknown> }
      if (raw.app !== 'campaign-04' || !raw.data) throw new Error('This is not a CAMPAIGN 04 backup.')
      const data = raw.data
      const state = useApp.getState()
      const importedAssets = (Array.isArray(data.assets) ? data.assets : [])
        .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object' && typeof (a as { id?: unknown }).id === 'string' && typeof (a as { src?: unknown }).src === 'string' && !!(a as { src?: unknown }).src)
      const merged = [...state.assets]
      for (const a of importedAssets) {
        if (!merged.some((m) => m.id === a.id)) merged.push(a as never)
      }
      useApp.setState({
        assets: merged,
        settings: data.settings ? { ...state.settings, ...(data.settings as object) } as StudioSettings : state.settings,
        studio: data.studio ? (data.studio as never) : state.studio,
        references: Array.isArray(data.references) ? (data.references as never) : state.references,
        campaigns: Array.isArray(data.campaigns) ? (data.campaigns as never) : state.campaigns,
        brands: Array.isArray(data.brands) ? (data.brands as never) : state.brands,
        projects: Array.isArray(data.projects) ? (data.projects as never) : state.projects,
        customStyles: Array.isArray(data.customStyles) ? (data.customStyles as never) : state.customStyles,
        briefs: Array.isArray(data.briefs) ? (data.briefs as never) : state.briefs,
        blog: data.blog ? (data.blog as never) : state.blog,
        blogPosts: Array.isArray(data.blogPosts) ? (data.blogPosts as never) : state.blogPosts,
        zinePages: Array.isArray(data.zinePages) ? (data.zinePages as never) : state.zinePages,
        exports: Array.isArray(data.exports) ? (data.exports as never) : state.exports,
        usage: data.usage ? (data.usage as never) : state.usage,
        typePairing: data.typePairing as never,
      })
      if (data.theme === 'day' || data.theme === 'night') state.setTheme(data.theme)
      if (data.theme) document.documentElement.dataset.theme = data.theme as string
      toast('Backup restored', 'Metadata and portable seed plates were merged into this studio.', 'success')
    } catch (err) {
      toast('Import failed', err instanceof Error ? err.message : 'The file could not be read.', 'error')
    } finally {
      setImporting(false)
    }
  }

  const resetAll = async () => {
    if (!confirm('Reset the entire studio? Every campaign, brief, brand, zine page, export record and generated image will be removed.')) return
    if (!confirm('This cannot be undone. Save a JSON backup first if you want to keep the written material.')) return
    try {
      await clearStoredData()
    } catch {
      /* the database may already be empty */
    }
    localStorage.removeItem('campaign04-studio-v1')
    toast('Studio reset', 'Reloading from the seed archive…')
    setTimeout(() => window.location.reload(), 500)
  }

  const generated = assets.filter((a) => a.source === 'generated' || a.source === 'edited').length
  const seedCount = assets.filter((a) => a.source === 'seed').length
  const latestExport = exports[0]

  return (
    <div className="page settings-page">
      <PageHeader
        index="15"
        kicker="STUDIO CONTROLS / PROJECT SETTINGS"
        title={<>PROJECT <span className="ital">SETTINGS</span></>}
        description="Identity, image defaults, provider access, usage and the local data tools. Settings are stored in this browser; nothing here pretends to be a cloud account."
        actions={
          <>
            <button className="btn btn--ghost" onClick={backup}><FileJson size={12} /> BACKUP JSON</button>
            <button className="btn btn--ghost" onClick={() => fileRef.current?.click()} disabled={importing}><Upload size={12} /> {importing ? 'READING…' : 'IMPORT'}</button>
            <button className="btn btn--solid" onClick={testConnection} disabled={test.state === 'testing'}>
              <Wifi size={12} /> {test.state === 'testing' ? 'TESTING…' : 'TEST PROVIDER'}
            </button>
          </>
        }
        meta={<div className="page-meta"><span>{settings.name}</span><span>{settings.defaultModel} / {settings.defaultAspect}</span><span>{generated} local plates</span><span>{usage.credits} frames left</span></div>}
      />

      <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={(e) => { restore(e.target.files?.[0]); e.target.value = '' }} />

      <div className="settings-layout">
        <div className="settings-main">
          <section className="panel settings-panel">
            <div className="panel-head"><span className="panel-title"><span className="num">01</span> IDENTITY & VIEW</span><span className="mono-xs muted">LOCAL</span></div>
            <div className="panel-body">
              <div className="settings-grid">
                <div className="field">
                  <label>STUDIO NAME</label>
                  <input className="input" value={settings.name} onChange={(e) => updateSettings({ name: e.target.value })} maxLength={48} />
                  <span className="settings-help">Shown in the sidebar, the zine colophon and identity text. CAMPAIGN 04 stays the masthead.</span>
                </div>
                <div className="field">
                  <label>THEME</label>
                  <div className="theme-choice">
                    <button className={theme === 'day' ? 'active' : ''} onClick={() => setTheme('day')}><Sun size={13} /> DAY / PAPER</button>
                    <button className={theme === 'night' ? 'active' : ''} onClick={() => setTheme('night')}><Moon size={13} /> NIGHT / STUDIO</button>
                  </div>
                  <span className="settings-help">Day is an editorial desk; night is the after-hours darkroom.</span>
                </div>
              </div>
              <div className="settings-toggles">
                <label className="toggle-row">
                  <span><b>Reduce motion</b><small>Stops the page entrance, image drift and ticker. Your operating system preference is still respected separately.</small></span>
                  <input type="checkbox" checked={settings.reduceMotion} onChange={(e) => updateSettings({ reduceMotion: e.target.checked })} />
                </label>
                <label className="toggle-row">
                  <span><b>Show layout grid</b><small>A faint twelve-column guide on the page. A working aid, not a decorative texture.</small></span>
                  <input type="checkbox" checked={settings.showGrid} onChange={(e) => updateSettings({ showGrid: e.target.checked })} />
                </label>
                <label className="toggle-row">
                  <span><b>Safe mode</b><small>Asks the provider to censor unsafe output. The studio never requests NSFW generations.</small></span>
                  <input type="checkbox" checked={settings.safeMode} onChange={(e) => updateSettings({ safeMode: e.target.checked })} />
                </label>
              </div>
            </div>
          </section>

          <section className="panel settings-panel">
            <div className="panel-head"><span className="panel-title"><span className="num">02</span> IMAGE DEFAULTS</span><span className="mono-xs muted">APPLIED TO THE STUDIO NOW</span></div>
            <div className="panel-body">
              <div className="settings-grid">
                <div className="field">
                  <label>DEFAULT MODEL</label>
                  <select className="select" value={settings.defaultModel} onChange={(e) => setModel(e.target.value as StudioSettings['defaultModel'])}>
                    {MODEL_OPTIONS.map((m) => <option key={m.id} value={m.id}>{m.label} — {m.note}</option>)}
                  </select>
                  <span className="settings-help">{MODEL_OPTIONS.find((m) => m.id === settings.defaultModel)?.models.join(' · ')}</span>
                </div>
                <div className="field">
                  <label>DEFAULT FRAME</label>
                  <div className="seg settings-aspects">
                    {['3:4', '4:5', '2:3', '1:1', '16:9', '9:16'].map((a) => (
                      <button key={a} className={settings.defaultAspect === a ? 'active' : ''} onClick={() => setAspect(a)}>{a}</button>
                    ))}
                  </div>
                  <span className="settings-help">{dimensionsFor(settings.defaultAspect).width} × {dimensionsFor(settings.defaultAspect).height} px. The provider rounds to a multiple of 64.</span>
                </div>
              </div>
              <div className="settings-inline-note">
                <Camera size={13} />
                <p>The Studio opens with these defaults. Changing them here also updates the current Studio session; it does not rewrite images you have already made.</p>
              </div>
            </div>
          </section>

          <section className="panel settings-panel">
            <div className="panel-head"><span className="panel-title"><span className="num">03</span> PROVIDER / STABLE HORDE</span><span className={`settings-status ${test.state}`}><i />{test.state === 'ok' ? 'REACHABLE' : test.state === 'error' ? 'UNREACHABLE' : test.state === 'testing' ? 'TESTING' : 'NOT TESTED'}</span></div>
            <div className="panel-body">
              <div className="settings-grid">
                <div className="field">
                  <label>ANONYMOUS API KEY</label>
                  <div className="key-input">
                    <KeyRound size={12} />
                    <input className="input" type={keyVisible ? 'text' : 'password'} value={settings.hordeKey} placeholder="0000000000 (anonymous)" onChange={(e) => updateSettings({ hordeKey: e.target.value })} />
                    <button className="icon-btn" onClick={() => setKeyVisible(!keyVisible)} title={keyVisible ? 'Hide key' : 'Show key'}>{keyVisible ? <EyeOff size={11} /> : <Eye size={11} />}</button>
                  </div>
                  <span className="settings-help">Leave blank to use the anonymous key. A personal key raises queue priority. It is stored in this browser and sent only to Stable Horde.</span>
                </div>
                <div className="field">
                  <label>CONNECTION</label>
                  <button className="btn btn--ghost btn--wide" onClick={testConnection} disabled={test.state === 'testing'}>
                    <Wifi size={11} /> TEST NOW
                  </button>
                  <span className="settings-help">{test.message}{test.latency !== undefined ? ` · ${test.latency} ms` : ''}</span>
                </div>
              </div>
              <div className="model-table">
                <div className="model-row model-row--head"><span>MODE</span><span>MODELS</span><span>STEPS</span></div>
                {MODEL_OPTIONS.map((m) => (
                  <div key={m.id} className={`model-row ${settings.defaultModel === m.id ? 'active' : ''}`}>
                    <span><b>{m.label}</b><small>{m.note}</small></span>
                    <span>{m.models.join(' · ')}</span>
                    <span>{m.steps}</span>
                  </div>
                ))}
              </div>
              <div className="provider-note">
                <Shield size={14} />
                <p><b>Honest provider limits.</b> Image generation runs on a free, anonymous crowd-sourced queue. Waits of 4–10 minutes are normal, workers can fail, and the service can be unavailable. There is no uptime guarantee and no private render farm. A personal Stable Horde key only affects priority; it does not make the queue instant.</p>
              </div>
            </div>
          </section>

          <section className="panel settings-panel">
            <div className="panel-head"><span className="panel-title"><span className="num">04</span> DATA & STORAGE</span><span className="mono-xs muted">THIS BROWSER ONLY</span></div>
            <div className="panel-body">
              <div className="storage-stats">
                <div><HardDrive size={14} /><strong>{assets.length}</strong><span>PLATES</span></div>
                <div><Sparkles size={14} /><strong>{generated}</strong><span>LOCAL OUTPUT</span></div>
                <div><Database size={14} /><strong>{seedCount}</strong><span>SEED ARCHIVE</span></div>
                <div><Download size={14} /><strong>{exports.length}</strong><span>EXPORTS</span></div>
              </div>
              <div className="data-actions">
                <button className="btn btn--ghost btn--sm" onClick={backup}><Download size={11} /> EXPORT JSON BACKUP</button>
                <button className="btn btn--ghost btn--sm" onClick={() => fileRef.current?.click()}><Upload size={11} /> IMPORT BACKUP</button>
                <button className="btn btn--ghost btn--sm" onClick={() => { setUsage({ generations: 0, exports: 0, credits: 120 }); toast('Counters reset', 'Frames and export counts are back to zero.') }}><RefreshCw size={11} /> RESET COUNTERS</button>
                <button className="btn btn--ghost btn--sm settings-danger" onClick={resetAll}><Trash2 size={11} /> RESET STUDIO</button>
              </div>
              <div className="settings-inline-note">
                <Info size={13} />
                <p>The JSON backup contains written material, campaigns, brands, zine pages, styles and portable seed plates. Generated and uploaded image blobs stay in IndexedDB and are not inside the JSON — export the plates you care about from the Export Room first.</p>
              </div>
            </div>
          </section>
        </div>

        <aside className="settings-side">
          <section className="panel settings-panel">
            <div className="panel-head"><span className="panel-title"><span className="num">USG</span> FRAMES</span><span className="mono-xs muted">{usage.credits} LEFT</span></div>
            <div className="panel-body">
              <div className="usage-big">{usage.credits}<span>/ 120</span></div>
              <div className="credit-bar settings-credit"><span style={{ width: `${Math.min(100, (1 - usage.credits / 120) * 100)}%` }} /></div>
              <div className="usage-mini-grid">
                <div><strong>{usage.generations}</strong><span>GENERATIONS</span></div>
                <div><strong>{usage.exports}</strong><span>EXPORTS</span></div>
                <div><strong>{campaigns.length}</strong><span>CAMPAIGNS</span></div>
                <div><strong>{exports.length}</strong><span>FILES</span></div>
              </div>
              <div className="field" style={{ marginTop: 16 }}>
                <label>SET FRAMES LEFT <span>{usage.credits}</span></label>
                <input type="range" min={0} max={120} value={usage.credits} onChange={(e) => setUsage({ credits: Number(e.target.value) })} />
              </div>
              <p className="settings-help">The frame counter is a studio budget, not a provider quota. It is deliberately manual and local.</p>
            </div>
          </section>

          <section className="panel settings-panel">
            <div className="panel-head"><span className="panel-title"><span className="num">SYS</span> STUDIO SYSTEM</span></div>
            <div className="panel-body">
              <div className="kv"><span>Theme</span><span>{theme === 'day' ? 'Paper / day' : 'Darkroom / night'}</span></div>
              <div className="kv"><span>Provider</span><span>Stable Horde</span></div>
              <div className="kv"><span>Queue</span><span>Anonymous / free</span></div>
              <div className="kv"><span>Assets</span><span>IndexedDB + seeds</span></div>
              <div className="kv"><span>Persisted state</span><span>localStorage</span></div>
              <div className="kv"><span>Type pairing</span><span>{useApp.getState().typePairing ? `${useApp.getState().typePairing?.display} / ${useApp.getState().typePairing?.body}` : 'not set'}</span></div>
              <div className="kv"><span>Latest export</span><span>{latestExport ? latestExport.format : '—'}</span></div>
              <div className="kv"><span>Version</span><span>CAMPAIGN 04 / 1.0</span></div>
              <div className="settings-swatches">
                <span className="mono-xs muted">PALETTE</span>
                <Swatches palette={['#efeade', '#171512', '#9b5e63', '#75647d', '#c9a6a6']} size={18} labels />
              </div>
            </div>
          </section>

          <section className="panel settings-panel settings-note-panel">
            <div className="panel-head"><span className="panel-title"><span className="num">NOTE</span> WHAT IS REAL</span></div>
            <div className="panel-body">
              <ul className="settings-truths">
                <li><Check size={11} /> Images are generated by a real provider, not a mock.</li>
                <li><Check size={11} /> Canvases render real pixels at full resolution.</li>
                <li><Check size={11} /> Uploads, fonts and plates are stored in this browser.</li>
                <li><Check size={11} /> ZIP exports contain the actual files.</li>
                <li><AlertTriangle size={11} /> There is no subscription, cloud sync, CMYK proof or instant queue.</li>
                <li><AlertTriangle size={11} /> Clearing browser data removes generated images permanently.</li>
              </ul>
              <div className="note">make something worth remembering.</div>
            </div>
          </section>

          <section className="panel settings-panel danger-panel">
            <div className="panel-head"><span className="panel-title"><span className="num">!</span> RESET</span></div>
            <div className="panel-body">
              <p>Reset removes every local plate, uploaded font, campaign, brand, brief, zine page and export record, then reloads the seed archive.</p>
              <button className="btn btn--ghost btn--sm btn--wide settings-danger" onClick={resetAll}><Trash2 size={11} /> RESET THE STUDIO</button>
            </div>
          </section>
        </aside>
      </div>

      <section className="section">
        <SectionHead index="16" title="Operating notes" link={<span className="mono-xs muted">READ BEFORE A REAL JOB</span>} />
        <div className="operating-grid">
          {[
            { icon: <Cpu size={14} />, t: 'A queue, not a render farm.', d: 'The free provider processes jobs in the order it can. Draft mode is fastest. SDXL and Flux are better but slower and more likely to time out.' },
            { icon: <Palette size={14} />, t: 'References guide, they do not paste.', d: 'Reference analysis reads palette, light and mood into the prompt. It does not composite the source image into the output.' },
            { icon: <SlidersHorizontal size={14} />, t: 'Non-destructive by design.', d: 'The Darkroom rebuilds from the original file on every control change. Saving creates a new plate; the negative is never overwritten.' },
            { icon: <Server size={14} />, t: 'Local-first, not cloud.', d: 'There is no account and no sync. State is localStorage, binary files are IndexedDB, and exports are files you own.' },
          ].map((o) => (
            <div key={o.t} className="operating-card">
              <span className="operating-icon">{o.icon}</span>
              <h3>{o.t}</h3>
              <p>{o.d}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="settings-footer">
        <Save size={12} />
        <span>Settings save as you change them.</span>
        <span className="mono-xs muted">CAMPAIGN 04 / LOCAL STUDIO / 2026</span>
        <button className="mini-link" onClick={() => fileRef.current?.click()}><Upload size={10} /> RESTORE A BACKUP</button>
      </div>
    </div>
  )
}
