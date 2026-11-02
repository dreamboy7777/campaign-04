export type DepartmentId =
  | 'dashboard'
  | 'studio'
  | 'director'
  | 'styles'
  | 'archive'
  | 'darkroom'
  | 'editorial'
  | 'campaigns'
  | 'tumblr'
  | 'brandlab'
  | 'zine'
  | 'contactsheets'
  | 'typography'
  | 'export'
  | 'settings'

export interface NavItem {
  id: DepartmentId
  index: string
  label: string
  sub: string
  group: string
}

export type ControlKey =
  | 'nostalgia'
  | 'editorial'
  | 'imperfection'
  | 'intimacy'
  | 'flash'
  | 'film'
  | 'composition'
  | 'typography'
  | 'color'
  | 'surrealism'
  | 'minimalism'
  | 'commercial'

export type Controls = Record<ControlKey, number>

export interface TypographySpec {
  display: string
  body: string
  note: string
}

export interface StylePreset {
  id: string
  name: string
  family: string
  era: string
  index: string
  blurb: string
  description: string
  photography: string[]
  lighting: string[]
  composition: string[]
  colorWords: string[]
  palette: string[]
  typography: TypographySpec
  promptCore: string
  negative: string
  film: string
  controls: Partial<Controls>
  cover?: string
  coverPosition?: string
}

export interface Analysis {
  palette: string[]
  brightness: number
  contrast: number
  saturation: number
  warmth: number
  grain: number
  negativeSpace: number
  aspect: string
  orientation: 'portrait' | 'landscape' | 'square'
  lighting: string
  mood: string[]
  composition: string[]
  era: string
  summary: string
}

export interface Asset {
  id: string
  src: string
  title: string
  kind: 'photograph' | 'still life' | 'editorial' | 'layout' | 'upload' | 'plate'
  source: 'seed' | 'upload' | 'generated' | 'edited' | 'layout' | 'collage' | 'open' | 'imported'
  prompt?: string
  styleId?: string
  palette?: string[]
  createdAt: number
  width?: number
  height?: number
  collection?: string
  tags?: string[]
  note?: string
  caption?: string
  favorite?: boolean
  meta?: Record<string, string | number>
  analysis?: Analysis
}

export interface Reference {
  id: string
  assetId: string
  collection: string
  note: string
  analysis: Analysis
  createdAt: number
}

export interface BriefSection {
  label: string
  body: string
  items?: string[]
}

export interface Brief {
  id: string
  title: string
  subtitle: string
  idea: string
  concept: string
  photography: string[]
  casting: string[]
  location: string[]
  lighting: string[]
  palette: string[]
  typography: TypographySpec
  composition: string[]
  copy: string[]
  headlines: string[]
  deliverables: string[]
  prompt: string
  negative: string
  styleId: string
  controls: Controls
  createdAt: number
  revision: number
}

export interface CampaignAsset {
  id: string
  slot: string
  label: string
  description: string
  assetId?: string
  status: 'empty' | 'queued' | 'generating' | 'ready'
  prompt: string
  locked?: boolean
}

export interface Campaign {
  id: string
  title: string
  brand: string
  season: string
  concept: string
  styleId: string
  palette: string[]
  typography: TypographySpec
  copy: string
  prompt: string
  negative: string
  seed: number
  createdAt: number
  updatedAt: number
  status: 'draft' | 'in progress' | 'complete'
  briefId?: string
  assets: CampaignAsset[]
}

export interface Brand {
  id: string
  name: string
  tagline: string
  archetype: string
  personality: string[]
  palette: string[]
  displayFont: string
  bodyFont: string
  wordmark: string
  story: string
  voice: string
  packaging: string
  createdAt: number
  coverAssetId?: string
}

export interface CustomStyle {
  id: string
  name: string
  blurb: string
  ingredients: { styleId: string; weight: number }[]
  palette: string[]
  promptCore: string
  controls: Controls
  typography: TypographySpec
  createdAt: number
}

export interface Project {
  id: string
  title: string
  kind: string
  coverAssetId?: string
  campaignId?: string
  updatedAt: number
}

export interface GenerationJob {
  id: string
  prompt: string
  negative: string
  width: number
  height: number
  status: 'queued' | 'submitting' | 'waiting' | 'downloading' | 'done' | 'error' | 'cancelled'
  createdAt: number
  startedAt?: number
  finishedAt?: number
  queuePosition?: number
  eta?: number
  error?: string
  assetId?: string
  target?: { kind: 'studio' | 'campaign' | 'contact' | 'tumblr'; campaignId?: string; slot?: string }
  styleId?: string
  seed?: number
  model?: string
}

export interface ExportRecord {
  id: string
  name: string
  format: string
  width: number
  height: number
  createdAt: number
  assetId?: string
}

export interface Toast {
  id: string
  title: string
  message?: string
  tone?: 'default' | 'error' | 'success'
}

export interface BlogIdentity {
  id: string
  title: string
  url: string
  bio: string
  palette: string[]
  theme: string
  headerAssetId?: string
  avatarAssetId?: string
  createdAt: number
}

export interface BlogPost {
  id: string
  assetId?: string
  caption: string
  tags: string[]
  createdAt: number
  status: 'published' | 'queued'
  notes: number
  rebloggedFrom?: string
}

export type ZinePageLayout = 'standard' | 'full' | 'split' | 'quiet'

export type ZineTextBlock = 'headline' | 'subhead' | 'body' | 'caption' | 'note'

export interface ZineTextTransform {
  x: number
  y: number
  scale: number
  color?: string
  font?: string
  weight?: number
  italic?: boolean
  align?: 'left' | 'center' | 'right'
}

export type ZineTextLayout = Partial<Record<ZineTextBlock, ZineTextTransform>>

export interface ZinePage {
  id: string
  template: 'cover' | 'editorial' | 'collage' | 'back'
  layout?: ZinePageLayout
  text?: ZineTextLayout
  headline: string
  subhead: string
  body: string
  imageId?: string
  secondaryImageId?: string
  palette: string[]
  caption: string
  note: string
  focusX?: number
  focusY?: number
}

export interface ZineIssue {
  title: string
  number: string
  season: string
  publisher: string
  description: string
  targetPages: number
  status: 'draft' | 'published'
  publishedAt?: number
}

export interface StudioSettings {
  name: string
  hordeKey: string
  defaultModel: 'draft' | 'editorial' | 'photographic' | 'experimental'
  defaultAspect: string
  showGrid: boolean
  reduceMotion: boolean
  safeMode: boolean
}

export interface Usage {
  generations: number
  exports: number
  credits: number
}

