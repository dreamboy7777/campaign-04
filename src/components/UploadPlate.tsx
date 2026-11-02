import { useRef, useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { useApp, uid } from '../lib/store'
import { analyzeImage } from '../lib/analyze'
import { saveAssetBlob } from '../lib/imageStore'
import type { Asset } from '../lib/types'

function fileTitle(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Laptop upload'
}

export function UploadPlate({
  onPicked,
  label = 'UPLOAD FROM LAPTOP',
  variant = 'tile',
  ratio = '1 / 1',
  className = '',
}: {
  onPicked?: (asset: Asset) => void
  label?: string
  variant?: 'tile' | 'button'
  ratio?: string
  className?: string
}) {
  const addAsset = useApp((s) => s.addAsset)
  const toast = useApp((s) => s.toast)
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)

  const upload = async (file?: File) => {
    if (!file || busy) return
    if (!file.type.startsWith('image/')) {
      toast('Not an image', 'Choose a JPG, PNG, WEBP or another image file.', 'error')
      return
    }
    setBusy(true)
    const objectUrl = URL.createObjectURL(file)
    try {
      const { analysis, width, height } = await analyzeImage(objectUrl)
      const asset = await saveAssetBlob(file, {
        id: uid('upload'),
        title: fileTitle(file.name),
        kind: 'upload',
        source: 'upload',
        createdAt: Date.now(),
        width,
        height,
        collection: 'Personal photographs',
        tags: ['upload', analysis.era, analysis.lighting],
        palette: analysis.palette,
        caption: 'LAPTOP UPLOAD / READ',
        note: 'Added from this device.',
        analysis,
      })
      addAsset(asset)
      toast('Image added', `${asset.title} is in the archive${onPicked ? ' and selected.' : '.'}`, 'success')
      onPicked?.(asset)
    } catch {
      toast('Could not read that image', 'Try a JPG, PNG or WEBP file.', 'error')
    } finally {
      URL.revokeObjectURL(objectUrl)
      setBusy(false)
    }
  }

  if (variant === 'button') {
    return (
      <>
        <input
          ref={inputRef}
          hidden
          type="file"
          accept="image/*"
          onChange={(e) => {
            void upload(e.target.files?.[0])
            e.currentTarget.value = ''
          }}
        />
        <button className={`btn btn--solid btn--sm ${className}`} onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? <Loader2 size={11} className="spin" /> : <Upload size={11} />}
          {busy ? 'READING…' : label}
        </button>
      </>
    )
  }

  return (
    <>
      <input
        ref={inputRef}
        hidden
        type="file"
        accept="image/*"
        onChange={(e) => {
          void upload(e.target.files?.[0])
          e.currentTarget.value = ''
        }}
      />
      <button
        className={`upload-plate ${dragging ? 'is-dragging' : ''} ${className}`}
        style={{ aspectRatio: ratio }}
        onClick={() => !busy && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          void upload(e.dataTransfer.files?.[0])
        }}
        disabled={busy}
      >
        <span className="upload-plate-mark">
          {busy ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
        </span>
        <strong>{busy ? 'READING…' : label}</strong>
        <em>JPG / PNG / WEBP</em>
      </button>
    </>
  )
}
