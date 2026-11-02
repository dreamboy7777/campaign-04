import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X, ImageOff, ChevronRight } from 'lucide-react'
import { useApp } from '../lib/store'

export function ImagePlate({
  src,
  alt,
  ratio = '3 / 4',
  className = '',
  caption,
  tag,
  onClick,
  actions,
  style,
  eager,
}: {
  src?: string
  alt: string
  ratio?: string
  className?: string
  caption?: string
  tag?: string
  onClick?: () => void
  actions?: ReactNode
  style?: CSSProperties
  eager?: boolean
}) {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')
  useEffect(() => setState('loading'), [src])
  return (
    <div
      className={`plate ${className}`}
      style={{ aspectRatio: ratio, cursor: onClick ? 'pointer' : undefined, ...style }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) onClick()
      }}
    >
      {src && state !== 'error' && (
        <img
          src={src}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          onLoad={() => setState('ok')}
          onError={() => setState('error')}
          style={{ opacity: state === 'ok' ? 1 : 0, transition: 'opacity 500ms' }}
        />
      )}
      {(!src || state === 'error') && (
        <div className="plate-fallback">
          <ImageOff size={18} strokeWidth={1.2} style={{ opacity: 0.4, marginBottom: 8 }} />
          <span>{alt || 'Image plate'}</span>
        </div>
      )}
      {state === 'loading' && <div className="skeleton" style={{ position: 'absolute', inset: 0, zIndex: 0 }} />}
      {tag && <span className="plate-tag">{tag}</span>}
      {caption && <span className="plate-caption">{caption}</span>}
      {actions && <div className="plate-actions">{actions}</div>}
    </div>
  )
}

export function PageHeader({
  index,
  kicker,
  title,
  description,
  actions,
  meta,
}: {
  index: string
  kicker?: string
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  meta?: ReactNode
}) {
  return (
    <header className="page-head">
      <div className="page-head-left">
        <div className="page-kicker">
          <span className="page-index">{index}</span>
          {kicker && <span className="eyebrow no-rule">{kicker}</span>}
        </div>
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-desc">{description}</p>}
        {meta && <div style={{ marginTop: 16 }}>{meta}</div>}
      </div>
      {actions && <div className="page-head-actions">{actions}</div>}
    </header>
  )
}

export function SectionHead({ index, title, link, action }: { index?: string; title: ReactNode; link?: ReactNode; action?: ReactNode }) {
  return (
    <div className="section-head">
      <h2 className="section-title">
        {index && <span className="idx">{index}</span>}
        {title}
      </h2>
      {link}
      {action}
    </div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  width,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  eyebrow?: string
  children: ReactNode
  footer?: ReactNode
  width?: number
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={width ? { width: `min(${width}px, 100%)` } : undefined}>
        {(title || eyebrow) && (
          <div className="modal-head">
            <div>
              {eyebrow && <div className="eyebrow" style={{ marginBottom: 10 }}>{eyebrow}</div>}
              {title && <h2 className="modal-title">{title}</h2>}
            </div>
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <X size={14} />
            </button>
          </div>
        )}
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.getElementById('modal-root')!,
  )
}

export function Drawer({ open, onClose, title, eyebrow, children, footer }: { open: boolean; onClose: () => void; title?: ReactNode; eyebrow?: string; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <>
      <div className="overlay" style={{ padding: 0, zIndex: 105, background: 'rgba(8,7,6,0.4)' }} onMouseDown={onClose} />
      <aside className="drawer">
        <div className="drawer-head">
          <div>
            {eyebrow && <div className="eyebrow" style={{ marginBottom: 8 }}>{eyebrow}</div>}
            {title && <h2 className="modal-title" style={{ fontSize: 30 }}>{title}</h2>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={14} />
          </button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-foot">{footer}</div>}
      </aside>
    </>,
    document.getElementById('modal-root')!,
  )
}

export function Slider({
  label,
  value,
  onChange,
  low,
  high,
  format,
  min = 0,
  max = 100,
  step = 1,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  low?: string
  high?: string
  format?: (v: number) => string
  min?: number
  max?: number
  step?: number
}) {
  return (
    <div className="slider-row">
      <div className="slider-head">
        <span>{label}</span>
        <span>{format ? format(value) : value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      {(low || high) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.06em', color: 'var(--faint)', textTransform: 'uppercase' }}>
          <span>{low}</span>
          <span>{high}</span>
        </div>
      )}
    </div>
  )
}

export function Swatches({ palette, size = 22, labels }: { palette: string[]; size?: number; labels?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 7, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      {palette.map((c, i) => (
        <div key={`${c}-${i}`} style={{ display: 'grid', gap: 4 }}>
          <div
            style={{
              width: size,
              height: size,
              borderRadius: '50%',
              background: c,
              border: '1px solid rgba(0,0,0,0.12)',
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
            }}
            title={c}
          />
          {labels && <span className="mono-xs" style={{ color: 'var(--faint)', fontSize: 7 }}>{c.replace('#', '')}</span>}
        </div>
      ))}
    </div>
  )
}

export function Toasts() {
  const toasts = useApp((s) => s.toasts)
  const dismiss = useApp((s) => s.dismissToast)
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone ?? ''}`} onClick={() => dismiss(t.id)} style={{ cursor: 'pointer' }}>
          <strong>{t.title}</strong>
          {t.message && <p>{t.message}</p>}
        </div>
      ))}
    </div>
  )
}

export function BrandStamp({ size = 54 }: { size?: number }) {
  return (
    <svg className="brand-stamp" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <path id="stamp-circle" d="M 50,50 m -37,0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0" />
      </defs>
      <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="0.7" opacity="0.55" />
      <circle cx="50" cy="50" r="27" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.45" />
      <text fill="currentColor" fontSize="7.4" fontFamily="IBM Plex Mono, monospace" letterSpacing="2.1">
        <textPath href="#stamp-circle">MAKE SOMETHING WORTH REMEMBERING · VOL. 001 ·</textPath>
      </text>
      <text x="50" y="47" textAnchor="middle" fill="currentColor" fontSize="9" fontFamily="IBM Plex Mono, monospace" letterSpacing="1">C04</text>
      <text x="50" y="58" textAnchor="middle" fill="currentColor" fontSize="5.4" fontFamily="IBM Plex Mono, monospace" letterSpacing="1">EST. 2026</text>
    </svg>
  )
}

export function MiniStat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

export function EmptyState({ title, text, action, icon }: { title: string; text: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="empty">
      {icon && <div style={{ color: 'var(--accent)', marginBottom: 10 }}>{icon}</div>}
      <h3>{title}</h3>
      <p>{text}</p>
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  )
}

export function LinkArrow({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button className="section-link" onClick={onClick}>
      {children}
      <ChevronRight size={11} />
    </button>
  )
}

export function useObjectUrl(blob?: Blob | null) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!blob) return
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}

export function useClickOutside<T extends HTMLElement>(onOutside: () => void) {
  const ref = useRef<T>(null)
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside()
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [onOutside])
  return ref
}

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      className="btn btn--ghost btn--sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          setTimeout(() => setDone(false), 1600)
        } catch {
          setDone(false)
        }
      }}
    >
      {done ? 'Copied' : label}
    </button>
  )
}
