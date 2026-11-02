import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  Plus, Download, Trash2, ArrowUp, ArrowDown, Copy, BookOpen, Image as ImageIcon,
  FileArchive, Type, Layers, ChevronRight, Globe2, ExternalLink, Printer, Sparkles,
} from 'lucide-react'
import { PageHeader, Modal, ImagePlate, CopyButton, Slider } from '../components/UI'
import { UploadPlate } from '../components/UploadPlate'
import { useApp, uid } from '../lib/store'
import { FONT_LIBRARY } from '../lib/presets'
import { LAYOUT_SIZES, loadImageMap, renderLayout, type LayoutCanvas, type LayoutConfig, type ZineTextRect } from '../lib/imaging'
import { canvasToBlob, downloadBlob } from '../lib/imageStore'
import { MAGAZINE_PRESETS, buildMagazinePages } from '../lib/magazine'
import { LAYOUT_BLOCK_MAP, ZINE_TEXT_BLOCKS, textTransform } from '../lib/zineText'
import { buildPublicationHtml, publicationSlug, type PublicationPage } from '../lib/publish'
import type { ZineIssue, ZinePage, ZinePageLayout, ZineTextBlock, ZineTextTransform } from '../lib/types'
import { zipSync, strToU8 } from 'fflate'

const TEMPLATE_LABELS: Record<ZinePage['template'], string> = {
  cover: 'COVER',
  editorial: 'EDITORIAL',
  collage: 'COLLAGE',
  back: 'BACK COVER',
}

const DEFAULT_PALETTE = ['#efe8d8', '#171512', '#9b5e63', '#d8b3a8', '#7b5a4a']

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })

function formatFor(template: ZinePage['template']): LayoutConfig['format'] {
  if (template === 'cover') return 'zine-cover'
  if (template === 'back') return 'back'
  return 'zine-page'
}

function sizeFor(template: ZinePage['template']) {
  if (template === 'back') return LAYOUT_SIZES.back
  if (template === 'cover') return LAYOUT_SIZES['zine-cover']
  return LAYOUT_SIZES['zine-page']
}

function configFor(
  page: ZinePage,
  studioName: string,
  typePairing: { display: string; body: string } | undefined,
  issue: ZineIssue,
): LayoutConfig {
  const format = formatFor(page.template)
  const size = sizeFor(page.template)
  const palette = page.palette.length >= 3 ? page.palette : DEFAULT_PALETTE
  return {
    format,
    width: size.width,
    height: size.height,
    headline: page.headline,
    subhead: page.subhead,
    body: page.body,
    caption: page.caption,
    note: page.note,
    brand: studioName.toUpperCase() || 'CAMPAIGN 04',
    issue: [issue.number, issue.season].filter(Boolean).join(' / ').toUpperCase(),
    price: '£12 / $16',
    displayFont: typePairing?.display ?? FONT_LIBRARY[0].name,
    bodyFont: typePairing?.body ?? FONT_LIBRARY[2].name,
    ink: palette[1] ?? '#171512',
    paper: palette[0] ?? '#efe8d8',
    accent: palette[2] ?? '#9b5e63',
    align: 'left',
    scale: 1,
    tracking: 0,
    imageId: page.imageId,
    secondaryImageId: page.secondaryImageId,
    focusX: page.focusX ?? 0.5,
    focusY: page.focusY ?? (page.template === 'cover' ? 0.4 : 0.36),
    zineLayout: page.template === 'cover' || page.template === 'back' ? 'standard' : page.layout ?? 'standard',
    textLayout: page.text,
  }
}

