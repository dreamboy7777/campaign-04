import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Asset,
  BlogIdentity,
  BlogPost,
  Brand,
  Brief,
  Campaign,
  CustomStyle,
  DepartmentId,
  ExportRecord,
  GenerationJob,
  Project,
  Reference,
  Toast,
  Usage,
  ZineIssue,
  ZinePage,
  StudioSettings,
  Controls,
} from './types'
import {
  SEED_ASSETS,
  SEED_BLOG,
  SEED_BLOG_POSTS,
  SEED_BRANDS,
  SEED_CAMPAIGNS,
  SEED_CUSTOM_STYLES,
  SEED_PROJECTS,
  SEED_REFERENCES,
  SEED_ZINE_ISSUE,
  SEED_ZINE_PAGES,
} from './seed'
import { deleteStoredAsset, saveAssetMetadata } from './imageStore'

export const uid = (prefix = 'id') => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

export interface StudioState {
  prompt: string
  styleId: string
  controls: Controls
  aspect: string
  model: StudioSettings['defaultModel']
  referenceIds: string[]
  history: string[]
}

interface AppState {
  theme: 'day' | 'night'
  route: DepartmentId
  sidebarCollapsed: boolean
  mobileNavOpen: boolean
  commandOpen: boolean
  assets: Asset[]
  deletedSeedIds: string[]
  references: Reference[]
  campaigns: Campaign[]
  brands: Brand[]
  projects: Project[]
  customStyles: CustomStyle[]
  briefs: Brief[]
  blog: BlogIdentity
  blogPosts: BlogPost[]
  zinePages: ZinePage[]
  zineIssue: ZineIssue
  jobs: GenerationJob[]
  exports: ExportRecord[]
  toasts: Toast[]
  usage: Usage
  settings: StudioSettings
  studio: StudioState
  editorDraft: { campaignId?: string; briefId?: string; styleId?: string } | null
  focusAssetId?: string
  setTheme: (theme: 'day' | 'night') => void
  toggleTheme: () => void
  navigate: (route: DepartmentId) => void
  setSidebarCollapsed: (v: boolean) => void
  setMobileNavOpen: (v: boolean) => void
  setCommandOpen: (v: boolean) => void
  toast: (title: string, message?: string, tone?: Toast['tone']) => void
  dismissToast: (id: string) => void
  hydrateAssets: (assets: Asset[]) => void
  addAsset: (asset: Asset) => void
  addAssets: (assets: Asset[]) => void
  updateAsset: (id: string, patch: Partial<Asset>) => void
  removeAsset: (id: string) => void
  toggleFavorite: (id: string) => void
  addReference: (ref: Reference) => void
  removeReference: (id: string) => void
  addBrief: (brief: Brief) => void
  addCampaign: (campaign: Campaign) => void
  updateCampaign: (id: string, patch: Partial<Campaign>) => void
  removeCampaign: (id: string) => void
  updateCampaignSlot: (campaignId: string, slotId: string, patch: Partial<Campaign['assets'][number]>) => void
  duplicateCampaign: (id: string) => void
  addBrand: (brand: Brand) => void
  updateBrand: (id: string, patch: Partial<Brand>) => void
  addProject: (project: Project) => void
  updateProject: (id: string, patch: Partial<Project>) => void
  addCustomStyle: (style: CustomStyle) => void
  removeCustomStyle: (id: string) => void
  setBlog: (blog: BlogIdentity) => void
  addBlogPost: (post: BlogPost) => void
  updateBlogPost: (id: string, patch: Partial<BlogPost>) => void
  removeBlogPost: (id: string) => void
  typePairing?: { display: string; body: string; note?: string }
  setTypePairing: (pairing?: { display: string; body: string; note?: string }) => void
  addZinePage: (page: ZinePage) => void
  updateZinePage: (id: string, patch: Partial<ZinePage>) => void
  removeZinePage: (id: string) => void
  moveZinePage: (id: string, dir: -1 | 1) => void
  setZinePages: (pages: ZinePage[]) => void
  updateZineIssue: (patch: Partial<ZineIssue>) => void
  markZinePublished: () => void
  startJob: (job: Omit<GenerationJob, 'id' | 'status' | 'createdAt'>) => string
  updateJob: (id: string, patch: Partial<GenerationJob>) => void
  cancelJob: (id: string) => void
  clearFinishedJobs: () => void
  addExport: (record: ExportRecord) => void
  setUsage: (patch: Partial<Usage>) => void
  updateSettings: (patch: Partial<StudioSettings>) => void
  updateStudio: (patch: Partial<StudioState>) => void
  setEditorDraft: (draft: AppState['editorDraft']) => void
  setFocusAsset: (id?: string) => void
  attachAsset: (campaignId: string, slotId: string, assetId: string) => void
  addToStudioHistory: (assetId: string, prompt?: string) => void
  resetStudio: () => void
}

