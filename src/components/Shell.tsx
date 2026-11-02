import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Search, Sun, Moon, Command, Menu, X, Radio, PanelLeftClose, PanelLeftOpen,
  Loader2, ChevronRight, CircleSlash, Check, AlertTriangle, Sparkles,
} from 'lucide-react'
import { NAV_ITEMS } from '../lib/presets'
import { useApp } from '../lib/store'
import { BrandStamp, Toasts } from './UI'
import { startGenerationRunner } from '../lib/runner'
import type { DepartmentId } from '../lib/types'

const GROUPS = ['STUDIO', 'IMAGE', 'CULTURE', 'SYSTEM']

export function Shell({ children }: { children: ReactNode }) {
  const route = useApp((s) => s.route)
  const navigate = useApp((s) => s.navigate)
  const theme = useApp((s) => s.theme)
  const toggleTheme = useApp((s) => s.toggleTheme)
  const collapsed = useApp((s) => s.sidebarCollapsed)
  const setCollapsed = useApp((s) => s.setSidebarCollapsed)
  const mobileOpen = useApp((s) => s.mobileNavOpen)
  const setMobileOpen = useApp((s) => s.setMobileNavOpen)
  const jobs = useApp((s) => s.jobs)
  const usage = useApp((s) => s.usage)
  const settings = useApp((s) => s.settings)
  const [jobsOpen, setJobsOpen] = useState(false)
  const activeJobs = jobs.filter((j) => ['queued', 'submitting', 'waiting', 'downloading'].includes(j.status))
  const current = NAV_ITEMS.find((n) => n.id === route)
  const activeJob = activeJobs[0]

  useEffect(() => {
    startGenerationRunner()
  }, [])

  useEffect(() => {
    const onHash = () => {
      const id = window.location.hash.replace('#/', '') as DepartmentId
      if (id && NAV_ITEMS.some((n) => n.id === id) && id !== useApp.getState().route) useApp.setState({ route: id })
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    document.documentElement.dataset.reduceMotion = settings.reduceMotion ? 'true' : 'false'
  }, [settings.reduceMotion])

  useEffect(() => {
    document.documentElement.dataset.grid = settings.showGrid ? 'true' : 'false'
  }, [settings.showGrid])

  return (
    <div className={`app ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="brand-block">
          <div className="brand-word">
            CAMPAIGN <span>04</span>
          </div>
          <div className="brand-sub">Independent image-making studio</div>
          <div className="brand-sub" style={{ color: 'var(--faint)', marginTop: 4 }}>{settings.name.toUpperCase()} · VOL. 001</div>
          <BrandStamp size={52} />
        </div>

        <nav className="nav-scroll">
          {GROUPS.map((group) => (
            <div key={group}>
              <div className="nav-group">{group}</div>
              {NAV_ITEMS.filter((n) => n.group === group).map((item) => (
                <button
                  key={item.id}
                  className={`nav-item ${route === item.id ? 'active' : ''}`}
                  onClick={() => navigate(item.id)}
                >
                  <span className="nav-index">{item.index}</span>
                  <span style={{ minWidth: 0 }}>
                    <span className="nav-label">{item.label}</span>
                    <span className="nav-sub">{item.sub}</span>
                  </span>
                </button>
              ))}
            </div>
          ))}
          <div style={{ padding: '18px 14px 0' }}>
            <div className="note" style={{ fontSize: 16 }}>the image is the argument.</div>
          </div>
        </nav>

        <div className="sidebar-foot">
          <div className="theme-switch" role="group" aria-label="Theme">
            <button className={theme === 'day' ? 'active' : ''} onClick={() => useApp.getState().setTheme('day')}>
              <Sun size={11} /> DAY
            </button>
            <button className={theme === 'night' ? 'active' : ''} onClick={() => useApp.getState().setTheme('night')}>
              <Moon size={11} /> NIGHT
            </button>
          </div>
          <div>
            <div className="sidebar-credit">
              <span>{usage.credits} FRAMES LEFT</span>
              <span>{Math.round((1 - usage.credits / 120) * 100)}%</span>
            </div>
            <div className="credit-bar">
              <span style={{ width: `${Math.min(100, (1 - usage.credits / 120) * 100)}%` }} />
            </div>
          </div>
          <div className="sidebar-credit" style={{ color: 'var(--faint)' }}>
            <span>PRIVATE STUDIO</span>
            <span>LOCAL / ON</span>
          </div>
        </div>
      </aside>

      {mobileOpen && <div className="mobile-scrim" onClick={() => setMobileOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-btn mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Menu">
              <Menu size={14} />
            </button>
            <button className="icon-btn hide-mobile" onClick={() => setCollapsed(!collapsed)} aria-label="Collapse sidebar">
              {collapsed ? <PanelLeftOpen size={13} /> : <PanelLeftClose size={13} />}
            </button>
            <div className="crumb">
              <span>CAMPAIGN 04</span>
              <ChevronRight size={10} />
              <span>{current?.index}</span>
              <strong>{current?.label}</strong>
            </div>
          </div>
          <div className="topbar-right">
            {activeJob ? (
              <button className="topbtn" onClick={() => setJobsOpen(true)}>
                <Loader2 size={11} className="spin" />
                <span>{activeJob.status === 'waiting' ? `QUEUE ${activeJob.queuePosition ?? '—'}` : activeJob.status.toUpperCase()}</span>
              </button>
            ) : (
              <button className="topbtn" onClick={() => setJobsOpen(true)}>
                <span className="dot" />
                <span>STUDIO READY</span>
              </button>
            )}
            <button className="topbtn hide-mobile" onClick={() => useApp.getState().setCommandOpen(true)}>
              <Search size={11} />
              <span>INDEX</span>
              <span style={{ opacity: 0.5 }}>⌘K</span>
            </button>
            <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'day' ? <Moon size={13} /> : <Sun size={13} />}
            </button>
            <div className="avatar" title={settings.name}>S04</div>
          </div>
        </header>

        <main>{children}</main>

        <footer className="page" style={{ paddingTop: 0, paddingBottom: 24, marginTop: 'auto' }}>
          <div className="footer-strip">
            <span>© 2026 CAMPAIGN 04 / VOL. 001</span>
            <span style={{ fontFamily: 'var(--font-hand)', textTransform: 'none', letterSpacing: 0, fontSize: 15 }}>make something worth remembering.</span>
            <span>51.5072° N / 0.1276° W</span>
            <span>PAPER · FLASH · MEMORY</span>
          </div>
        </footer>
      </div>

      <CommandPalette />
      <JobsDrawer open={jobsOpen} onClose={() => setJobsOpen(false)} />
      <Toasts />
    </div>
  )
}

function CommandPalette() {
  const open = useApp((s) => s.commandOpen)
  const setOpen = useApp((s) => s.setCommandOpen)
  const navigate = useApp((s) => s.navigate)
  const theme = useApp((s) => s.theme)
  const toggleTheme = useApp((s) => s.toggleTheme)
  const [q, setQ] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQ('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(!open)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  const actions = [
    { id: 'new-brief', label: 'New art direction brief', sub: 'ART DIRECTOR', run: () => navigate('director') },
    { id: 'new-campaign', label: 'Open campaign builder', sub: 'CAMPAIGNS', run: () => navigate('campaigns') },
    { id: 'new-image', label: 'Generate a new image', sub: 'STUDIO', run: () => navigate('studio') },
    { id: 'open-darkroom', label: 'Develop an image', sub: 'DARKROOM', run: () => navigate('darkroom') },
    { id: 'open-zine', label: 'Make a zine page', sub: 'THE ZINE', run: () => navigate('zine') },
    { id: 'theme', label: `Switch to ${theme === 'day' ? 'night' : 'day'} theme`, sub: 'VIEW', run: () => toggleTheme() },
  ]
  const items = [
    ...NAV_ITEMS.map((n) => ({ id: n.id, label: n.label, sub: n.sub, run: () => navigate(n.id) })),
    ...actions,
  ].filter((i) => !q || `${i.label} ${i.sub}`.toLowerCase().includes(q.toLowerCase()))

  if (!open) return null
  return (
    <div className="command" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="command-panel">
        <input
          ref={inputRef}
          className="command-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Where do you want to go?"
        />
        <div className="command-list">
          {items.map((i, idx) => (
            <button
              key={i.id}
              className={`command-item ${idx === 0 ? 'active' : ''}`}
              onClick={() => {
                i.run()
                setOpen(false)
              }}
            >
              <span className="idx">{String(idx + 1).padStart(2, '0')}</span>
              <span className="lbl">{i.label}</span>
              <span className="sub">{i.sub}</span>
            </button>
          ))}
          {items.length === 0 && <div style={{ padding: 20, color: 'var(--muted)', fontSize: 12 }}>No departments match “{q}”.</div>}
        </div>
        <div className="command-foot">
          <span>↑↓ TO NAVIGATE · ENTER TO OPEN</span>
          <span>ESC TO CLOSE</span>
        </div>
      </div>
    </div>
  )
}

function JobsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const jobs = useApp((s) => s.jobs)
  const cancel = useApp((s) => s.cancelJob)
  const clear = useApp((s) => s.clearFinishedJobs)
  if (!open) return null
  return (
    <>
      <div className="overlay" style={{ padding: 0, zIndex: 105, background: 'rgba(8,7,6,0.4)' }} onMouseDown={onClose} />
      <aside className="drawer" style={{ width: 'min(460px, 95vw)' }}>
        <div className="drawer-head">
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Development queue</div>
            <h2 className="modal-title" style={{ fontSize: 30 }}>The Lab</h2>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="drawer-body">
          {jobs.length === 0 && (
            <div className="empty">
              <Radio size={18} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
              <h3>Nothing developing.</h3>
              <p>Image jobs will appear here while the studio works.</p>
            </div>
          )}
          <div style={{ display: 'grid', gap: 10 }}>
            {jobs.map((j) => (
              <div key={j.id} className="panel">
                <div className="panel-body" style={{ padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="mono-xs" style={{ color: 'var(--accent)', marginBottom: 4 }}>{j.status}</div>
                      <div style={{ fontSize: 11, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{j.prompt}</div>
                    </div>
                    {['queued', 'submitting', 'waiting', 'downloading'].includes(j.status) ? (
                      <button className="icon-btn" onClick={() => cancel(j.id)} title="Cancel">
                        <CircleSlash size={12} />
                      </button>
                    ) : j.status === 'done' ? (
                      <Check size={13} style={{ color: '#7c9a68', flex: 'none' }} />
                    ) : j.status === 'error' ? (
                      <AlertTriangle size={13} style={{ color: 'var(--signal)', flex: 'none' }} />
                    ) : null}
                  </div>
                  {j.status === 'waiting' && (
                    <div style={{ marginTop: 8 }}>
                      <div className="loading-line" />
                      <div className="mono-xs" style={{ color: 'var(--muted)', marginTop: 5 }}>
                        POSITION {j.queuePosition ?? '—'} · ETA {j.eta ? `${Math.ceil(j.eta / 60)} MIN` : '—'}
                      </div>
                    </div>
                  )}
                  {j.error && <div className="mono-xs" style={{ color: 'var(--signal)', marginTop: 6, lineHeight: 1.5 }}>{j.error}</div>}
                  <div className="mono-xs" style={{ color: 'var(--faint)', marginTop: 6 }}>{new Date(j.createdAt).toLocaleTimeString()} · {j.width}×{j.height} · {j.model}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="drawer-foot">
          <button className="btn btn--ghost btn--sm" onClick={clear}>CLEAR FINISHED</button>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--faint)' }}>
            <Sparkles size={12} />
            <span className="mono-xs">REAL IMAGE JOBS · STABLE HORDE</span>
          </div>
        </div>
      </aside>
    </>
  )
}
