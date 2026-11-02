import type { Brief, Controls, CustomStyle, StylePreset, TypographySpec } from './types'
import { COPY_BANK, DEFAULT_CONTROLS, STYLE_MAP, STYLE_PRESETS, DELIVERABLE_SETS, BRAND_ARCHETYPES } from './presets'

export function hashString(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = <T,>(rng: () => number, list: T[]): T => list[Math.floor(rng() * list.length)]
const many = <T,>(rng: () => number, list: T[], count: number): T[] => {
  const copy = [...list]
  const out: T[] = []
  while (copy.length && out.length < count) out.push(copy.splice(Math.floor(rng() * copy.length), 1)[0])
  return out
}
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

export function clampControls(c: Partial<Controls>): Controls {
  return {
    nostalgia: clamp(c.nostalgia ?? DEFAULT_CONTROLS.nostalgia),
    editorial: clamp(c.editorial ?? DEFAULT_CONTROLS.editorial),
    imperfection: clamp(c.imperfection ?? DEFAULT_CONTROLS.imperfection),
    intimacy: clamp(c.intimacy ?? DEFAULT_CONTROLS.intimacy),
    flash: clamp(c.flash ?? DEFAULT_CONTROLS.flash),
    film: clamp(c.film ?? DEFAULT_CONTROLS.film),
    composition: clamp(c.composition ?? DEFAULT_CONTROLS.composition),
    typography: clamp(c.typography ?? DEFAULT_CONTROLS.typography),
    color: clamp(c.color ?? DEFAULT_CONTROLS.color),
    surrealism: clamp(c.surrealism ?? DEFAULT_CONTROLS.surrealism),
    minimalism: clamp(c.minimalism ?? DEFAULT_CONTROLS.minimalism),
    commercial: clamp(c.commercial ?? DEFAULT_CONTROLS.commercial),
  }
}

export function controlsFromStyle(style: StylePreset): Controls {
  return clampControls({ ...DEFAULT_CONTROLS, ...style.controls })
}

const TITLE_WORDS = [
  'AFTER THE RAIN', 'FOREVER', 'SLEEPLESS', 'GIRLS OF NOWHERE', 'SOFT STATIC', 'THE LAST GOOD NIGHT',
  'CLOSE TO HOME', 'OLDER THAN SUMMER', 'NOTHING GOLD', 'SOMEWHERE STILL', 'PALE FIRE', 'THE QUIET HOURS',
  'LOVE, LATER', 'HALF-LIGHT', 'ALMOST A MEMORY', 'SMALL DEATHS', 'THE LONG WAY HOME', 'ROOM 204',
  'SOMETHING BORROWED', 'BLUE HOUR', 'STATIC BLOOM', 'NO ONE IS COMING', 'THE FEELING STAYS',
]

const CONCEPT_OPENERS = [
  'A campaign about the distance between a memory and the photograph that preserved it.',
  'An image study of intimacy at the exact moment it becomes nostalgia.',
  'A collection of photographs that look like they were found, not commissioned.',
  'A campaign built from the residue of a night nobody documented properly.',
  'A visual argument for keeping the imperfect frame.',
  'An editorial world that treats tenderness as a formal decision.',
]

const CONCEPT_CLOSERS = [
  'Beautiful, imperfect and quietly unresolved.',
  'The images should feel intimate enough to be intrusive.',
  'Nothing should look art-directed, though everything is.',
  'The result is less an advertisement than a page torn from a private archive.',
  'It should feel like the last photograph on a roll of film.',
  'The work should be remembered before it is understood.',
]

const SUBJECT_MAP: { test: RegExp; subject: string; product: string; locations: string[]; details: string[] }[] = [
  {
    test: /perfume|fragrance|parfum|scent|bottle/i,
    subject: 'fragrance',
    product: 'a glass perfume bottle',
    locations: ['a half-empty apartment at 7am', 'a hotel room with the curtains still closed', 'a bathroom mirror fogged with steam', 'a car parked outside a house you used to live in'],
    details: ['the bottle on rumpled bedsheets', 'a wrist held close to the lens', 'condensation on glass', 'a dried flower beside the cap'],
  },
  {
    test: /cloth|fashion|label|collection|apparel|lookbook|wear|dress|shirt|garment/i,
    subject: 'fashion',
    product: 'the garment',
    locations: ['a bare apartment with one chair', 'a school corridor after hours', 'a laundromat at dusk', 'a friend’s bedroom with the blinds half-open'],
    details: ['a hem against bare skin', 'cotton stretched across a shoulder', 'a price tag left on', 'feet on a cold tile floor'],
  },
  {
    test: /music|band|album|song|concert|magazine|zine|flyer/i,
    subject: 'music press',
    product: 'the record',
    locations: ['a basement venue with no stage', 'a photocopy shop at midnight', 'the back of a tour van', 'a kitchen after the show'],
    details: ['sweat on a microphone', 'a setlist taped to a wall', 'scuffed boots', 'a hand holding a cheap camera'],
  },
  {
    test: /hotel|room|house|interior|archive|memory|remember/i,
    subject: 'memory',
    product: 'the room',
    locations: ['a hotel corridor with one light on', 'a living room preserved since 1998', 'a staircase with worn carpet', 'a window facing a wall'],
    details: ['a curtain lifting in the draft', 'a glass ring on a wooden table', 'dust in a shaft of light', 'an empty chair turned toward the window'],
  },
  {
    test: /tokyo|street|city|urban|cast/i,
    subject: 'street casting',
    product: 'the outfit',
    locations: ['a busy crossing at 6pm', 'a narrow street behind a station', 'a convenience store doorway', 'a concrete stairwell'],
    details: ['a full-length silhouette against signage', 'a handmade accessory', 'wet pavement', 'a stranger looking directly back'],
  },
]

function subjectFor(idea: string) {
  return SUBJECT_MAP.find((s) => s.test.test(idea)) ?? {
    subject: 'image-making',
    product: 'the subject',
    locations: ['an ordinary room with extraordinary light', 'a street corner at the wrong hour', 'a studio with the equipment left in frame', 'a place that feels borrowed'],
    details: ['hands', 'a reflection', 'an object out of place', 'the space just before or after something happens'],
  }
}

function extractTitle(idea: string, rng: () => number): string {
  const quoted = idea.match(/called\s+["“']?([A-Z][A-Za-z0-9 '&.-]{2,40})["”']?/i)
  if (quoted) return quoted[1].replace(/[.,]$/, '').toUpperCase()
  const named = idea.match(/(?:label|brand|magazine|zine)\s+(?:called\s+)?["“']?([A-Z][A-Z0-9 '&.-]{2,30})["”']?/)
  if (named) return named[1].replace(/[.,]$/, '').toUpperCase()
  return pick(rng, TITLE_WORDS)
}

function paletteFor(style: StylePreset, controls: Controls, rng: () => number): string[] {
  const p = [...style.palette]
  if (controls.color > 70) {
    p[0] = pick(rng, ['#e7d7c3', '#f1e6d2', '#dfc9ad'])
    p[2] = pick(rng, ['#c4473b', '#2f5a9a', '#b58b2f'])
  }
  if (controls.color < 25) {
    p[1] = pick(rng, ['#b9b3a7', '#a7a49c', '#cbc5b8'])
    p[2] = pick(rng, ['#6e6a62', '#7c7870', '#5f5c56'])
  }
  if (controls.nostalgia > 80) {
    p[3] = pick(rng, ['#73584a', '#5d4b3e', '#7a5f4d'])
  }
  if (controls.surrealism > 65) {
    p[4] = pick(rng, ['#b23b54', '#3e6e61', '#8b5da8'])
  }
  return p.slice(0, 5)
}

function photographyFor(style: StylePreset, controls: Controls, subject: ReturnType<typeof subjectFor>): string[] {
  const out: string[] = []
  if (controls.flash > 62) out.push('Direct on-camera flash, unmodified, with hard falloff behind the subject.')
  if (controls.flash <= 62) out.push('Available light only. Let the room stay as dark as it actually is.')
  if (controls.film > 62) out.push('Visible 35mm grain, gentle halation and slightly unpredictable colour.')
  if (controls.film <= 30) out.push('Clean digital capture. Resist adding texture in post.')
  if (controls.imperfection > 66) out.push('One imperfect frame in every sequence: motion blur, a thumb in the corner, focus that arrives late.')
  if (controls.intimacy > 68) out.push('Close, unposed framing. The camera should feel tolerated rather than invited.')
  if (controls.intimacy <= 35) out.push('Keep a respectful distance. The subject does not perform for the lens.')
  if (controls.editorial > 66) out.push('Sequence the images like an editorial: a wide, a detail, a face, a mistake.')
  if (controls.minimalism > 66) out.push('Reduce each frame to one subject, one wall, one source of light.')
  out.push(...style.photography.slice(0, 4))
  out.push(`Pay attention to ${pick(mulberry32(subject.subject.length * 41), subject.details)}.`)
  return Array.from(new Set(out)).slice(0, 7)
}

function castingFor(subject: ReturnType<typeof subjectFor>, controls: Controls, rng: () => number): string[] {
  const base = [
    'Cast for presence, not conventional polish. A face that holds still without trying.',
    'One recurring subject across the campaign so the images accumulate into a person.',
    'Hands and details should carry as much character as the face.',
  ]
  if (subject.subject === 'fashion') base.push('Non-model street casting; clothes worn the way they are actually worn.')
  if (subject.subject === 'fragrance') base.push('A single figure, photographed as if remembered rather than directed.')
  if (subject.subject === 'music press') base.push('Musicians photographed before or after the set, never during a pose.')
  if (controls.intimacy > 75) base.push('Two people in the same frame, close enough that the image feels like an interruption.')
  if (controls.commercial > 70) base.push('A recognizable face and clear product interaction, but no smile-for-the-camera energy.')
  return many(rng, base, 4)
}

export interface GeneratedBriefInput {
  idea: string
  styleId?: string
  controls?: Partial<Controls>
  revision?: number
  seed?: number
}

export function generateBrief({ idea, styleId, controls: controlOverrides, revision = 0, seed }: GeneratedBriefInput): Brief {
  const cleanIdea = idea.trim() || 'A campaign about the last good night of the summer.'
  const rng = mulberry32(seed ?? hashString(cleanIdea) + revision * 7919)
  const style = STYLE_MAP[styleId ?? 'tumblr-forever'] ?? STYLE_PRESETS[2]
  const controls = clampControls({ ...controlsFromStyle(style), ...controlOverrides })
  const subject = subjectFor(cleanIdea)
  const title = extractTitle(cleanIdea, rng)
  const palette = paletteFor(style, controls, rng)
  const photography = photographyFor(style, controls, subject)
  const casting = castingFor(subject, controls, rng)
  const location = many(rng, subject.locations, 3).map((l, i) => `${i + 1}. ${l[0].toUpperCase()}${l.slice(1)}.`)
  const lighting = style.lighting.map((l) => l[0].toUpperCase() + l.slice(1) + '.')
  if (controls.flash > 68) lighting.unshift('A single unmodified flash, held at the camera, doing most of the work.')
  if (controls.surrealism > 68) lighting.push('One light source that makes no spatial sense. Do not explain it.')
  const concept = `${pick(rng, CONCEPT_OPENERS)} ${cleanIdea.replace(/\.$/, '')}. The direction is ${style.name} — ${style.blurb.toLowerCase()} ${pick(rng, CONCEPT_CLOSERS)}`
  const composition = [
    ...style.composition,
    controls.composition > 70 ? 'Allow one frame to become genuinely chaotic. Do not correct it.' : 'Keep the framing disciplined but never symmetrical.',
    controls.minimalism > 70 ? 'Negative space is a material. Use it in at least half the frames.' : 'Let the frame carry evidence: a wall, a chair, a person just out of shot.',
  ].slice(0, 5)
  const typography: TypographySpec = {
    ...style.typography,
    note:
      controls.typography > 70
        ? `${style.typography.note} Push the headline scale until it becomes part of the image.`
        : controls.typography < 30
          ? `${style.typography.note} Keep type small, factual and almost invisible.`
          : style.typography.note,
  }
  const headlines = many(rng, COPY_BANK.headlines, 3)
  const copy = [
    `“${headlines[0]}”`,
    pick(rng, COPY_BANK.lines),
    `${subject.product[0].toUpperCase()}${subject.product.slice(1)}. Photographed as if it were already yours.`,
  ]
  const deliverables = DELIVERABLE_SETS[subject.subject === 'fragrance' ? 'fragrance' : subject.subject === 'fashion' ? 'campaign' : subject.subject === 'music press' ? 'music' : 'lookbook']
  const prompt = buildPrompt({
    style,
    controls,
    subject: `${subject.subject}, ${subject.product}`,
    extra: cleanIdea,
    title,
    seed: Math.floor(rng() * 999999),
  })
  return {
    id: `brief-${Date.now().toString(36)}-${revision}`,
    title,
    subtitle: `${style.name.toUpperCase()} / ${style.era}`,
    idea: cleanIdea,
    concept,
    photography,
    casting,
    location,
    lighting: Array.from(new Set(lighting)).slice(0, 6),
    palette,
    typography,
    composition,
    copy,
    headlines,
    deliverables,
    prompt,
    negative: style.negative,
    styleId: style.id,
    controls,
    createdAt: Date.now(),
    revision,
  }
}

export function buildPrompt({
  style,
  controls,
  subject,
  extra,
  title,
  seed,
}: {
  style: StylePreset
  controls: Controls
  subject: string
  extra: string
  title: string
  seed?: number
}): string {
  const bits: string[] = [style.promptCore]
  bits.push(`Subject: ${subject}.`)
  if (extra) bits.push(extra.slice(0, 260))
  if (controls.flash > 70) bits.push('harsh direct on-camera flash, blown foreground, dark falloff')
  if (controls.flash < 25) bits.push('soft available light, no flash')
  if (controls.nostalgia > 78) bits.push('dated, mid-2000s, faded, found-photograph quality')
  if (controls.imperfection > 75) bits.push('slightly blurry, imperfect focus, accidental framing, unretouched')
  if (controls.intimacy > 78) bits.push('extremely close and intimate, unposed, vulnerable')
  if (controls.minimalism > 70) bits.push('minimal composition, large negative space, one clear subject')
  if (controls.surrealism > 65) bits.push('one subtle impossible detail, quiet surrealism, never fantastical')
  if (controls.color < 28) bits.push('muted desaturated palette, soft contrast')
  if (controls.color > 72) bits.push('saturated but imperfect colour, colour-cast shadows')
  if (controls.editorial > 70) bits.push('editorial fashion photography, magazine sequence')
  if (controls.typography > 70) bits.push('graphic composition with space for an oversized headline')
  const year = Math.round(1998 + (controls.nostalgia / 100) * 12)
  bits.push(`visual reference era: ${year}`, 'original work, no text, no logo, no watermark')
  return bits.join(', ')
}

export function reviseControls(controls: Controls, styleId: string, message: string): {
  controls: Controls
  styleId: string
  notes: string[]
} {
  const m = message.toLowerCase()
  const next = { ...controls }
  let nextStyle = styleId
  const notes: string[] = []
  const bump = (key: keyof Controls, amount: number, label: string) => {
    next[key] = clamp(next[key] + amount)
    notes.push(label)
  }
  const styleHints: { test: RegExp; id: string; label: string }[] = [
    { test: /tumblr|diary|personal|bedroom|internet/, id: 'tumblr-forever', label: 'Visual direction shifted toward Tumblr Forever.' },
    { test: /american apparel|american archive|catalog|catalogue|2006|2005/, id: 'american-archive', label: 'Visual direction shifted toward American Archive.' },
    { test: /i-d|id magazine|experimental|avant|weird/, id: 'id-experimental', label: 'Editorial language shifted toward i-D-style experimentation.' },
    { test: /night|club|party|sleaze|disposable/, id: 'indie-after-hours', label: 'Energy shifted toward Indie After Hours.' },
    { test: /romantic|romance|perfume|fragrance|faded/, id: 'romantic-archive', label: 'Romance and faded colour increased via Romantic Archive.' },
    { test: /zine|xerox|photocopy|diy/, id: 'zine-culture', label: 'Graphic language shifted toward Zine Culture.' },
    { test: /french|paris|hotel/, id: 'french-editorial', label: 'Direction shifted toward French Editorial.' },
    { test: /tokyo|street|casting/, id: 'tokyo-street', label: 'Casting and composition shifted toward Tokyo Street Archive.' },
    { test: /dark|underground|severe|goth/, id: 'underground-romance', label: 'Palette and mood moved underground.' },
    { test: /minimal|clean|quiet|luxury/, id: 'minimalist-catalog', label: 'Reduced the image to a Minimalist Catalog language.' },
  ]
  for (const h of styleHints) {
    if (h.test.test(m)) {
      nextStyle = h.id
      notes.push(h.label)
      break
    }
  }
  if (/less polish|unpolished|raw|imperfect|mess|mistake|grain/.test(m)) bump('imperfection', 16, 'Imperfection increased; allow more error in the frame.')
  if (/more polish|clean|refined|premium|luxury/.test(m)) {
    bump('imperfection', -14, 'Imperfection reduced; the image is more controlled.')
    bump('commercial', 12, 'Commercial clarity increased.')
  }
  if (/flash|harsh|direct light|blown/.test(m)) bump('flash', 18, 'Flash intensity increased.')
  if (/soft light|natural light|window|gentle/.test(m)) bump('flash', -18, 'Flash reduced in favour of available light.')
  if (/close|intimate|personal|tender|vulnerable/.test(m)) bump('intimacy', 14, 'Intimacy increased; move closer to the subject.')
  if (/distant|cold|remote|detached/.test(m)) bump('intimacy', -14, 'Distance increased; the subject is no longer performing.')
  if (/vintage|old|nostalg|retro|2006|2005|2004/.test(m)) bump('nostalgia', 14, 'Nostalgia increased; the image belongs to an earlier moment.')
  if (/modern|present|now|contemporary/.test(m)) bump('nostalgia', -16, 'Nostalgia reduced; the image moves into the present.')
  if (/dark|moody|shadow|black/.test(m)) {
    bump('color', -14, 'Colour reduced; shadows are allowed to go black.')
    bump('surrealism', 8, 'A slight unreal quality enters the frame.')
  }
  if (/bright|light|airy|daylight/.test(m)) bump('color', 8, 'More light and air in the palette.')
  if (/surreal|strange|dream|unreal/.test(m)) bump('surrealism', 16, 'Surrealism increased; one impossible detail is permitted.')
  if (/minimal|negative space|simple|reduce|quiet/.test(m)) {
    bump('minimalism', 16, 'Composition reduced; negative space increased.')
    bump('composition', -10, 'Visual noise reduced.')
  }
  if (/chaotic|busy|layered|collage/.test(m)) {
    bump('composition', 16, 'Composition loosened; allow visual noise.')
    bump('minimalism', -12, 'Minimalism reduced.')
  }
  if (/typograph|type|headline|poster/.test(m)) bump('typography', 16, 'Typography becomes more expressive and structural.')
  if (notes.length === 0) {
    notes.push('Direction held. I tightened the existing brief around your note and kept the visual DNA intact.')
  }
  return { controls: next, styleId: nextStyle, notes }
}

export function blendStyles(ingredients: { styleId: string; weight: number }[]): CustomStyle {
  const valid = ingredients.filter((i) => STYLE_MAP[i.styleId] && i.weight > 0)
  const total = valid.reduce((s, i) => s + i.weight, 0) || 1
  const controls = clampControls(
    Object.fromEntries(
      (Object.keys(DEFAULT_CONTROLS) as (keyof Controls)[]).map((key) => [
        key,
        valid.reduce((sum, i) => sum + (STYLE_MAP[i.styleId].controls[key] ?? DEFAULT_CONTROLS[key]) * (i.weight / total), 0),
      ]),
    ) as Controls,
  )
  const palette: string[] = []
  valid.forEach((i) => {
    const p = STYLE_MAP[i.styleId].palette
    const count = Math.max(1, Math.round((i.weight / total) * 4))
    for (let k = 0; k < count; k++) palette.push(p[k % p.length])
  })
  const lead = [...valid].sort((a, b) => b.weight - a.weight)[0]
  const leadStyle = lead ? STYLE_MAP[lead.styleId] : STYLE_PRESETS[0]
  const prefix = ['AMERICAN', 'TUMBLR', 'AFTER', 'SOFT', 'PALE', 'THE', 'NEW', 'LATE', 'HALF', 'QUIET']
  const suffix = ['AFTERGLOW', 'ROMANCE', 'STATIC', 'ARCHIVE', 'HOURS', 'LIGHT', 'MEMORY', 'STUDY', 'BLOOM', 'EDIT']
  const seed = hashString(valid.map((v) => v.styleId + v.weight).join('|'))
  const name = `${pick(mulberry32(seed), prefix)} ${pick(mulberry32(seed + 2), suffix)}`
  const promptCore = valid
    .map((i) => `${Math.round((i.weight / total) * 100)}% ${STYLE_MAP[i.styleId].name}: ${STYLE_MAP[i.styleId].promptCore}`)
    .join('; ')
  return {
    id: `mix-${seed.toString(36)}`,
    name,
    blurb: `${valid.map((i) => `${Math.round((i.weight / total) * 100)}% ${STYLE_MAP[i.styleId].name}`).join(' · ')}`,
    ingredients: valid,
    palette: Array.from(new Set(palette)).slice(0, 5),
    promptCore,
    controls,
    typography: leadStyle.typography,
    createdAt: Date.now(),
  }
}

export function styleToPreset(custom: CustomStyle): StylePreset {
  const lead = STYLE_MAP[custom.ingredients[0]?.styleId] ?? STYLE_PRESETS[0]
  return {
    ...lead,
    id: custom.id,
    name: custom.name,
    family: 'Custom mix',
    era: 'Now',
    blurb: custom.blurb,
    description: `A custom direction mixed from ${custom.blurb}. It carries the combined photographic logic of every ingredient rather than a simple filter.`,
    palette: custom.palette,
    typography: custom.typography,
    promptCore: custom.promptCore,
    controls: custom.controls,
    cover: lead.cover,
  }
}

export function generateCampaignCopy(title: string, idea: string): { copy: string; headlines: string[] } {
  const rng = mulberry32(hashString(title + idea))
  const headlines = many(rng, COPY_BANK.headlines, 3)
  return {
    headlines,
    copy: `“${headlines[0]}” — ${pick(rng, COPY_BANK.lines)} ${title} is an image-making study in ${pick(rng, ['proximity', 'memory', 'the almost-visible', 'softness and damage', 'the last good hour', 'ordinary devotion'])}.`,
  }
}

export function generateBlogIdentity(mood: string, era: string): { title: string; url: string; bio: string; theme: string; palette: string[] } {
  const seed = hashString(mood + era)
  const rng = mulberry32(seed)
  const first = ['the quiet', 'sleepless', 'soft', 'small', 'after', 'pale', 'inventory of', 'notes from', 'the last', 'archive of']
  const second = ['hours', 'static', 'girls', 'rooms', 'light', 'summer', 'nothing', 'feeling', 'the bedroom', 'a Sunday']
  const titles = ['the quiet hours', 'sleepless in the archive', 'soft static', 'notes from a bedroom', 'nothing gold', 'girls on film', 'a small inventory', 'after the internet', 'rooms I have loved', 'pale blue hour']
  const title = pick(rng, titles)
  const url = `${title.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}.tumblr.com`
  const bios = [
    `a personal archive of ${mood}. photographs, lyrics, rooms, ${era}. i am still here.`,
    `${era} / ${mood} / no theme. please do not repost without credit.`,
    `saving images that feel like ${mood}. queue is on. ask me anything.`,
    `i keep the photographs that nobody else wanted. ${mood}, mostly.`,
  ]
  const palettes = [
    ['#d8c6c4', '#7b7275', '#1b191a', '#a99bb2', '#e8e0d3'],
    ['#cbb49d', '#8c6f5a', '#322a24', '#a85c5b', '#e9ddc9'],
    ['#b8c4c4', '#6c7a78', '#171b1b', '#cf9e9a', '#eee9dd'],
    ['#c9a6a6', '#5f5b61', '#141314', '#8f7fa3', '#e7dfd0'],
  ]
  return { title, url, bio: pick(rng, bios), theme: era, palette: pick(rng, palettes) }
}

export function generateBrand(name: string, archetypeId: string) {
  const archetype = BRAND_ARCHETYPES.find((a) => a.id === archetypeId) ?? BRAND_ARCHETYPES[0]
  const rng = mulberry32(hashString(name + archetypeId))
  const taglines = [
    'Made to be kept.',
    'An archive you can wear.',
    'For the hours that belong to no one.',
    'Nothing here was meant to last.',
    'Softly, deliberately.',
    'A study in ordinary devotion.',
    'Worn like a memory.',
    'After everything, still here.',
  ]
  const stories = [
    `${name} began as a personal archive: photographs taped inside a wardrobe door, garments kept past their season. The label treats each collection as a chapter rather than a drop — an attempt to make objects that carry the feeling of a specific afternoon.`,
    `${name} is an independent studio working between image and object. Its language is built from ${archetype.note.toLowerCase()} The work is intentionally small, slowly made, and designed to look better after a year of wear.`,
    `${name} makes clothing and images for people who keep things. The visual world borrows from ${archetype.note.toLowerCase()} but refuses nostalgia as decoration: every reference is rebuilt into something present.`,
  ]
  const voices = [
    'Quiet, direct, never explanatory. One line is enough.',
    'Tender without being sentimental. Short sentences, no exclamation marks.',
    'Deadpan and precise. The product is described, the feeling is implied.',
  ]
  const packages = [
    'Uncoated board, one-colour print, a small photograph pasted by hand. The object should look like it was made in an edition of 200.',
    'Recycled newsprint wrapper, stamped logo, no plastic. The packaging is evidence of the studio, not a marketing layer.',
    'Bone-white box, blind deboss, a single insert photograph. Restraint at every point of contact.',
  ]
  return {
    tagline: pick(rng, taglines),
    story: pick(rng, stories),
    voice: pick(rng, voices),
    packaging: pick(rng, packages),
    palette: archetype.palette,
    wordmark: name.toUpperCase(),
    displayFont: pick(rng, ['Cormorant Garamond', 'Bodoni Moda', 'Anton', 'Archivo', 'Space Grotesk']),
    bodyFont: pick(rng, ['Archivo', 'IBM Plex Mono', 'Space Grotesk']),
  }
}

export function promptForCampaign(brief: Brief, assetPrompt: string): string {
  return `${brief.prompt}, ${assetPrompt}`
}

export function seedPhrase(seed: number): string {
  const words = ['ivory', 'flash', 'grain', 'rain', 'static', 'rose', 'smoke', 'cotton', 'mirror', 'lamp', 'corridor', 'dust', 'blue', 'skin', 'paper']
  const rng = mulberry32(seed)
  return `${pick(rng, words)}-${pick(rng, words)}-${Math.floor(rng() * 99).toString().padStart(2, '0')}`
}