const DEFAULT_STUDIO: StudioState = {
  prompt:
    'A perfume called AFTER THE RAIN. Being in love with someone you have not seen in years. Very 2006, American Apparel photography, French editorial, Tumblr melancholy.',
  styleId: 'romantic-archive',
  controls: {
    nostalgia: 78,
    editorial: 72,
    imperfection: 56,
    intimacy: 82,
    flash: 34,
    film: 64,
    composition: 46,
    typography: 52,
    color: 34,
    surrealism: 22,
    minimalism: 48,
    commercial: 46,
  },
  aspect: '3:4',
  model: 'draft',
  referenceIds: ['seed-perfume', 'seed-portrait-wall', 'seed-mirror'],
  history: ['seed-portrait-wall', 'seed-editorial-red', 'seed-mirror', 'seed-bedroom-flash'],
}

const DEFAULT_SETTINGS: StudioSettings = {
  name: 'Studio 04',
  hordeKey: '',
  defaultModel: 'draft',
  defaultAspect: '3:4',
  showGrid: true,
  reduceMotion: false,
  safeMode: true,
}

const draftIssue = (issue: ZineIssue): ZineIssue =>
  issue.status === 'published' ? { ...issue, status: 'draft', publishedAt: undefined } : issue

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      theme: 'day',
      route: 'dashboard',
      sidebarCollapsed: false,
      mobileNavOpen: false,
      commandOpen: false,
      assets: SEED_ASSETS,
      deletedSeedIds: [],
      references: SEED_REFERENCES,
      campaigns: SEED_CAMPAIGNS,
      brands: SEED_BRANDS,
      projects: SEED_PROJECTS,
      customStyles: SEED_CUSTOM_STYLES,
      briefs: [],
      blog: SEED_BLOG,
      blogPosts: SEED_BLOG_POSTS,
      zinePages: SEED_ZINE_PAGES,
      zineIssue: SEED_ZINE_ISSUE,
      typePairing: undefined,
      jobs: [],
      exports: [],
      toasts: [],
      usage: { generations: 28, exports: 6, credits: 120 },
      settings: DEFAULT_SETTINGS,
      studio: DEFAULT_STUDIO,
      editorDraft: null,
      focusAssetId: undefined,

      setTheme: (theme) => {
        document.documentElement.dataset.theme = theme
        set({ theme })
      },
      toggleTheme: () => {
        const theme = get().theme === 'day' ? 'night' : 'day'
        document.documentElement.dataset.theme = theme
        set({ theme })
      },
      navigate: (route) => {
        set({ route, mobileNavOpen: false, commandOpen: false })
        window.location.hash = `#/${route}`
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
      },
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      setMobileNavOpen: (v) => set({ mobileNavOpen: v }),
      setCommandOpen: (v) => set({ commandOpen: v }),
      toast: (title, message, tone = 'default') => {
        const id = uid('toast')
        set((s) => ({ toasts: [...s.toasts, { id, title, message, tone }] }))
        setTimeout(() => {
          set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
        }, 5200)
      },
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
      hydrateAssets: (stored) =>
        set((s) => {
          const deleted = new Set(s.deletedSeedIds)
          const seeded = SEED_ASSETS.filter((a) => !deleted.has(a.id))
          const byId = new Map<string, Asset>()
          // Stored imports and generations come first so a reload keeps the newest work on top.
          ;[...stored, ...s.assets, ...seeded].forEach((a) => byId.set(a.id, a))
          return { assets: [...byId.values()] }
        }),
      addAsset: (asset) =>
        set((s) => {
          const existing = s.assets.findIndex((a) => a.id === asset.id)
          const assets = existing >= 0 ? s.assets.map((a) => (a.id === asset.id ? asset : a)) : [asset, ...s.assets]
          return { assets }
        }),
      addAssets: (incoming) =>
        set((s) => {
          if (!incoming.length) return s
          const incomingIds = new Set(incoming.map((a) => a.id))
          const kept = s.assets.filter((a) => !incomingIds.has(a.id))
          return { assets: [...incoming, ...kept] }
        }),
      updateAsset: (id, patch) => {
        const current = get().assets.find((a) => a.id === id)
        if (!current) return
        const next = { ...current, ...patch }
        set((s) => ({ assets: s.assets.map((a) => (a.id === id ? next : a)) }))
        if (next.source !== 'seed') saveAssetMetadata(next).catch(() => {})
      },
      removeAsset: (id) => {
        const asset = get().assets.find((a) => a.id === id)
        if (!asset) return
        if (asset.source !== 'seed') deleteStoredAsset(id).catch(() => {})
        set((s) => ({
          assets: s.assets.filter((a) => a.id !== id),
          references: s.references.filter((r) => r.assetId !== id),
          deletedSeedIds: asset.source === 'seed' ? [...new Set([...s.deletedSeedIds, id])] : s.deletedSeedIds,
          campaigns: s.campaigns.map((c) => ({
            ...c,
            assets: c.assets.map((ca) =>
              ca.assetId === id ? { ...ca, assetId: undefined, status: 'empty' as const, locked: false } : ca,
            ),
          })),
          studio: { ...s.studio, history: s.studio.history.filter((h) => h !== id) },
        }))
      },
      toggleFavorite: (id) => {
        const current = get().assets.find((a) => a.id === id)
        if (!current) return
        const next = { ...current, favorite: !current.favorite }
        set((s) => ({ assets: s.assets.map((a) => (a.id === id ? next : a)) }))
        if (next.source !== 'seed') saveAssetMetadata(next).catch(() => {})
      },
      addReference: (ref) => set((s) => ({ references: [ref, ...s.references] })),
      removeReference: (id) => set((s) => ({ references: s.references.filter((r) => r.id !== id) })),
      addBrief: (brief) => set((s) => ({ briefs: [brief, ...s.briefs].slice(0, 40) })),
      addCampaign: (campaign) =>
        set((s) => ({
          campaigns: [campaign, ...s.campaigns],
          projects: [
            {
              id: uid('prj'),
              title: campaign.title,
              kind: 'Campaign',
              coverAssetId: campaign.assets.find((a) => a.assetId)?.assetId,
              campaignId: campaign.id,
              updatedAt: Date.now(),
            },
            ...s.projects,
          ],
        })),
      updateCampaign: (id, patch) =>
        set((s) => ({
          campaigns: s.campaigns.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c)),
        })),
      removeCampaign: (id) => set((s) => ({ campaigns: s.campaigns.filter((c) => c.id !== id) })),
      updateCampaignSlot: (campaignId, slotId, patch) =>
        set((s) => ({
          campaigns: s.campaigns.map((c) =>
            c.id === campaignId
              ? { ...c, updatedAt: Date.now(), assets: c.assets.map((a) => (a.id === slotId ? { ...a, ...patch } : a)) }
              : c,
          ),
        })),
      duplicateCampaign: (id) => {
        const c = get().campaigns.find((x) => x.id === id)
        if (!c) return
        const copy: Campaign = {
          ...c,
          id: uid('cmp'),
          title: `${c.title} (copy)`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          assets: c.assets.map((a) => ({ ...a, id: uid('ca') })),
        }
        set((s) => ({ campaigns: [copy, ...s.campaigns] }))
      },
      addBrand: (brand) => set((s) => ({ brands: [brand, ...s.brands] })),
      updateBrand: (id, patch) =>
        set((s) => ({ brands: s.brands.map((b) => (b.id === id ? { ...b, ...patch } : b)) })),
      addProject: (project) => set((s) => ({ projects: [project, ...s.projects] })),
      updateProject: (id, patch) =>
        set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      addCustomStyle: (style) => set((s) => ({ customStyles: [style, ...s.customStyles] })),
      removeCustomStyle: (id) => set((s) => ({ customStyles: s.customStyles.filter((c) => c.id !== id) })),
      setBlog: (blog) => set({ blog }),
      addBlogPost: (post) => set((s) => ({ blogPosts: [post, ...s.blogPosts] })),
      updateBlogPost: (id, patch) =>
        set((s) => ({ blogPosts: s.blogPosts.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      removeBlogPost: (id) => set((s) => ({ blogPosts: s.blogPosts.filter((p) => p.id !== id) })),
      setTypePairing: (typePairing) => set({ typePairing }),
      addZinePage: (page) =>
        set((s) => ({ zinePages: [...s.zinePages, page], zineIssue: draftIssue(s.zineIssue) })),
      updateZinePage: (id, patch) =>
        set((s) => ({
          zinePages: s.zinePages.map((p) => (p.id === id ? { ...p, ...patch } : p)),
          zineIssue: draftIssue(s.zineIssue),
        })),
      removeZinePage: (id) =>
        set((s) => ({
          zinePages: s.zinePages.filter((p) => p.id !== id),
          zineIssue: draftIssue(s.zineIssue),
        })),
      moveZinePage: (id, dir) =>
        set((s) => {
          const i = s.zinePages.findIndex((p) => p.id === id)
          const j = i + dir
          if (i < 0 || j < 0 || j >= s.zinePages.length) return s
          const pages = [...s.zinePages]
          ;[pages[i], pages[j]] = [pages[j], pages[i]]
          return { zinePages: pages, zineIssue: draftIssue(s.zineIssue) }
        }),
      setZinePages: (zinePages) => set((s) => ({ zinePages, zineIssue: draftIssue(s.zineIssue) })),
      updateZineIssue: (patch) =>
        set((s) => ({
          zineIssue: {
            ...s.zineIssue,
            ...patch,
            status: patch.status ?? 'draft',
            publishedAt: patch.publishedAt ?? (patch.status === 'published' ? s.zineIssue.publishedAt : undefined),
          },
        })),
      markZinePublished: () =>
        set((s) => ({
          zineIssue: { ...s.zineIssue, status: 'published', publishedAt: Date.now() },
        })),
      startJob: (job) => {
        const id = uid('job')
        const full: GenerationJob = { ...job, id, status: 'queued', createdAt: Date.now() }
        set((s) => ({ jobs: [full, ...s.jobs].slice(0, 30) }))
        return id
      },
      updateJob: (id, patch) =>
        set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)) })),
      cancelJob: (id) => {
        const controller = activeControllers.get(id)
        controller?.abort()
        activeControllers.delete(id)
        set((s) => ({
          jobs: s.jobs.map((j) =>
            j.id === id && !['done', 'error'].includes(j.status) ? { ...j, status: 'cancelled', finishedAt: Date.now() } : j,
          ),
        }))
      },
      clearFinishedJobs: () =>
        set((s) => ({ jobs: s.jobs.filter((j) => !['done', 'error', 'cancelled'].includes(j.status)) })),
      addExport: (record) => set((s) => ({ exports: [record, ...s.exports].slice(0, 60) })),
      setUsage: (patch) => set((s) => ({ usage: { ...s.usage, ...patch } })),
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      updateStudio: (patch) => set((s) => ({ studio: { ...s.studio, ...patch } })),
      setEditorDraft: (editorDraft) => set({ editorDraft }),
      setFocusAsset: (focusAssetId) => set({ focusAssetId }),
      attachAsset: (campaignId, slotId, assetId) =>
        set((s) => ({
          campaigns: s.campaigns.map((c) =>
            c.id === campaignId
              ? {
                  ...c,
                  updatedAt: Date.now(),
                  assets: c.assets.map((a) => (a.id === slotId ? { ...a, assetId, status: 'ready' as const, locked: true } : a)),
                }
              : c,
          ),
        })),
      addToStudioHistory: (assetId, prompt) =>
        set((s) => ({
          studio: {
            ...s.studio,
            prompt: prompt ?? s.studio.prompt,
            history: [assetId, ...s.studio.history.filter((id) => id !== assetId)].slice(0, 18),
          },
          usage: { ...s.usage, generations: s.usage.generations + 1, credits: Math.max(0, s.usage.credits - 1) },
        })),
      resetStudio: () => set({ studio: DEFAULT_STUDIO }),
    }),
    {
      name: 'campaign04-studio-v1',
      version: 1,
      partialize: (state) => {
        const { jobs, toasts, commandOpen, mobileNavOpen, assets, ...rest } = state
        return rest
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return
        document.documentElement.dataset.theme = state.theme
        const hash = window.location.hash.replace('#/', '') as DepartmentId
        const valid = ['dashboard', 'studio', 'director', 'styles', 'archive', 'darkroom', 'editorial', 'campaigns', 'tumblr', 'brandlab', 'zine', 'contactsheets', 'typography', 'export', 'settings']
        if (hash && valid.includes(hash)) state.route = hash
        state.jobs = []
      },
    },
  ),
)

export const activeControllers = new Map<string, AbortController>()

export function useAsset(id?: string): Asset | undefined {
  return useApp((s) => (id ? s.assets.find((a) => a.id === id) : undefined))
}

export function useAssetMap() {
  return useApp((s) => s.assets)
}

export function assetById(assets: Asset[], id?: string) {
  return id ? assets.find((a) => a.id === id) : undefined
}
