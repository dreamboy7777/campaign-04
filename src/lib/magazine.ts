import type { Asset, ZineIssue, ZinePage, ZinePageLayout } from './types'

export interface MagazinePageBlueprint {
  template: ZinePage['template']
  layout?: ZinePageLayout
  headline: string
  subhead: string
  body: string
  imageId?: string
  secondaryImageId?: string
  caption: string
  note: string
  focusX?: number
  focusY?: number
}

export interface MagazinePreset {
  id: string
  name: string
  kicker: string
  description: string
  targetPages: number
  issue: Omit<ZineIssue, 'status' | 'publishedAt'>
  palette: string[]
  pages: MagazinePageBlueprint[]
}

const paletteA = ['#efe8d8', '#171512', '#9b5e63', '#d8b3a8', '#7b5a4a']
const paletteB = ['#e6ddcd', '#1b1815', '#9b5e63', '#c9a6a6', '#6f6a70']
const paletteC = ['#e5e0d2', '#141412', '#b7392f', '#c4a77d', '#2f4b78']

const page = (
  template: ZinePage['template'],
  layout: ZinePageLayout,
  headline: string,
  subhead: string,
  body: string,
  imageId: string | undefined,
  secondaryImageId: string | undefined,
  caption: string,
  note: string,
  focusY = 0.4,
): MagazinePageBlueprint => ({
  template,
  layout,
  headline,
  subhead,
  body,
  imageId,
  secondaryImageId,
  caption,
  note,
  focusX: 0.5,
  focusY,
})

const AFTER_RAIN_PAGES: MagazinePageBlueprint[] = [
  page('cover', 'standard', 'AFTER THE RAIN', 'A study in proximity, light and the things we keep.', 'A fragrance, a room, a photograph taken after everyone had gone home.', 'seed-perfume', 'seed-perfume-flowers', 'CAMPAIGN 04 / ISSUE 01', 'VOL. 001 · 2026 · £12', 0.4),
  page('editorial', 'standard', 'A ROOM THAT REMEMBERS', 'The house was never ours. We photographed it anyway.', 'The curtains were left open. The flash turned the room into a stage and the furniture into evidence. Nothing was arranged. The camera simply stayed long enough to see what the light would do.', 'seed-portrait-wall', 'seed-mirror', 'BEDROOM SERIES / 2006', 'PLATE 02 / THE HOUSE', 0.34),
  page('editorial', 'full', 'THE HOURS BETWEEN', '2:14 AM. The flash found everything.', 'A night that belonged to no one. The bedroom, the bottle, the last light in the hall. Photographed between one life and the next.', 'seed-bedroom-flash', undefined, 'AFTER HOURS / CONTACT 17', 'PLATE 03 / 2:14AM', 0.44),
  page('editorial', 'split', 'NOBODY WAS LOOKING', 'A flash, two friends, no plan.', 'Before the image was a campaign it was a Tuesday. A shoulder in the way, a lamp blown out, somebody laughing at the wrong moment. We kept the accidents because the accidents were true.', 'seed-mirror', 'seed-night-drive', 'TUMBLR FOREVER / 2012', 'PLATE 04 / THE ACCIDENT', 0.36),
  page('editorial', 'quiet', 'SOMETHING BORROWED', 'A red slip, a borrowed room, a door left open.', 'The best pictures looked like they had been taken without permission. That was the point. Intimacy is not a lighting setup; it is the decision to stay in the room.', 'seed-editorial-red', undefined, 'FOREVER / SPRING 2006', 'PLATE 05 / BORROWED', 0.42),
  page('collage', 'standard', 'PAPER, TAPE, CORRECTION', 'The issue is assembled on a desk, not in a grid.', 'Cut the type out. Copy the photograph until the blacks turn to dust. Leave the scissors where they fell. A publication is evidence of a hand making decisions.', 'seed-zine-desk', 'seed-clothing-rail', 'ZINE CULTURE / PROCESS', 'PLATE 06 / STUDIO FLOOR', 0.36),
  page('editorial', 'full', 'THE LAST GOOD SUMMER', 'It was already ending. We just did not know yet.', 'The light was soft, the clothes were simple, and the afternoon had nowhere else to be. A photograph of a feeling that was already leaving.', 'seed-cover-closeup', undefined, 'FOREVER / LAST DAYS', 'PLATE 07 / SUMMER', 0.4),
  page('editorial', 'standard', 'CLOSE ENOUGH TO DISAPPEAR', 'Portraits made at the edge of the flash.', 'Freckles, bare shoulders, a wall. The image does not explain the person; it keeps the fact of them. Look closer. It is already gone.', 'seed-portrait-wall', 'seed-mirror', 'PORTRAIT STUDY / 17', 'PLATE 08 / PROXIMITY', 0.32),
  page('editorial', 'split', 'STILL LIFE, AFTER HOURS', 'Perfume, roses, a marble table.', 'The room was almost empty. The objects were not styled so much as left behind. A bottle, a flower, a surface holding the last of the daylight.', 'seed-perfume-flowers', 'seed-perfume', 'STILL LIFE / MORNING', 'PLATE 09 / OBJECTS', 0.46),
  page('editorial', 'quiet', 'NOTES ON A BODY', 'What the image keeps that the room forgets.', 'The mirror was dirty. The flash was too close. None of that mattered. What mattered was the evidence: a room, a body, a night that would otherwise have disappeared.', 'seed-mirror', undefined, 'BEDROOM SERIES / 2012', 'PLATE 10 / MIRROR', 0.38),
  page('editorial', 'full', 'DRIVE HOME', 'No destination. Radio off. The road doing the thinking.', 'A streetlight, a dashboard, a passenger asleep against the window. The image is blurry because the night was moving.', 'seed-night-drive', undefined, 'AFTER HOURS / 04', 'PLATE 11 / THE ROAD', 0.42),
  page('editorial', 'standard', 'THE BEDROOM YEARS', 'Photographs made for nobody in particular.', 'The mirror was dirty and the flash was too close. None of that mattered. What mattered was the evidence: a room, a body, a night that would otherwise have disappeared.', 'seed-bedroom-flash', 'seed-portrait-wall', 'TUMBLR FOREVER / 2012', 'PLATE 12 / BEDROOM', 0.36),
  page('editorial', 'split', 'A STUDY IN PROXIMITY', 'Two people, one frame, no distance.', 'The best frames were accidents: a shoulder in the way, a lamp blown out, somebody laughing at the wrong moment. We kept the accidents because the accidents were true.', 'seed-editorial-red', 'seed-cover-closeup', 'AMERICAN ARCHIVE / 04', 'PLATE 13 / CONTACT', 0.44),
  page('collage', 'standard', 'FOUND IMAGES', 'Photocopies, scissors, correction fluid.', 'A found image, 2006. No credit line, no negative, no proof. The photocopy is the artifact now. The original is somewhere else, if it still exists.', 'seed-zine-desk', 'seed-perfume', 'ARCHIVE / UNTITLED', 'PLATE 14 / FOUND', 0.38),
  page('editorial', 'full', 'AFTER EVERYONE LEFT', 'The room held its breath.', 'A rail of clothes, a chair, a floor still holding the shape of the night. The afterimage of a party is also a portrait.', 'seed-clothing-rail', undefined, 'STUDIO / AFTER HOURS', 'PLATE 15 / EMPTY ROOM', 0.42),
  page('editorial', 'standard', 'WHAT WE KEPT', 'An inventory of small, unrepeatable things.', 'A perfume bottle, a dried flower, a photograph that survived three moves. The archive is not comprehensive. It is a list of what we refused to lose.', 'seed-perfume', 'seed-perfume-flowers', 'STILL LIFE / INVENTORY', 'PLATE 16 / KEPT', 0.4),
  page('editorial', 'quiet', 'THE LAST FRAME', 'The one we almost threw away.', 'It was soft, badly exposed and completely alive. The last frame on the roll is usually the one that tells the truth.', 'seed-cover-closeup', undefined, 'CONTACT SHEET / 36', 'PLATE 17 / LAST FRAME', 0.46),
  page('editorial', 'split', 'AN ARCHIVE OF ALMOST', 'Every image is evidence of a decision.', 'Keep the imperfect frame. Keep the one where the eyes are closed. Keep the photograph that makes no argument except that the moment happened.', 'seed-portrait-wall', 'seed-zine-desk', 'CAMPAIGN 04 / ARCHIVE', 'PLATE 18 / ALMOST', 0.34),
  page('editorial', 'quiet', 'COLOPHON', 'Printed from a bedroom. Stapled twice.', 'Set in the studio type pairing. Edited in the browser, rendered on a canvas, printed nowhere yet. CAMPAIGN 04 / Issue 01 / 2026.', undefined, undefined, 'CAMPAIGN 04 / VOL. 001', 'PLATE 19 / END MATTER', 0.5),
  page('back', 'standard', 'END OF ISSUE', 'Keep the imperfect frame.', 'CAMPAIGN 04 is an independent image-making studio. Vol. 001 was printed from a bedroom, a borrowed scanner and a queue of developing plates.', undefined, undefined, 'MAKE SOMETHING WORTH REMEMBERING.', 'CAMPAIGN 04 / VOL. 001 / 2026', 0.5),
]

