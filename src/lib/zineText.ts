import type { ZinePageLayout, ZineTextBlock, ZineTextLayout, ZineTextTransform } from './types'

export const ZINE_TEXT_BLOCKS: { key: ZineTextBlock; label: string }[] = [
  { key: 'headline', label: 'HEADLINE' },
  { key: 'subhead', label: 'SUBHEAD' },
  { key: 'body', label: 'BODY' },
  { key: 'caption', label: 'CAPTION' },
  { key: 'note', label: 'NOTE' },
]

const base = (x: number, y: number, scale = 1): ZineTextTransform => ({ x, y, scale })

export const ZINE_TEXT_DEFAULTS: Record<ZinePageLayout, Record<ZineTextBlock, ZineTextTransform>> = {
  standard: {
    headline: base(0.075, 0.16),
    subhead: base(0.075, 0.73),
    body: base(0.075, 0.78),
    caption: base(0.075, 0.945),
    note: base(0.925, 0.945),
  },
  full: {
    headline: base(0.075, 0.62),
    subhead: base(0.075, 0.89),
    body: base(0.075, 0.93, 0.8),
    caption: base(0.075, 0.958),
    note: base(0.925, 0.958),
  },
  split: {
    headline: base(0.565, 0.16),
    subhead: base(0.565, 0.5),
    body: base(0.565, 0.61),
    caption: base(0.565, 0.86),
    note: base(0.565, 0.945),
  },
  quiet: {
    headline: base(0.075, 0.16),
    subhead: base(0.075, 0.77),
    body: base(0.075, 0.815),
    caption: base(0.075, 0.955),
    note: base(0.925, 0.955),
  },
}

export function textTransform(
  layout: ZinePageLayout | undefined,
  text: ZineTextLayout | undefined,
  block: ZineTextBlock,
): ZineTextTransform {
  const fallback = ZINE_TEXT_DEFAULTS[layout ?? 'standard'][block]
  const override = text?.[block]
  return {
    x: override?.x ?? fallback.x,
    y: override?.y ?? fallback.y,
    scale: override?.scale ?? fallback.scale,
    color: override?.color,
    font: override?.font,
    weight: override?.weight,
    italic: override?.italic,
    align: override?.align,
  }
}

export const LAYOUT_BLOCK_MAP: Record<ZinePageLayout, ZineTextBlock[]> = {
  standard: ['headline', 'subhead', 'body', 'caption', 'note'],
  full: ['headline', 'subhead', 'caption', 'note'],
  split: ['headline', 'subhead', 'body', 'caption', 'note'],
  quiet: ['headline', 'subhead', 'body', 'caption', 'note'],
}
