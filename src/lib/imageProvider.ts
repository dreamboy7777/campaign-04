export type HordeModel = 'draft' | 'editorial' | 'photographic' | 'experimental'

export const MODEL_OPTIONS: { id: HordeModel; label: string; note: string; models: string[]; steps: number }[] = [
  { id: 'draft', label: 'Draft / fast', note: 'Stable Diffusion 1.5 · quick studio proofs', models: ['stable_diffusion', 'Deliberate', 'Dreamshaper'], steps: 22 },
  { id: 'editorial', label: 'Editorial / SDXL', note: 'SDXL · campaign finals', models: ['SDXL 1.0', 'Juggernaut XL', 'AlbedoBase XL (SDXL)'], steps: 28 },
  { id: 'photographic', label: 'Photographic', note: 'ICBINP · natural skin and light', models: ["ICBINP - I Can't Believe It's Not Photography", 'Juggernaut XL'], steps: 26 },
  { id: 'experimental', label: 'Experimental', note: 'Flux Schnell · strange, graphic, slow', models: ['Flux.1-Schnell fp8 (Compact)'], steps: 4 },
]

export interface GenerationResult {
  blob: Blob
  model: string
  seed: string
  worker: string
  id: string
}

export interface HordeProgress {
  status: 'submitting' | 'waiting' | 'downloading'
  position?: number
  wait?: number
  processing?: number
}

const API = 'https://stablehorde.net/api/v2'

function clientAgent() {
  return 'CAMPAIGN04:1.0:github.com/campaign04/studio'
}

async function readError(res: Response): Promise<string> {
  try {
    const text = await res.text()
    return text.slice(0, 400) || `${res.status} ${res.statusText}`
  } catch {
    return `${res.status} ${res.statusText}`
  }
}

export async function generateWithHorde({
  prompt,
  negative,
  width,
  height,
  model = 'draft',
  apiKey,
  safeMode = true,
  onProgress,
  signal,
}: {
  prompt: string
  negative?: string
  width: number
  height: number
  model?: HordeModel
  apiKey?: string
  safeMode?: boolean
  onProgress?: (p: HordeProgress) => void
  signal?: AbortSignal
}): Promise<GenerationResult> {
  const option = MODEL_OPTIONS.find((m) => m.id === model) ?? MODEL_OPTIONS[0]
  const key = apiKey?.trim() || '0000000000'
  const safePrompt = `${prompt.slice(0, 1500)} ### ${(negative || 'text, watermark, logo, signature, deformed anatomy, plastic skin, cgi').slice(0, 500)}`
  const payload = {
    prompt: safePrompt,
    params: {
      width: Math.min(1024, Math.max(256, Math.round(width / 64) * 64)),
      height: Math.min(1024, Math.max(256, Math.round(height / 64) * 64)),
      steps: option.steps,
      n: 1,
      sampler_name: 'k_euler_a',
      cfg_scale: 6.5,
      karras: true,
    },
    models: option.models,
    r2: true,
    nsfw: false,
    censor_nsfw: safeMode,
    slow_workers: true,
  }

  onProgress?.({ status: 'submitting' })
  const submit = await fetch(`${API}/generate/async`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      'Client-Agent': clientAgent(),
    },
    body: JSON.stringify(payload),
    signal,
  })
  if (!submit.ok) {
    throw new Error(`The image service refused the job. ${await readError(submit)}`)
  }
  const { id } = (await submit.json()) as { id: string }
  if (!id) throw new Error('The image service did not return a job id.')

  const started = Date.now()
  for (;;) {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
    if (Date.now() - started > 1000 * 60 * 18) throw new Error('The image service timed out. The queue may be busy — try again or use Draft mode.')
    await sleep(3500, signal)
    const checkRes = await fetch(`${API}/generate/check/${id}`, {
      headers: { 'Client-Agent': clientAgent() },
      signal,
    })
    if (!checkRes.ok) continue
    const check = (await checkRes.json()) as {
      done: boolean
      faulted?: boolean
      queue_position?: number
      wait_time?: number
      processing?: number
    }
    if (check.faulted) throw new Error('The generation failed on the worker. Try a different model.')
    if (check.done) break
    onProgress?.({ status: 'waiting', position: check.queue_position, wait: check.wait_time, processing: check.processing })
  }

  onProgress?.({ status: 'downloading' })
  const statusRes = await fetch(`${API}/generate/status/${id}`, {
    headers: { 'Client-Agent': clientAgent() },
    signal,
  })
  if (!statusRes.ok) throw new Error(`Could not collect the finished image. ${await readError(statusRes)}`)
  const status = (await statusRes.json()) as {
    generations: { img: string; model: string; seed: string; worker_name: string; censored?: boolean }[]
    message?: string
  }
  const gen = status.generations?.[0]
  if (!gen?.img) throw new Error(status.message || 'The service returned no image.')
  const imgRes = await fetch(gen.img, { signal })
  if (!imgRes.ok) throw new Error('The finished image could not be downloaded.')
  const blob = await imgRes.blob()
  if (!blob.size) throw new Error('The downloaded image was empty.')
  return { blob, model: gen.model, seed: gen.seed, worker: gen.worker_name, id }
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Cancelled', 'AbortError'))
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(t)
      reject(new DOMException('Cancelled', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

export function dimensionsFor(aspect: string): { width: number; height: number } {
  switch (aspect) {
    case '4:5':
      return { width: 768, height: 960 }
    case '3:4':
      return { width: 768, height: 1024 }
    case '2:3':
      return { width: 704, height: 1056 }
    case '1:1':
      return { width: 896, height: 896 }
    case '16:9':
      return { width: 1024, height: 576 }
    case '9:16':
      return { width: 576, height: 1024 }
    default:
      return { width: 768, height: 1024 }
  }
}