export const MAGAZINE_PRESETS: MagazinePreset[] = [
  {
    id: 'after-rain-20',
    name: 'AFTER THE RAIN / 20 PAGES',
    kicker: 'THE DEBUT ISSUE',
    description: 'A complete 20-page magazine: cover, 18 editorial and collage pages, and a back cover. Built from the archive with four page forms, a shared palette and a full publishing kit.',
    targetPages: 20,
    issue: {
      title: 'AFTER THE RAIN',
      number: 'ISSUE 01',
      season: 'VOL. 001 / 2026',
      publisher: 'Campaign 04',
      description: 'A study in proximity, light and the things we keep. Made at home, between one life and the next.',
      targetPages: 20,
    },
    palette: paletteA,
    pages: AFTER_RAIN_PAGES,
  },
]

export function buildMagazinePages(preset: MagazinePreset, assets: Asset[]): ZinePage[] {
  const available = new Set(assets.map((a) => a.id))
  const stamp = Date.now().toString(36)
  return preset.pages.map((blueprint, index) => {
    const imageId = blueprint.imageId && available.has(blueprint.imageId) ? blueprint.imageId : undefined
    const secondaryImageId = blueprint.secondaryImageId && available.has(blueprint.secondaryImageId) ? blueprint.secondaryImageId : undefined
    return {
      id: `zpage-${preset.id}-${stamp}-${index + 1}`,
      template: blueprint.template,
      layout: blueprint.template === 'cover' || blueprint.template === 'back' ? 'standard' : blueprint.layout,
      headline: blueprint.headline,
      subhead: blueprint.subhead,
      body: blueprint.body,
      imageId,
      secondaryImageId,
      palette: index % 5 === 4 ? paletteB : index % 7 === 6 ? paletteC : preset.palette,
      caption: blueprint.caption,
      note: blueprint.note,
      focusX: blueprint.focusX,
      focusY: blueprint.focusY,
    }
  })
}
