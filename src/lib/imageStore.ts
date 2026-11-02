import type { Asset } from './types'

const DB_NAME = 'campaign04-studio'
const DB_VERSION = 1
const ASSET_STORE = 'assets'
const FONT_STORE = 'fonts'

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(ASSET_STORE)) db.createObjectStore(ASSET_STORE, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(FONT_STORE)) db.createObjectStore(FONT_STORE, { keyPath: 'name' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode)
        const req = run(t.objectStore(store))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

type AssetMeta = Omit<Asset, 'src'>
type StoredAssetRecord = AssetMeta & { src?: string; blob?: Blob; savedAt?: number }

export async function saveAssetBlob(blob: Blob, meta: AssetMeta): Promise<Asset> {
  const record: StoredAssetRecord = { ...meta, blob, savedAt: Date.now() }
  await tx(ASSET_STORE, 'readwrite', (s) => s.put(record))
  return { ...meta, src: URL.createObjectURL(blob) }
}

/** Persist metadata changes without replacing the stored image blob. */
export async function saveAssetMetadata(asset: Asset): Promise<void> {
  const existing = await tx<StoredAssetRecord | undefined>(ASSET_STORE, 'readonly', (s) => s.get(asset.id))
  const { src, ...meta } = asset
  const record: StoredAssetRecord = { ...meta, savedAt: Date.now() }
  if (src.startsWith('blob:')) {
    if (existing?.blob instanceof Blob) record.blob = existing.blob
  } else {
    record.src = src
  }
  await tx(ASSET_STORE, 'readwrite', (s) => s.put(record))
}

/** Keep a remote image as a lightweight reference without downloading its bytes. */
export async function saveRemoteAsset(asset: Asset): Promise<Asset> {
  const { src, ...meta } = asset
  const record: StoredAssetRecord = { ...meta, src, savedAt: Date.now() }
  await tx(ASSET_STORE, 'readwrite', (s) => s.put(record))
  return asset
}

export async function saveRemoteAssets(assets: Asset[]): Promise<void> {
  if (!assets.length) return
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(ASSET_STORE, 'readwrite')
    const store = t.objectStore(ASSET_STORE)
    assets.forEach((asset) => {
      const { src, ...meta } = asset
      store.put({ ...meta, src, savedAt: Date.now() })
    })
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
  })
}

export async function loadStoredAssets(): Promise<Asset[]> {
  try {
    const records = await tx<StoredAssetRecord[]>(ASSET_STORE, 'readonly', (s) => s.getAll())
    return records
      .filter((r) => r.blob instanceof Blob || typeof r.src === 'string')
      .map((r) => {
        const { blob, savedAt, src: storedSrc, ...meta } = r
        return {
          ...(meta as AssetMeta),
          src: blob instanceof Blob ? URL.createObjectURL(blob) : (storedSrc as string),
        }
      })
  } catch (err) {
    console.warn('Could not load stored assets', err)
    return []
  }
}

export async function deleteStoredAsset(id: string): Promise<void> {
  await tx(ASSET_STORE, 'readwrite', (s) => s.delete(id))
}

export async function saveFontFile(name: string, buffer: ArrayBuffer): Promise<void> {
  await tx(FONT_STORE, 'readwrite', (s) => s.put({ name, buffer, createdAt: Date.now() }))
}

export async function loadStoredFonts(): Promise<{ name: string; buffer: ArrayBuffer }[]> {
  try {
    return await tx(FONT_STORE, 'readonly', (s) => s.getAll())
  } catch {
    return []
  }
}

export async function clearStoredData(): Promise<void> {
  const db = await openDB()
  await Promise.all(
    [ASSET_STORE, FONT_STORE].map(
      (store) =>
        new Promise<void>((resolve, reject) => {
          const t = db.transaction(store, 'readwrite')
          const req = t.objectStore(store).clear()
          req.onsuccess = () => resolve()
          req.onerror = () => reject(req.error)
        }),
    ),
  )
}

export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export async function dataURLToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  return res.blob()
}

export async function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export async function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/jpeg', quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not export canvas'))), type, quality)
  })
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Image could not be loaded'))
    img.src = src
  })
}
