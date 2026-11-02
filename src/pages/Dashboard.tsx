import { ArrowUpRight, ArrowRight, Sparkles, Plus, Images, Aperture, BookOpen, Fingerprint } from 'lucide-react'
import { useApp } from '../lib/store'
import { ImagePlate, SectionHead, Swatches, MiniStat, LinkArrow } from '../components/UI'
import { NAV_ITEMS, STYLE_MAP } from '../lib/presets'
import type { DepartmentId } from '../lib/types'

export function Dashboard() {
  const navigate = useApp((s) => s.navigate)
  const projects = useApp((s) => s.projects)
  const campaigns = useApp((s) => s.campaigns)
  const assets = useApp((s) => s.assets)
  const brands = useApp((s) => s.brands)
  const customStyles = useApp((s) => s.customStyles)
  const usage = useApp((s) => s.usage)
  const jobs = useApp((s) => s.jobs)
  const references = useApp((s) => s.references)
  const featured = campaigns.find((c) => c.id === 'cmp-after-rain') ?? campaigns[0]
  const featuredAsset = assets.find((a) => a.id === featured?.assets[0]?.assetId)
  const style = customStyles[0]
  const archive = assets.filter((a) => a.source === 'seed').slice(0, 7)
  const activeJobs = jobs.filter((j) => ['queued', 'submitting', 'waiting', 'downloading'].includes(j.status))

  const openProject = (campaignId?: string) => {
    if (campaignId) useApp.getState().setEditorDraft({ campaignId })
    navigate('campaigns')
  }

  const quick = [
    { id: 'director', index: '01', label: 'Direct a campaign', sub: 'Start with an idea, leave with a world.', icon: <Sparkles size={15} /> },
    { id: 'studio', index: '02', label: 'Make an image', sub: 'Prompt, references, style, development.', icon: <Aperture size={15} /> },
    { id: 'darkroom', index: '03', label: 'Develop a plate', sub: 'Film treatments, grain, type, layers.', icon: <Images size={15} /> },
    { id: 'brandlab', index: '04', label: 'Invent a label', sub: 'Identity, voice, packaging, campaign.', icon: <Fingerprint size={15} /> },
    { id: 'zine', index: '05', label: 'Publish a zine', sub: 'Pages, covers, cutouts, print.', icon: <BookOpen size={15} /> },
    { id: 'archive', index: '06', label: 'Open the archive', sub: 'References, visual DNA, collections.', icon: <Plus size={15} /> },
  ]

  return (
    <div className="page dash">
      <div className="dash-topline">
        <span className="mono">CAMPAIGN 04 · INDEPENDENT IMAGE-MAKING STUDIO</span>
        <span className="mono">VOL. 001 / ISSUE 04 / 2026</span>
        <span className="mono">PRIVATE ARCHIVE · {assets.length} PLATES</span>
      </div>

      <section className="dash-hero">
        <div className="dash-hero-visual">
          <div className="dash-hero-img">
            <ImagePlate src={featuredAsset?.src} alt={featured?.title ?? 'Featured campaign'} ratio="4 / 3" eager caption="AFTER THE RAIN / CAMPAIGN 001" tag="FEATURED" />
          </div>
          <div className="dash-hero-label">
            <span className="mono-xs">THE FEATURED CAMPAIGN</span>
            <span className="mono-xs" style={{ color: 'var(--faint)' }}>FRAGRANCE / 2006</span>
          </div>
          <div className="dash-hero-index">04</div>
        </div>

        <div className="dash-hero-copy">
          <div className="eyebrow" style={{ marginBottom: 22 }}>THE STUDIO IS OPEN</div>
          <h1 className="dash-title">
            MAKE<br />
            SOMETHING<br />
            <span className="ital">WORTH</span><br />
            REMEMBERING.
          </h1>
          <p className="dash-intro">
            An independent creative studio for people who care about images, aesthetics, fashion, photography, music,
            typography and the way a feeling can survive in a photograph.
          </p>
          <div className="dash-actions">
            <button className="btn btn--solid btn--lg" onClick={() => navigate('studio')}>
              ENTER THE STUDIO <ArrowUpRight size={13} />
            </button>
            <button className="btn btn--ghost btn--lg" onClick={() => navigate('director')}>
              OPEN ART DIRECTOR
            </button>
          </div>
          <div className="dash-stats">
            <MiniStat value={campaigns.length} label="Campaigns" />
            <MiniStat value={assets.length} label="Plates" />
            <MiniStat value={brands.length} label="Brand kits" />
            <MiniStat value={references.length} label="References" />
          </div>
          <div className="note" style={{ marginTop: 18 }}>every image is a decision.</div>
        </div>
      </section>

      <div className="ticker">
        <div className="ticker-track">
          {Array.from({ length: 2 }).map((_, k) => (
            <span key={k}>
              MAKE SOMETHING WORTH REMEMBERING <i>·</i> PHOTOGRAPHY IS A WAY OF KEEPING <i>·</i> THE IMAGE IS THE ARGUMENT <i>·</i> 2006 WAS ONLY YESTERDAY <i>·</i> KEEP THE IMPERFECT FRAME <i>·</i> VOL. 001 <i>·</i>
            </span>
          ))}
        </div>
      </div>

      <section className="section">
        <SectionHead
          index="01"
          title="Recent work"
          link={<LinkArrow onClick={() => navigate('campaigns')}>ALL CAMPAIGNS</LinkArrow>}
        />
        <div className="dash-projects">
          {projects.slice(0, 4).map((p, i) => {
            const asset = assets.find((a) => a.id === p.coverAssetId)
            return (
              <button key={p.id} className={`dash-project dash-project--${i + 1}`} onClick={() => openProject(p.campaignId)}>
                <div className="dash-project-img">
                  <ImagePlate src={asset?.src} alt={p.title} ratio={i === 0 ? '4 / 3' : '3 / 4'} caption={p.kind.toUpperCase()} />
                </div>
                <div className="dash-project-meta">
                  <div>
                    <h3>{p.title}</h3>
                    <p>{p.kind}</p>
                  </div>
                  <ArrowUpRight size={14} />
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <section className="dash-lower">
        <div className="dash-quick">
          <SectionHead index="02" title="Start something" />
          <div className="quick-list">
            {quick.map((q) => (
              <button key={q.id} className="quick-row" onClick={() => navigate(q.id as DepartmentId)}>
                <span className="quick-idx">{q.index}</span>
                <span className="quick-icon">{q.icon}</span>
                <span className="quick-copy">
                  <strong>{q.label}</strong>
                  <small>{q.sub}</small>
                </span>
                <ArrowRight size={13} className="quick-arrow" />
              </button>
            ))}
          </div>
        </div>

        <aside className="dash-side">
          <div className="panel dash-dna">
            <div className="panel-head">
              <span className="panel-title"><span className="num">DNA</span> VISUAL IDENTITY</span>
              <span className="mono-xs" style={{ color: 'var(--faint)' }}>CUSTOM MIX</span>
            </div>
            <div className="panel-body">
              <div className="dna-name">{style?.name ?? 'AMERICAN AFTERGLOW'}</div>
              <p className="dna-blurb">{style?.blurb ?? 'A visual signature built from your references.'}</p>
              <Swatches palette={style?.palette ?? STYLE_MAP['american-archive'].palette} size={26} />
              <div className="dna-bars">
                {Object.entries(style?.controls ?? {})
                  .slice(0, 4)
                  .map(([k, v]) => (
                    <div key={k} className="dna-bar">
                      <span>{k}</span>
                      <div><i style={{ width: `${v}%` }} /></div>
                      <em>{v}</em>
                    </div>
                  ))}
              </div>
              <button className="btn btn--ghost btn--sm btn--wide" style={{ marginTop: 14 }} onClick={() => navigate('styles')}>
                OPEN STYLE LIBRARY
              </button>
            </div>
          </div>

          <div className="panel dash-status">
            <div className="panel-head">
              <span className="panel-title"><span className="num">LAB</span> NOW DEVELOPING</span>
              <span className="mono-xs" style={{ color: activeJobs.length ? 'var(--accent)' : 'var(--faint)' }}>{activeJobs.length ? 'ACTIVE' : 'IDLE'}</span>
            </div>
            <div className="panel-body" style={{ display: 'grid', gap: 12 }}>
              {activeJobs.length ? (
                activeJobs.slice(0, 3).map((j) => (
                  <div key={j.id}>
                    <div className="mono-xs" style={{ color: 'var(--muted)', marginBottom: 4 }}>{j.status === 'waiting' ? `QUEUE ${j.queuePosition ?? '—'}` : j.status.toUpperCase()}</div>
                    <div style={{ fontSize: 11, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{j.prompt}</div>
                    <div className="loading-line" style={{ marginTop: 6 }} />
                  </div>
                ))
              ) : (
                <div className="lab-idle">
                  <span className="lab-dot" />
                  <span>The darkroom is quiet. The archive is awake.</span>
                </div>
              )}
              <div className="usage-row">
                <span className="mono-xs">FRAMES THIS MONTH</span>
                <span className="mono-xs">{usage.credits} LEFT</span>
              </div>
              <div className="credit-bar"><span style={{ width: `${(1 - usage.credits / 120) * 100}%` }} /></div>
            </div>
          </div>
        </aside>
      </section>

      <section className="section">
        <SectionHead
          index="03"
          title={<span>From the archive <span className="serif" style={{ fontStyle: 'italic', textTransform: 'none', color: 'var(--muted)', fontSize: 19 }}>— what we keep</span></span>}
          link={<LinkArrow onClick={() => navigate('archive')}>ENTER THE ARCHIVE</LinkArrow>}
        />
        <div className="archive-strip">
          {archive.map((a, i) => (
            <div key={a.id} className="archive-strip-item">
              <ImagePlate src={a.src} alt={a.title} ratio="3 / 4" caption={`${String(i + 1).padStart(2, '0')} / ${a.collection?.toUpperCase()}`} onClick={() => navigate('archive')} />
              <div className="archive-strip-meta">
                <span>{a.title}</span>
                <span>{a.createdAt ? new Date(a.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase() : '—'}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="dash-closing">
        <div className="dash-closing-img">
          <ImagePlate src={assets.find((a) => a.id === 'seed-mirror')?.src} alt="A mirror portrait" ratio="16 / 9" caption="TUMBLR FOREVER / 2012" />
        </div>
        <div className="dash-closing-copy">
          <div className="eyebrow">A NOTE FROM THE STUDIO</div>
          <blockquote>
            “The internet used to feel like a room you could decorate with your entire self. We are trying to build that room again — a place to make images, invent labels, keep references, and admit that beauty is still a serious reason to do anything.”
          </blockquote>
          <div className="mono-xs" style={{ color: 'var(--muted)' }}>CAMPAIGN 04 / STUDIO NOTE 001</div>
          <button className="btn btn--ghost btn--sm" style={{ marginTop: 18 }} onClick={() => navigate('tumblr')}>
            VISIT THE TUMBLR MACHINE <ArrowRight size={11} />
          </button>
        </div>
      </section>

      <div className="footer-note-row">
        <span>ALL DEPARTMENTS</span>
        {NAV_ITEMS.slice(1, 9).map((n) => (
          <button key={n.id} onClick={() => navigate(n.id)}>{n.label}</button>
        ))}
      </div>
    </div>
  )
}