export function ZineStudio() {
  const zinePages = useApp((s) => s.zinePages)
  const zineIssue = useApp((s) => s.zineIssue)
  const assets = useApp((s) => s.assets)
  const settings = useApp((s) => s.settings)
  const typePairing = useApp((s) => s.typePairing)
  const addZinePage = useApp((s) => s.addZinePage)
  const updateZinePage = useApp((s) => s.updateZinePage)
  const removeZinePage = useApp((s) => s.removeZinePage)
  const moveZinePage = useApp((s) => s.moveZinePage)
  const setZinePages = useApp((s) => s.setZinePages)
  const updateZineIssue = useApp((s) => s.updateZineIssue)
  const markZinePublished = useApp((s) => s.markZinePublished)
  const addExport = useApp((s) => s.addExport)
  const toast = useApp((s) => s.toast)

  const [selectedId, setSelectedId] = useState(zinePages[0]?.id)
  const [picker, setPicker] = useState<null | 'primary' | 'secondary'>(null)
  const [presetOpen, setPresetOpen] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [activeTextBlock, setActiveTextBlock] = useState<ZineTextBlock>('headline')
  const [working, setWorking] = useState(false)
  const [progress, setProgress] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [publishProgress, setPublishProgress] = useState('')
  const [draggingBlock, setDraggingBlock] = useState<ZineTextBlock | null>(null)
  const [canvasBox, setCanvasBox] = useState({ left: 0, top: 0, width: 0, height: 0 })
  const [textBoxes, setTextBoxes] = useState<Partial<Record<ZineTextBlock, ZineTextRect>>>({})
  const [showTextTools, setShowTextTools] = useState(false)
  const previewRef = useRef<HTMLCanvasElement>(null)
  const canvasWrapRef = useRef<HTMLDivElement>(null)
  const textFieldRefs = useRef<Partial<Record<ZineTextBlock, HTMLTextAreaElement | HTMLInputElement | null>>>({})
  const page = zinePages.find((p) => p.id === selectedId) ?? zinePages[0]
  const imageAssets = useMemo(() => assets.filter((a) => a.kind !== 'layout' || a.source === 'seed'), [assets])
  const activePreset = MAGAZINE_PRESETS[0]

  useEffect(() => {
    if (!zinePages.some((p) => p.id === selectedId)) setSelectedId(zinePages[0]?.id)
  }, [zinePages, selectedId])

  useEffect(() => {
    const blocks = LAYOUT_BLOCK_MAP[page?.layout ?? 'standard'] ?? LAYOUT_BLOCK_MAP.standard
    if (!blocks.includes(activeTextBlock)) setActiveTextBlock(blocks[0])
  }, [page?.layout, activeTextBlock])

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      if (!page) {
        const canvas = previewRef.current
        if (canvas) {
          canvas.width = 1
          canvas.height = 1
        }
        return
      }
      try {
        const config = configFor(page, settings.name, typePairing, zineIssue)
        const images = await loadImageMap([config.imageId, config.secondaryImageId], assets)
        const rendered = await renderLayout(config, images)
        if (cancelled) return
        const canvas = previewRef.current
        if (!canvas) return
        canvas.width = rendered.width
        canvas.height = rendered.height
        const ctx = canvas.getContext('2d')!
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(rendered, 0, 0)
        setTextBoxes((rendered as LayoutCanvas).zineTextBoxes ?? {})
      } catch {
        /* fonts or source images may still be loading */
      }
    }, 140)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [page, assets, settings.name, typePairing, zineIssue])

  useEffect(() => {
    const canvas = previewRef.current
    const wrap = canvasWrapRef.current
    if (!canvas || !wrap) return
    const measure = () => {
      const canvasRect = canvas.getBoundingClientRect()
      const wrapRect = wrap.getBoundingClientRect()
      const next = {
        left: canvasRect.left - wrapRect.left,
        top: canvasRect.top - wrapRect.top,
        width: canvasRect.width,
        height: canvasRect.height,
      }
      setCanvasBox((prev) =>
        prev.left === next.left && prev.top === next.top && prev.width === next.width && prev.height === next.height
          ? prev
          : next,
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(canvas)
    observer.observe(wrap)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [page?.id])

  useEffect(() => {
    setTextBoxes({})
    setShowTextTools(false)
  }, [page?.id])

  const patch = (p: Partial<ZinePage>) => {
    if (page) updateZinePage(page.id, p)
  }

  const setPalette = (index: number, value: string) => {
    if (!page) return
    const palette = [...(page.palette.length >= 3 ? page.palette : DEFAULT_PALETTE)]
    palette[index] = value
    updateZinePage(page.id, { palette })
  }

  const newPage = (template: ZinePage['template']) => {
    const last = zinePages[zinePages.length - 1]
    const next: ZinePage = {
      id: uid('zpage'),
      template,
      layout: 'standard',
      headline: template === 'cover' ? 'A NEW ISSUE' : template === 'back' ? 'END OF ISSUE' : 'UNTITLED PAGE',
      subhead: template === 'back' ? 'Keep the imperfect frame.' : 'A page made by hand.',
      body: 'Write the page here. The zine is assembled from real layouts, not placeholders. Every page renders on a canvas at A5 and exports as a full-resolution PNG.',
      imageId: template === 'back' ? undefined : last?.imageId ?? 'seed-mirror',
      secondaryImageId: undefined,
      palette: last?.palette ?? DEFAULT_PALETTE,
      caption: `CAMPAIGN 04 / ${zineIssue.number}`,
      note: `PLATE ${String(zinePages.length + 1).padStart(2, '0')}`,
    }
    addZinePage(next)
    setSelectedId(next.id)
    toast('Page added', `${TEMPLATE_LABELS[template]} / plate ${zinePages.length + 1}.`, 'success')
  }

  const duplicate = () => {
    if (!page) return
    const copy: ZinePage = {
      ...page,
      id: uid('zpage'),
      headline: `${page.headline} (COPY)`,
      palette: [...page.palette],
    }
    addZinePage(copy)
    setSelectedId(copy.id)
    toast('Page duplicated', 'The copy is at the end of the issue.', 'success')
  }

  const remove = () => {
    if (!page) return
    if (!confirm(`Remove “${page.headline}” from the issue?`)) return
    removeZinePage(page.id)
    toast('Page removed', page.headline)
  }

  const exportPage = async () => {
    if (!page) return
    setWorking(true)
    setProgress('Rendering page…')
    try {
      const config = configFor(page, settings.name, typePairing, zineIssue)
      const images = await loadImageMap([config.imageId, config.secondaryImageId], assets)
      const rendered = await renderLayout(config, images)
      const blob = await canvasToBlob(rendered, 'image/png')
      const name = `campaign04-zine-${String(zinePages.findIndex((p) => p.id === page.id) + 1).padStart(2, '0')}-${page.headline.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`
      downloadBlob(blob, name)
      addExport({ id: uid('exp'), name, format: 'PNG', width: rendered.width, height: rendered.height, createdAt: Date.now() })
      toast('Page exported', 'The A5 PNG is on your desktop.', 'success')
    } catch (err) {
      toast('Export failed', err instanceof Error ? err.message : 'The page could not be rendered.', 'error')
    } finally {
      setWorking(false)
      setProgress('')
    }
  }

  const exportIssue = async () => {
    if (!zinePages.length) {
      toast('The issue is empty', 'Add a page before exporting.', 'error')
      return
    }
    setWorking(true)
    const files: Record<string, Uint8Array> = {}
    const manifest: string[] = [
      `CAMPAIGN 04 / ${zineIssue.title}`,
      `${zineIssue.number} / ${zineIssue.season} / ${zinePages.length} PAGES`,
      `PUBLISHER: ${zineIssue.publisher}`,
      `DESCRIPTION: ${zineIssue.description}`,
      `STUDIO: ${settings.name}`,
      `TYPE: ${typePairing?.display ?? FONT_LIBRARY[0].name} / ${typePairing?.body ?? FONT_LIBRARY[2].name}`,
      `EXPORTED: ${new Date().toISOString()}`,
      '',
      'CONTENTS',
    ]
    try {
      for (let i = 0; i < zinePages.length; i++) {
        const p = zinePages[i]
        setProgress(`Rendering page ${i + 1} of ${zinePages.length}…`)
        const config = configFor(p, settings.name, typePairing, zineIssue)
        const images = await loadImageMap([config.imageId, config.secondaryImageId], assets)
        const rendered = await renderLayout(config, images)
        const blob = await canvasToBlob(rendered, 'image/png')
        const filename = `${String(i + 1).padStart(2, '0')}-${p.template}-${p.headline.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 48)}.png`
        files[filename] = new Uint8Array(await blob.arrayBuffer())
        manifest.push(`${String(i + 1).padStart(2, '0')}  ${TEMPLATE_LABELS[p.template].padEnd(12)} ${p.headline}  (${rendered.width}×${rendered.height})`)
      }
      manifest.push('', 'NOTES', 'Pages are A5-proportioned PNGs. This is a digital print package, not a PDF or ICC-managed press file.')
      files['MANIFEST.txt'] = strToU8(manifest.join('\n'))
      setProgress('Packing the issue…')
      const zipped = zipSync(files, { level: 6 })
      const blob = new Blob([zipped], { type: 'application/zip' })
      const name = `campaign04-${publicationSlug(zineIssue)}-print-pack.zip`
      downloadBlob(blob, name)
      addExport({ id: uid('exp'), name, format: 'ZIP', width: 0, height: 0, createdAt: Date.now() })
      toast('Issue exported', `${zinePages.length} PNG pages and a manifest are in the ZIP.`, 'success')
    } catch (err) {
      toast('Issue export failed', err instanceof Error ? err.message : 'A page could not be rendered.', 'error')
    } finally {
      setWorking(false)
      setProgress('')
    }
  }

  const templateCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    zinePages.forEach((p) => { counts[p.template] = (counts[p.template] ?? 0) + 1 })
    return counts
  }, [zinePages])

  const pageLayout: ZinePageLayout = page?.template === 'cover' || page?.template === 'back' ? 'standard' : page?.layout ?? 'standard'
  const hasPageForms = !!page && page.template !== 'cover' && page.template !== 'back'
  const hasTypeControls = !!page && page.template !== 'back'
  const textBlocks = LAYOUT_BLOCK_MAP[pageLayout] ?? LAYOUT_BLOCK_MAP.standard
  const activeTransform = textTransform(pageLayout, page?.text, activeTextBlock)
  const activeTextRect = textBoxes[activeTextBlock]
  const defaultTextColor = pageLayout === 'full' ? '#f4efe4' : page?.palette[1] ?? '#171512'
  const effectiveTextColor = activeTransform.color ?? defaultTextColor
  const effectiveTextFont = activeTransform.font ?? (
    activeTextBlock === 'headline' || activeTextBlock === 'subhead'
      ? typePairing?.display ?? FONT_LIBRARY[0].name
      : typePairing?.body ?? FONT_LIBRARY[2].name
  )
  const effectiveTextWeight = activeTransform.weight ?? (activeTextBlock === 'headline' || activeTextBlock === 'caption' || activeTextBlock === 'note' ? 500 : 400)
  const effectiveTextItalic = activeTransform.italic ?? (activeTextBlock === 'subhead' && pageLayout !== 'full')
  const effectiveTextAlign = activeTransform.align ?? (activeTextBlock === 'note' && pageLayout !== 'split' ? 'right' : 'left')
  const textToolbarStyle = activeTextRect
    ? (activeTextRect.y + activeTextRect.h) < 0.55
      ? { top: `${Math.min(86, (activeTextRect.y + activeTextRect.h + 0.015) * 100)}%`, bottom: 'auto' }
      : { bottom: `${Math.min(86, (1 - activeTextRect.y + 0.015) * 100)}%`, top: 'auto' }
    : undefined
  const targetPages = Math.max(1, zineIssue.targetPages || 20)
  const progressPercent = Math.min(100, Math.round((zinePages.length / targetPages) * 100))
  const issueCover = zinePages[0]
  const issueCoverAsset = assets.find((a) => a.id === issueCover?.imageId)

  const applyPreset = (mode: 'replace' | 'append') => {
    if (
      mode === 'replace' &&
      zinePages.length > 0 &&
      !confirm(`Replace the current ${zinePages.length}-page issue with the 20-page preset?`)
    ) return
    const built = buildMagazinePages(activePreset, assets)
    const nextPages = mode === 'append' ? [...zinePages, ...built] : built
    setZinePages(nextPages)
    updateZineIssue({ ...activePreset.issue, status: 'draft', publishedAt: undefined })
    setSelectedId(nextPages[0]?.id)
    setPresetOpen(false)
    toast(
      mode === 'append' ? '20 pages added' : '20-page magazine built',
      `${activePreset.name} is ready to edit and publish.`,
      'success',
    )
  }

  const patchText = (transform: Partial<ZineTextTransform>) => {
    if (!page) return
    const base = textTransform(pageLayout, page.text, activeTextBlock)
    patch({
      text: {
        ...page.text,
        [activeTextBlock]: { ...base, ...transform },
      },
    })
  }

  const startTextDrag = (event: ReactPointerEvent<HTMLButtonElement>, block: ZineTextBlock) => {
    if (!page) return
    event.preventDefault()
    const layer = event.currentTarget.parentElement
    if (!layer) return
    const rect = layer.getBoundingClientRect()
    const base = textTransform(pageLayout, page.text, block)
    let lastX = base.x
    let lastY = base.y
    setActiveTextBlock(block)
    setDraggingBlock(block)
    const move = (pointer: PointerEvent) => {
      const x = Math.min(0.98, Math.max(0.02, (pointer.clientX - rect.left) / rect.width))
      const y = Math.min(0.98, Math.max(0.02, (pointer.clientY - rect.top) / rect.height))
      if (Math.abs(x - lastX) < 0.0015 && Math.abs(y - lastY) < 0.0015) return
      lastX = x
      lastY = y
      updateZinePage(page.id, {
        text: {
          ...(page.text ?? {}),
          [block]: { ...base, x, y },
        },
      })
    }
    const up = () => {
      setDraggingBlock(null)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const selectTextAt = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!page || !hasTypeControls) return
    const rect = event.currentTarget.getBoundingClientRect()
    const nx = (event.clientX - rect.left) / rect.width
    const ny = (event.clientY - rect.top) / rect.height
    const pad = 0.008
    const hit = (Object.entries(textBoxes) as [ZineTextBlock, ZineTextRect][])
      .filter(([, box]) =>
        nx >= box.x - pad && nx <= box.x + box.w + pad &&
        ny >= box.y - pad && ny <= box.y + box.h + pad,
      )
      .sort((a, b) => a[1].w * a[1].h - b[1].w * b[1].h)[0]?.[0]
    if (!hit) return
    setActiveTextBlock(hit)
    setShowTextTools(true)
    requestAnimationFrame(() => textFieldRefs.current[hit]?.focus())
  }

  const publishIssue = async (mode: 'open' | 'download') => {
    if (!zinePages.length) {
      toast('The issue is empty', 'Add pages before publishing.', 'error')
      return
    }
    const previewWindow = mode === 'open' ? window.open('', '_blank') : null
    setPublishing(true)
    setPublishProgress('Preparing the edition…')
    try {
      const publicationPages: PublicationPage[] = []
      for (let i = 0; i < zinePages.length; i++) {
        const p = zinePages[i]
        setPublishProgress(`Rendering page ${i + 1} of ${zinePages.length}…`)
        const config = configFor(p, settings.name, typePairing, zineIssue)
        const images = await loadImageMap([config.imageId, config.secondaryImageId], assets)
        const rendered = await renderLayout(config, images)
        const blob = await canvasToBlob(rendered, 'image/jpeg', 0.9)
        publicationPages.push({
          index: i + 1,
          headline: p.headline,
          template: TEMPLATE_LABELS[p.template],
          dataUrl: await blobToDataUrl(blob),
          width: rendered.width,
          height: rendered.height,
        })
      }
      setPublishProgress('Binding the web edition…')
      const html = buildPublicationHtml(zineIssue, publicationPages, settings.name)
      const name = `campaign04-${publicationSlug(zineIssue)}-web-edition.html`
      const blob = new Blob([html], { type: 'text/html' })
      if (mode === 'open' && previewWindow && !previewWindow.closed) {
        try {
          previewWindow.document.open()
          previewWindow.document.write(html)
          previewWindow.document.close()
          previewWindow.document.title = `${zineIssue.title} — ${zineIssue.number}`
        } catch {
          downloadBlob(blob, name)
        }
      } else {
        downloadBlob(blob, name)
      }
      markZinePublished()
      addExport({ id: uid('exp'), name, format: 'HTML', width: 0, height: 0, createdAt: Date.now() })
      toast(
        mode === 'open' ? 'Web edition published' : 'Web edition downloaded',
        `${zinePages.length} pages · ${name}`,
        'success',
      )
      setPublishOpen(false)
    } catch (err) {
      previewWindow?.close()
      toast('Publishing failed', err instanceof Error ? err.message : 'A page could not be rendered.', 'error')
    } finally {
      setPublishing(false)
      setPublishProgress('')
    }
  }

  return (
    <div className="page zine-studio">
      <PageHeader
        index="11"
        kicker="INDEPENDENT PUBLISHING / THE MAGAZINE"
        title={<>THE <span className="ital">ZINE</span></>}
        description="Build a complete independent magazine, not a mood board. Compose up to twenty pages, set type anywhere on the page, then publish a self-contained web edition or download a print-ready pack."
        actions={
          <>
            <button className="btn btn--ghost" onClick={() => setPresetOpen(true)}><Sparkles size={12} /> 20-PAGE PRESET</button>
            <button className="btn btn--ghost" onClick={() => newPage('editorial')}><Plus size={12} /> NEW PAGE</button>
            <button className="btn btn--ghost" onClick={exportIssue} disabled={!zinePages.length || working}><FileArchive size={12} /> PRINT PACK</button>
            <button className="btn btn--solid" onClick={() => setPublishOpen(true)} disabled={!zinePages.length}>
              <Globe2 size={12} /> PUBLISH
            </button>
          </>
        }
        meta={<div className="page-meta"><span>{zineIssue.title} / {zineIssue.number}</span><span>{zinePages.length} of {targetPages} pages</span><span>{zineIssue.status}</span><span>{templateCounts.cover ? 'cover set' : 'no cover'}</span><span>{typePairing ? `${typePairing.display} / ${typePairing.body}` : 'studio type'}</span></div>}
      />

      <section className="zine-issue-strip">
        <div className="zine-issue-id">
          <span className="mono-xs accent">CURRENT ISSUE / {zineIssue.status.toUpperCase()}</span>
          <strong>{zineIssue.title}</strong>
          <span>{zineIssue.number} · {zineIssue.season} · {zineIssue.publisher}</span>
        </div>
        <div className="zine-issue-progress">
          <div className="zine-issue-progress-head">
            <span>{zinePages.length} / {targetPages} pages · {progressPercent}%</span>
            <button className="mini-link" onClick={() => setPresetOpen(true)}><Sparkles size={10} /> USE THE 20-PAGE PRESET</button>
          </div>
          <div className="zine-progress-track"><span style={{ width: `${progressPercent}%` }} /></div>
          <p>{zineIssue.description}</p>
        </div>
        <div className="zine-issue-actions">
          <button className="btn btn--ghost btn--sm" onClick={() => setPublishOpen(true)}><Globe2 size={11} /> PUBLISH</button>
          <button className="btn btn--ghost btn--sm" onClick={() => setPresetOpen(true)}><Sparkles size={11} /> PRESET</button>
        </div>
      </section>

      <div className="zine-layout">
        <aside className="zine-rail">
          <div className="zine-rail-head">
            <span className="mono-xs">{zineIssue.number} / CONTENTS</span>
            <button className="mini-link" onClick={() => newPage('editorial')}><Plus size={10} /> ADD</button>
          </div>
          <div className="zine-rail-list">
            {zinePages.map((p, i) => {
              const image = assets.find((a) => a.id === p.imageId)
              return (
                <button key={p.id} className={`zine-rail-card ${page?.id === p.id ? 'active' : ''}`} onClick={() => setSelectedId(p.id)}>
                  <span className="zine-rail-number">{String(i + 1).padStart(2, '0')}</span>
                  <span className="zine-rail-thumb">
                    {image ? <img src={image.src} alt="" /> : <span className="zine-rail-blank">{TEMPLATE_LABELS[p.template].slice(0, 3)}</span>}
                  </span>
                  <span className="zine-rail-meta">
                    <b>{TEMPLATE_LABELS[p.template]}</b>
                    <span>{p.headline || 'Untitled'}</span>
                  </span>
                  <ChevronRight size={11} />
                </button>
              )
            })}
            {!zinePages.length && (
              <div className="zine-rail-empty">
                <BookOpen size={18} />
                <p>No pages yet.</p>
                <button className="btn btn--ghost btn--sm" onClick={() => newPage('cover')}><Plus size={11} /> START A COVER</button>
              </div>
            )}
          </div>
          <div className="zine-rail-foot">
            <button className="btn btn--ghost btn--sm btn--wide" onClick={() => setPresetOpen(true)}><Sparkles size={11} /> 20-PAGE PRESET</button>
            <button className="btn btn--ghost btn--sm btn--wide" onClick={() => newPage('cover')}><BookOpen size={11} /> ADD COVER</button>
            <button className="btn btn--ghost btn--sm btn--wide" onClick={() => newPage('collage')}><Layers size={11} /> ADD COLLAGE</button>
            <button className="btn btn--ghost btn--sm btn--wide" onClick={() => newPage('back')}><ArrowDown size={11} /> ADD BACK COVER</button>
          </div>
        </aside>

        <section className="zine-stage">
          {page ? (
            <>
              <div className="zine-stage-bar">
                <div>
                  <span className="mono-xs accent">{TEMPLATE_LABELS[page.template]} / PLATE {String(zinePages.findIndex((p) => p.id === page.id) + 1).padStart(2, '0')}</span>
                  <span className="mono-xs muted" style={{ marginLeft: 14 }}>{sizeFor(page.template).label}</span>
                  {hasTypeControls && <span className="mono-xs accent" style={{ marginLeft: 14 }}>CLICK TEXT ON THE PAGE TO EDIT</span>}
                </div>
                <div className="stage-tools">
                  <button className="icon-btn tooltip" data-tip="Move earlier" onClick={() => moveZinePage(page.id, -1)}><ArrowUp size={12} /></button>
                  <button className="icon-btn tooltip" data-tip="Move later" onClick={() => moveZinePage(page.id, 1)}><ArrowDown size={12} /></button>
                  <button className="icon-btn tooltip" data-tip="Duplicate page" onClick={duplicate}><Copy size={12} /></button>
                  <button className="icon-btn tooltip" data-tip="Remove page" onClick={remove}><Trash2 size={12} /></button>
                </div>
              </div>
              <div className="zine-canvas-wrap" ref={canvasWrapRef}>
                <canvas
                  ref={previewRef}
                  className={`zine-canvas ${hasTypeControls ? 'zine-canvas--editable' : ''}`}
                  onClick={selectTextAt}
                />
                {hasTypeControls && canvasBox.width > 0 && (
                  <div
                    className="zine-drag-layer"
                    style={{ left: canvasBox.left, top: canvasBox.top, width: canvasBox.width, height: canvasBox.height }}
                  >
                    {activeTextRect && (
                      <div
                        className="zine-text-selection"
                        style={{
                          left: `${activeTextRect.x * 100}%`,
                          top: `${activeTextRect.y * 100}%`,
                          width: `${activeTextRect.w * 100}%`,
                          height: `${activeTextRect.h * 100}%`,
                        }}
                      />
                    )}
                    <button
                      type="button"
                      className={`zine-drag-pin ${draggingBlock === activeTextBlock ? 'is-dragging' : ''}`}
                      style={{ left: `${activeTransform.x * 100}%`, top: `${activeTransform.y * 100}%` }}
                      onPointerDown={(event) => startTextDrag(event, activeTextBlock)}
                    >
                      <span className="zine-drag-dot" />
                      <span>{draggingBlock === activeTextBlock ? 'MOVING' : 'DRAG'} / {ZINE_TEXT_BLOCKS.find((b) => b.key === activeTextBlock)?.label ?? activeTextBlock}</span>
                    </button>
                    {showTextTools && (
                      <div className="zine-text-toolbar" style={textToolbarStyle} onPointerDown={(event) => event.stopPropagation()}>
                        <span className="zine-text-toolbar-title">{ZINE_TEXT_BLOCKS.find((b) => b.key === activeTextBlock)?.label ?? activeTextBlock}</span>
                        <button
                          type="button"
                          className="zine-tool-btn"
                          title="Make smaller"
                          onClick={() => patchText({ scale: Math.max(0.4, Number((activeTransform.scale - 0.05).toFixed(2))) })}
                        >A−</button>
                        <span className="zine-tool-value">{Math.round(activeTransform.scale * 100)}%</span>
                        <button
                          type="button"
                          className="zine-tool-btn"
                          title="Make larger"
                          onClick={() => patchText({ scale: Math.min(2.6, Number((activeTransform.scale + 0.05).toFixed(2))) })}
                        >A+</button>
                        <label className="zine-tool-color" title="Text colour">
                          <span style={{ background: effectiveTextColor }} />
                          <input type="color" value={effectiveTextColor} onChange={(event) => patchText({ color: event.target.value })} />
                        </label>
                        <select
                          className="zine-tool-select"
                          title="Font"
                          value={activeTransform.font ?? ''}
                          onChange={(event) => patchText({ font: event.target.value || undefined })}
                        >
                          <option value="">DEFAULT FONT</option>
                          {FONT_LIBRARY.map((font) => (
                            <option key={font.name} value={font.name} style={{ fontFamily: font.css }}>{font.name}</option>
                          ))}
                        </select>
                        <select
                          className="zine-tool-select zine-tool-weight"
                          title="Weight"
                          value={activeTransform.weight?.toString() ?? ''}
                          onChange={(event) => patchText({ weight: event.target.value ? Number(event.target.value) : undefined })}
                        >
                          <option value="">WEIGHT</option>
                          {[300, 400, 500, 600, 700, 800, 900].map((weight) => (
                            <option key={weight} value={weight}>{weight}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className={`zine-tool-btn zine-tool-italic ${effectiveTextItalic ? 'active' : ''}`}
                          title="Italic"
                          onClick={() => patchText({ italic: !effectiveTextItalic })}
                        ><em>I</em></button>
                        <span className="zine-tool-group" title="Alignment">
                          {(['left', 'center', 'right'] as const).map((alignment) => (
                            <button
                              key={alignment}
                              type="button"
                              className={`zine-tool-btn ${effectiveTextAlign === alignment ? 'active' : ''}`}
                              onClick={() => patchText({ align: alignment })}
                            >{alignment === 'left' ? 'L' : alignment === 'center' ? 'C' : 'R'}</button>
                          ))}
                        </span>
                        <button
                          type="button"
                          className="zine-tool-btn zine-tool-words"
                          onClick={() => textFieldRefs.current[activeTextBlock]?.focus()}
                        >EDIT WORDS</button>
                        <button type="button" className="zine-tool-btn zine-tool-close" title="Close" onClick={() => setShowTextTools(false)}>×</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="zine-stage-foot">
                <div><span className="mono-xs">FORMAT</span><strong>{TEMPLATE_LABELS[page.template]}</strong></div>
                <div><span className="mono-xs">PAGES</span><strong>{zinePages.length} / {targetPages}</strong></div>
                <div><span className="mono-xs">WORDS</span><strong>{page.body.trim() ? page.body.trim().split(/\s+/).length : 0}</strong></div>
                <div><span className="mono-xs">IMAGES</span><strong>{[page.imageId, page.secondaryImageId].filter(Boolean).length}</strong></div>
                <button className="btn btn--ghost btn--sm" style={{ marginLeft: 'auto' }} onClick={exportPage} disabled={working}><Download size={11} /> PAGE PNG</button>
              </div>
            </>
          ) : (
            <div className="stage-empty">
              <div className="stage-empty-mark">11</div>
              <h3>The issue has no pages.</h3>
              <p>Start with a cover. The cover sets the rules the rest of the issue has to survive.</p>
              <button className="btn btn--solid" onClick={() => newPage('cover')}><Plus size={12} /> START THE ISSUE</button>
            </div>
          )}
        </section>

        <aside className="zine-inspector">
          {page ? (
            <>
              <div className="zine-inspector-head">
                <span className="mono-xs">PAGE / EDIT</span>
                <span className="mono-xs muted">{page.template.toUpperCase()}</span>
              </div>

              <div className="zine-block">
                <div className="block-label">01 / TEMPLATE</div>
                <div className="seg" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}>
                  {(['cover', 'editorial', 'collage', 'back'] as ZinePage['template'][]).map((t) => (
                    <button
                      key={t}
                      className={page.template === t ? 'active' : ''}
                      onClick={() => {
                        patch({ template: t, layout: 'standard', text: undefined })
                        setActiveTextBlock('headline')
                      }}
                    >{TEMPLATE_LABELS[t]}</button>
                  ))}
                </div>
              </div>

              {hasPageForms && (
                <div className="zine-block">
                  <div className="block-label">02 / PAGE FORM</div>
                  <div className="seg zine-layout-seg">
                    {(['standard', 'full', 'split', 'quiet'] as ZinePageLayout[]).map((l) => (
                      <button
                        key={l}
                        className={pageLayout === l ? 'active' : ''}
                        onClick={() => {
                          patch({ layout: l, text: undefined })
                          setActiveTextBlock('headline')
                        }}
                      >{l.toUpperCase()}</button>
                    ))}
                  </div>
                  <p className="zine-note">Standard is a classic picture page. Full bleeds the photograph. Split makes a hard vertical cut. Quiet leaves air around the image.</p>
                </div>
              )}

              {hasTypeControls && (
                <div className="zine-block">
                  <div className="block-label">03 / TYPE POSITION</div>
                  <div className="zine-text-tabs">
                    {textBlocks.map((block) => (
                      <button
                        key={block}
                        className={activeTextBlock === block ? 'active' : ''}
                        onClick={() => {
                          setActiveTextBlock(block)
                          setShowTextTools(true)
                        }}
                      >{ZINE_TEXT_BLOCKS.find((b) => b.key === block)?.label ?? block}</button>
                    ))}
                  </div>
                  <div className="zine-text-readout">
                    <span>{activeTextBlock.toUpperCase()}</span>
                    <b>{Math.round(activeTransform.x * 100)}% / {Math.round(activeTransform.y * 100)}%</b>
                    <em>{Math.round(activeTransform.scale * 100)}%</em>
                  </div>
                  <Slider
                    label="HORIZONTAL / X"
                    value={Math.round(activeTransform.x * 100)}
                    onChange={(v) => patchText({ x: v / 100 })}
                    min={0}
                    max={100}
                    step={1}
                    low="LEFT EDGE"
                    high="RIGHT EDGE"
                    format={(v) => `${v}%`}
                  />
                  <Slider
                    label="VERTICAL / Y"
                    value={Math.round(activeTransform.y * 100)}
                    onChange={(v) => patchText({ y: v / 100 })}
                    min={0}
                    max={100}
                    step={1}
                    low="TOP EDGE"
                    high="BOTTOM EDGE"
                    format={(v) => `${v}%`}
                  />
                  <Slider
                    label="SIZE / SCALE"
                    value={Math.round(activeTransform.scale * 100)}
                    onChange={(v) => patchText({ scale: v / 100 })}
                    min={40}
                    max={260}
                    step={2}
                    low="SHRINK"
                    high="ENLARGE"
                    format={(v) => `${v}%`}
                  />
                  <div className="zine-type-style-row">
                    <label className="zine-type-color">COLOUR<input type="color" value={effectiveTextColor} onChange={(event) => patchText({ color: event.target.value })} /></label>
                    <label className="zine-type-font">FONT
                      <select value={activeTransform.font ?? ''} onChange={(event) => patchText({ font: event.target.value || undefined })}>
                        <option value="">PAGE DEFAULT</option>
                        {FONT_LIBRARY.map((font) => <option key={font.name} value={font.name}>{font.name}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="zine-type-style-row">
                    <label>WEIGHT
                      <select value={activeTransform.weight?.toString() ?? ''} onChange={(event) => patchText({ weight: event.target.value ? Number(event.target.value) : undefined })}>
                        <option value="">PAGE DEFAULT</option>
                        {[300, 400, 500, 600, 700, 800, 900].map((weight) => <option key={weight} value={weight}>{weight}</option>)}
                      </select>
                    </label>
                    <div className="zine-type-align">
                      <span>ALIGN</span>
                      <div>
                        {(['left', 'center', 'right'] as const).map((alignment) => (
                          <button
                            key={alignment}
                            className={effectiveTextAlign === alignment ? 'active' : ''}
                            onClick={() => patchText({ align: alignment })}
                          >{alignment === 'left' ? 'L' : alignment === 'center' ? 'C' : 'R'}</button>
                        ))}
                        <button
                          className={effectiveTextItalic ? 'active' : ''}
                          onClick={() => patchText({ italic: !effectiveTextItalic })}
                        ><em>I</em></button>
                      </div>
                    </div>
                  </div>
                  <div className="zine-text-actions">
                    <button className="mini-link" onClick={() => {
                      if (!page) return
                      const next = { ...(page.text ?? {}) }
                      delete next[activeTextBlock]
                      patch({ text: Object.keys(next).length ? next : undefined })
                    }}>RESET THIS BLOCK</button>
                    <button className="mini-link" onClick={() => patch({ text: undefined })}>RESET ALL TYPE</button>
                  </div>
                  <p className="zine-note">X and Y are percentages of the page. Scale changes the type size without changing the layout. Every move is baked into the page PNG and the published edition.</p>
                </div>
              )}

              <div className="zine-block">
                <div className="block-label">{hasTypeControls ? '04' : '02'} / WORDS</div>
                <div className="field"><label>HEADLINE</label><textarea ref={(el) => { textFieldRefs.current.headline = el }} className="textarea" rows={2} value={page.headline} onChange={(e) => patch({ headline: e.target.value })} /></div>
                <div className="field"><label>SUBHEAD</label><textarea ref={(el) => { textFieldRefs.current.subhead = el }} className="textarea" rows={2} value={page.subhead} onChange={(e) => patch({ subhead: e.target.value })} /></div>
                <div className="field"><label>BODY</label><textarea ref={(el) => { textFieldRefs.current.body = el }} className="textarea" rows={5} value={page.body} onChange={(e) => patch({ body: e.target.value })} /></div>
                <div className="field"><label>CAPTION</label><input ref={(el) => { textFieldRefs.current.caption = el }} className="input" value={page.caption} onChange={(e) => patch({ caption: e.target.value })} /></div>
                <div className="field"><label>NOTE / ISSUE LINE</label><input ref={(el) => { textFieldRefs.current.note = el }} className="input" value={page.note} onChange={(e) => patch({ note: e.target.value })} /></div>
              </div>

              <div className="zine-block">
                <div className="block-label">{hasTypeControls ? '05' : '03'} / IMAGE PLATES</div>
                <div className="zine-image-slots">
                  <button className="zine-image-slot" onClick={() => setPicker('primary')}>
                    {page.imageId ? <img src={assets.find((a) => a.id === page.imageId)?.src} alt="" /> : <ImageIcon size={15} />}
                    <span>PRIMARY</span>
                    <b>{assets.find((a) => a.id === page.imageId)?.title ?? 'Choose'}</b>
                  </button>
                  <button className="zine-image-slot" onClick={() => setPicker('secondary')}>
                    {page.secondaryImageId ? <img src={assets.find((a) => a.id === page.secondaryImageId)?.src} alt="" /> : <ImageIcon size={15} />}
                    <span>SECONDARY</span>
                    <b>{assets.find((a) => a.id === page.secondaryImageId)?.title ?? 'None'}</b>
                  </button>
                </div>
                {(page.imageId || page.secondaryImageId) && (
                  <button className="mini-link" onClick={() => patch({ imageId: undefined, secondaryImageId: undefined })}>CLEAR IMAGES</button>
                )}
              </div>

              <div className="zine-block">
                <div className="block-label">{hasTypeControls ? '06' : '04'} / INK & PAPER</div>
                <div className="colour-row">
                  <label>PAPER<input type="color" value={page.palette[0] ?? DEFAULT_PALETTE[0]} onChange={(e) => setPalette(0, e.target.value)} /></label>
                  <label>INK<input type="color" value={page.palette[1] ?? DEFAULT_PALETTE[1]} onChange={(e) => setPalette(1, e.target.value)} /></label>
                  <label>ACCENT<input type="color" value={page.palette[2] ?? DEFAULT_PALETTE[2]} onChange={(e) => setPalette(2, e.target.value)} /></label>
                </div>
                <p className="zine-note">The same palette carries across the issue. Change it here and every page keeps its own decision.</p>
              </div>

              <div className="zine-block zine-block--last">
                <CopyButton text={`${page.headline}\n${page.subhead}\n\n${page.body}\n\n${page.caption}`} label="COPY PAGE TEXT" />
                <div className="zine-nav-row">
                  <button className="btn btn--ghost btn--sm" onClick={() => moveZinePage(page.id, -1)}><ArrowUp size={11} /> EARLIER</button>
                  <button className="btn btn--ghost btn--sm" onClick={() => moveZinePage(page.id, 1)}>LATER <ArrowDown size={11} /></button>
                </div>
                <button className="btn btn--accent btn--wide" onClick={exportPage} disabled={working}><Download size={12} /> EXPORT THIS PAGE</button>
                <button className="btn btn--ghost btn--sm btn--wide" onClick={exportIssue} disabled={working}><FileArchive size={11} /> EXPORT THE ISSUE</button>
                <p className="desk-note">A5 page · {sizeFor(page.template).width} × {sizeFor(page.template).height} px · PNG on export. The ZIP includes every page and a text manifest.</p>
              </div>
            </>
          ) : (
            <div className="zine-inspector-empty">
              <Type size={18} />
              <p>Select a page to edit it, or add a new one.</p>
            </div>
          )}
        </aside>
      </div>

      <section className="section">
        <div className="zine-colophon">
          <div>
            <div className="eyebrow">COLOPHON</div>
            <p>Set in {typePairing?.display ?? FONT_LIBRARY[0].name} and {typePairing?.body ?? FONT_LIBRARY[2].name}. Edited in the browser, rendered on a canvas, printed nowhere yet. {zineIssue.publisher} / {zineIssue.title} / {zineIssue.number} / {zineIssue.season}. {zineIssue.status === 'published' ? 'Web edition published.' : 'Draft edition.'}</p>
          </div>
          <div className="zine-colophon-stats">
            <div><strong>{zinePages.length}</strong><span>PAGES</span></div>
            <div><strong>{templateCounts.editorial ?? 0}</strong><span>EDITORIAL</span></div>
            <div><strong>{templateCounts.collage ?? 0}</strong><span>COLLAGE</span></div>
            <div><strong>{zinePages.reduce((n, p) => n + (p.body.trim() ? p.body.trim().split(/\s+/).length : 0), 0)}</strong><span>WORDS</span></div>
          </div>
          <div className="note">staple twice. leave the edges rough.</div>
        </div>
      </section>

      <Modal
        open={!!picker}
        onClose={() => setPicker(null)}
        eyebrow="PAGE IMAGE / ARCHIVE"
        title={picker === 'secondary' ? 'Choose the secondary plate' : 'Choose the primary plate'}
        width={1000}
        footer={<><span className="mono-xs muted">Every plate can be reused across the issue.</span><button className="btn btn--ghost btn--sm" onClick={() => setPicker(null)}>CLOSE</button></>}
      >
        <div className="zine-picker">
          <UploadPlate
            label="UPLOAD FROM LAPTOP"
            onPicked={(a) => {
              if (picker === 'secondary') patch({ secondaryImageId: a.id })
              else patch({ imageId: a.id })
              setPicker(null)
            }}
          />
          {picker === 'secondary' && (
            <button className="zine-pick zine-pick--none" onClick={() => { patch({ secondaryImageId: undefined }); setPicker(null) }}>
              <span>NO SECONDARY PLATE</span>
            </button>
          )}
          {imageAssets.map((a) => (
            <button key={a.id} className="zine-pick" onClick={() => {
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

      <Modal
        open={presetOpen}
        onClose={() => setPresetOpen(false)}
        eyebrow="MAGAZINE PRESET / COMPLETE ISSUE"
        title="BUILD THE FULL 20-PAGE ISSUE"
        width={1180}
        footer={
          <>
            <span className="mono-xs muted">20 pages · 4 page forms · archive plates · ready to edit</span>
            <button className="btn btn--ghost btn--sm" onClick={() => applyPreset('append')}>ADD 20 PAGES</button>
            <button className="btn btn--solid btn--sm" onClick={() => applyPreset('replace')}>REPLACE ISSUE WITH PRESET</button>
          </>
        }
      >
        <div className="preset-sheet">
          <div className="preset-intro">
            <div>
              <span className="mono-xs accent">{activePreset.kicker}</span>
              <h3>{activePreset.name}</h3>
              <p>{activePreset.description}</p>
            </div>
            <div className="preset-stats">
              <div><strong>20</strong><span>PAGES</span></div>
              <div><strong>4</strong><span>PAGE FORMS</span></div>
              <div><strong>02</strong><span>COVERS</span></div>
              <div><strong>01</strong><span>ISSUE</span></div>
            </div>
          </div>

          <div className="preset-sequence">
            {activePreset.pages.map((blueprint, index) => {
              const image = assets.find((a) => a.id === blueprint.imageId)
              return (
                <article className="preset-card" key={`${blueprint.headline}-${index}`}>
                  <span className="preset-card-number">{String(index + 1).padStart(2, '0')}</span>
                  <div className="preset-card-image">
                    {image ? <img src={image.src} alt="" /> : <span>{TEMPLATE_LABELS[blueprint.template]}</span>}
                  </div>
                  <div className="preset-card-copy">
                    <strong>{blueprint.headline}</strong>
                    <span>{TEMPLATE_LABELS[blueprint.template]} / {(blueprint.layout ?? 'standard').toUpperCase()}</span>
                  </div>
                </article>
              )
            })}
          </div>

          <div className="preset-foot">
            <div>
              <span className="mono-xs">PALETTE</span>
              <div className="preset-swatches">
                {activePreset.palette.map((color) => <span key={color} style={{ background: color }} />)}
              </div>
            </div>
            <p>Replacing the issue also sets the issue title, number, season and description. Every page remains fully editable, and every page will be rendered into the published edition.</p>
          </div>
        </div>
      </Modal>

      <Modal
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        eyebrow="PUBLISH / WEB EDITION + PRINT PACK"
        title="PUBLISH THE ISSUE"
        width={1020}
        footer={
          <>
            <span className="mono-xs muted">{zineIssue.status === 'published' ? 'PUBLISHED EDITION' : 'NOT PUBLISHED YET'}</span>
            <button className="btn btn--ghost btn--sm" onClick={() => setPublishOpen(false)} disabled={publishing}>CLOSE</button>
          </>
        }
      >
        <div className="publish-sheet">
          <div className="publish-preview">
            <div className="publish-cover">
              {issueCoverAsset ? <img src={issueCoverAsset.src} alt="" /> : <span>{zineIssue.title.slice(0, 1) || 'C'}</span>}
            </div>
            <span className="mono-xs accent">{zineIssue.status.toUpperCase()} / {zinePages.length} PAGES</span>
            <strong>{zineIssue.title}</strong>
            <span>{zineIssue.number} · {zineIssue.season}</span>
            <p>{zineIssue.description}</p>
          </div>

          <div className="publish-form">
            <div className="publish-fields">
              <div className="field"><label>ISSUE TITLE</label><input className="input" value={zineIssue.title} onChange={(e) => updateZineIssue({ title: e.target.value })} /></div>
              <div className="publish-field-row">
                <div className="field"><label>NUMBER</label><input className="input" value={zineIssue.number} onChange={(e) => updateZineIssue({ number: e.target.value })} /></div>
                <div className="field"><label>SEASON / YEAR</label><input className="input" value={zineIssue.season} onChange={(e) => updateZineIssue({ season: e.target.value })} /></div>
              </div>
              <div className="publish-field-row">
                <div className="field"><label>PUBLISHER</label><input className="input" value={zineIssue.publisher} onChange={(e) => updateZineIssue({ publisher: e.target.value })} /></div>
                <div className="field"><label>TARGET PAGES</label><input className="input" type="number" min={1} max={200} value={zineIssue.targetPages} onChange={(e) => updateZineIssue({ targetPages: Math.max(1, Number(e.target.value) || 1) })} /></div>
              </div>
              <div className="field"><label>ISSUE DESCRIPTION</label><textarea className="textarea" rows={4} value={zineIssue.description} onChange={(e) => updateZineIssue({ description: e.target.value })} /></div>
            </div>

            <div className="publish-meta-grid">
              <div><span className="mono-xs">FORMAT</span><strong>WEB EDITION / A5</strong></div>
              <div><span className="mono-xs">PAGES</span><strong>{zinePages.length}</strong></div>
              <div><span className="mono-xs">PUBLISHED</span><strong>{zineIssue.publishedAt ? new Date(zineIssue.publishedAt).toLocaleDateString() : '—'}</strong></div>
              <div><span className="mono-xs">PRINT PACK</span><strong>PNG ZIP</strong></div>
            </div>

            <div className="publish-actions">
              <button className="btn btn--solid" onClick={() => publishIssue('open')} disabled={publishing || !zinePages.length}>
                <ExternalLink size={12} /> {publishing ? 'PUBLISHING…' : 'OPEN WEB EDITION'}
              </button>
              <button className="btn btn--ghost" onClick={() => publishIssue('download')} disabled={publishing || !zinePages.length}>
                <Download size={12} /> DOWNLOAD HTML
              </button>
              <button className="btn btn--ghost" onClick={exportIssue} disabled={publishing || working || !zinePages.length}>
                <Printer size={12} /> PRINT PACK / ZIP
              </button>
            </div>

            {publishing && (
              <div className="publish-progress">
                <span>{publishProgress}</span>
                <div className="publish-progress-track"><span /></div>
              </div>
            )}

            <p className="zine-note">The web edition is a self-contained HTML file: real page renders are embedded inside it, so it opens online or offline with no server. The print pack is a ZIP of every full-resolution PNG page plus a manifest. No content is uploaded or scraped.</p>
          </div>
        </div>
      </Modal>
    </div>
  )
}
