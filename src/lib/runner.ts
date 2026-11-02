import { generateWithHorde } from './imageProvider'
import { saveAssetBlob } from './imageStore'
import { useApp, activeControllers } from './store'
import { STYLE_MAP } from './presets'
import type { Asset } from './types'

let started = false
let busy = false

export function startGenerationRunner() {
  if (started) return
  started = true
  setInterval(processQueue, 1200)
  processQueue()
}

async function processQueue() {
  if (busy) return
  const state = useApp.getState()
  const job = [...state.jobs].reverse().find((j) => j.status === 'queued')
  if (!job) return
  busy = true
  const controller = new AbortController()
  activeControllers.set(job.id, controller)
  useApp.getState().updateJob(job.id, { status: 'submitting', startedAt: Date.now() })
  try {
    const result = await generateWithHorde({
      prompt: job.prompt,
      negative: job.negative,
      width: job.width,
      height: job.height,
      model: job.model as never,
      apiKey: state.settings.hordeKey,
      safeMode: state.settings.safeMode,
      signal: controller.signal,
      onProgress: (p) => {
        if (p.status === 'waiting') {
          useApp.getState().updateJob(job.id, { status: 'waiting', queuePosition: p.position, eta: p.wait })
        } else if (p.status === 'downloading') {
          useApp.getState().updateJob(job.id, { status: 'downloading' })
        }
      },
    })
    const style = STYLE_MAP[job.styleId ?? '']
    const base: Omit<Asset, 'src'> = {
      id: `asset-${job.id}`,
      title: style ? `${style.name} / ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()}` : 'Untitled plate',
      kind: 'photograph',
      source: 'generated',
      prompt: job.prompt,
      styleId: job.styleId,
      palette: style?.palette ?? ['#d9c3a8', '#b08a6d', '#9a5a5e', '#5a3f38', '#e9ddc9'],
      createdAt: Date.now(),
      width: job.width,
      height: job.height,
      collection: 'Studio output',
      tags: ['generated', style?.family ?? 'studio'],
      caption: `STUDIO OUTPUT / ${result.seed.slice(0, 6)}`,
      meta: { model: result.model, seed: result.seed, worker: result.worker },
    }
    const asset = await saveAssetBlob(result.blob, base)
    useApp.getState().addAsset(asset)
    useApp.getState().updateJob(job.id, { status: 'done', assetId: asset.id, finishedAt: Date.now(), seed: Number(result.seed) || undefined })

    const target = job.target
    if (target?.kind === 'campaign' && target.campaignId && target.slot) {
      useApp.getState().updateCampaignSlot(target.campaignId, target.slot, {
        assetId: asset.id,
        status: 'ready',
        locked: false,
      })
      const campaign = useApp.getState().campaigns.find((c) => c.id === target.campaignId)
      if (campaign) {
        const allReady = campaign.assets.every((a) => a.id === target.slot || a.status === 'ready')
        if (allReady) useApp.getState().updateCampaign(campaign.id, { status: 'complete' })
      }
      useApp.getState().toast('Plate developed', `${asset.title} added to the campaign.`, 'success')
    } else if (target?.kind === 'studio') {
      useApp.getState().addToStudioHistory(asset.id)
      useApp.getState().toast('Plate developed', `${asset.title} added to your studio history.`, 'success')
    } else {
      useApp.getState().addToStudioHistory(asset.id)
      useApp.getState().toast('Image developed', 'Saved to the archive.', 'success')
    }
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === 'AbortError'
    const message = aborted ? 'Cancelled.' : err instanceof Error ? err.message : 'Generation failed.'
    useApp.getState().updateJob(job.id, {
      status: aborted ? 'cancelled' : 'error',
      finishedAt: Date.now(),
      error: message,
    })
    if (!aborted) useApp.getState().toast('The lab could not develop this plate', message, 'error')
    if (job.target?.kind === 'campaign' && job.target.campaignId && job.target.slot) {
      useApp.getState().updateCampaignSlot(job.target.campaignId, job.target.slot, { status: 'empty' })
    }
  } finally {
    activeControllers.delete(job.id)
    busy = false
  }
}
