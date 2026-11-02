import { useMemo, useState, type CSSProperties } from 'react'
import {
  Heart, Repeat2, MessageCircle, Plus, Trash2, Clock, Send, Sparkles,
  Image as ImageIcon, RefreshCw, ExternalLink, X, Check,
} from 'lucide-react'
import { PageHeader, Modal, ImagePlate, Swatches, Slider, CopyButton, SectionHead } from '../components/UI'
import { UploadPlate } from '../components/UploadPlate'
import { useApp, uid } from '../lib/store'
import { generateBlogIdentity } from '../lib/director'
import type { BlogPost } from '../lib/types'

const THEMES = ['2012', '2009', '2015', '2026']
const MOODS = ['bedrooms and bad flash', 'sleepless cities', 'soft girls and old film', 'the last good summer', 'internet ghost', 'rain on a window']

export function TumblrMachine() {
  const blog = useApp((s) => s.blog)
  const setBlog = useApp((s) => s.setBlog)
  const posts = useApp((s) => s.blogPosts)
  const addPost = useApp((s) => s.addBlogPost)
  const updatePost = useApp((s) => s.updateBlogPost)
  const removePost = useApp((s) => s.removeBlogPost)
  const assets = useApp((s) => s.assets)
  const toast = useApp((s) => s.toast)

  const [mood, setMood] = useState('bedrooms and bad flash')
  const [era, setEra] = useState('2009—2013')
  const [picker, setPicker] = useState<null | 'header' | 'avatar'>(null)
  const [postImage, setPostImage] = useState('seed-mirror')
  const [caption, setCaption] = useState('')
  const [tags, setTags] = useState('diary, 3am')
  const [postPickerOpen, setPostPickerOpen] = useState(false)

  const published = posts.filter((p) => p.status === 'published')
  const queued = posts.filter((p) => p.status === 'queued')
  const header = assets.find((a) => a.id === blog.headerAssetId)
  const avatar = assets.find((a) => a.id === blog.avatarAssetId)

  const generate = () => {
    const generated = generateBlogIdentity(mood, era)
    setBlog({ ...blog, ...generated, id: blog.id, createdAt: Date.now(), headerAssetId: blog.headerAssetId, avatarAssetId: blog.avatarAssetId })
    toast('Blog identity generated', `${generated.title} / ${generated.url}`, 'success')
  }

  const publish = () => {
    if (!caption.trim()) {
      toast('Write a caption', 'Even the shortest caption should say something true.', 'error')
      return
    }
    const post: BlogPost = {
      id: uid('post'),
      assetId: postImage,
      caption: caption.trim(),
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      createdAt: Date.now(),
      status: 'published',
      notes: 0,
    }
    addPost(post)
    setCaption('')
    toast('Posted', 'It is now on the blog. No analytics, no audience, no pressure.', 'success')
  }

  const queue = () => {
    if (!caption.trim()) return
    addPost({
      id: uid('post'),
      assetId: postImage,
      caption: caption.trim(),
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      createdAt: Date.now(),
      status: 'queued',
      notes: 0,
    })
    setCaption('')
    toast('Added to queue', 'It will wait until you decide the internet deserves it.', 'success')
  }

  const reblog = (post: BlogPost) => {
    addPost({
      id: uid('post'),
      assetId: post.assetId,
      caption: `reblogged from ${blog.title}: ${post.caption}`,
      tags: [...post.tags, 'reblog'],
      createdAt: Date.now(),
      status: 'published',
      notes: post.notes + 1,
      rebloggedFrom: post.id,
    })
    toast('Reblogged', 'The image stays. The context moves.', 'success')
  }

  const assetCount = assets.filter((a) => a.kind !== 'layout').length

  return (
    <div className="page tumblr-page">
      <PageHeader
        index="09"
        kicker="INTERNET MEMORY / TUMBLR MACHINE"
        title={<>THE TUMBLR <span className="ital">MACHINE</span></>}
        description="Build a personal image diary with a real identity: title, URL, bio, palette, header, queue and posts. The preview is the actual blog, not a mock-up of one."
        actions={
          <>
            <button className="btn btn--ghost" onClick={() => setPicker('header')}><ImageIcon size={12} /> HEADER</button>
            <button className="btn btn--solid" onClick={generate}><RefreshCw size={12} /> GENERATE IDENTITY</button>
          </>
        }
        meta={<div className="page-meta"><span>{blog.url}</span><span>{published.length} published</span><span>{queued.length} queued</span><span>{assetCount} plates available</span></div>}
      />

      <div className="tumblr-layout">
        <aside className="tumblr-controls">
          <div className="tumblr-block">
            <div className="block-label"><span>01 / BLOG IDENTITY</span><span className="mono-xs muted">{blog.theme} THEME</span></div>
            <div className="field"><label>TITLE</label><input className="input" value={blog.title} onChange={(e) => setBlog({ ...blog, title: e.target.value })} /></div>
            <div className="field"><label>URL</label><input className="input" value={blog.url} onChange={(e) => setBlog({ ...blog, url: e.target.value })} /></div>
            <div className="field"><label>BIO</label><textarea className="textarea" rows={4} value={blog.bio} onChange={(e) => setBlog({ ...blog, bio: e.target.value })} /></div>
          </div>

          <div className="tumblr-block">
            <div className="block-label">02 / MOOD + ERA</div>
            <div className="field"><label>MOOD</label>
              <select className="select" value={mood} onChange={(e) => setMood(e.target.value)}>
                {MOODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="field"><label>ERA</label>
              <select className="select" value={era} onChange={(e) => setEra(e.target.value)}>
                {['2004—2008', '2007—2011', '2009—2013', '2012—2016', 'now'].map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <button className="btn btn--ghost btn--sm btn--wide" onClick={generate}><Sparkles size={11} /> GENERATE FROM MOOD</button>
          </div>

          <div className="tumblr-block">
            <div className="block-label">03 / THEME</div>
            <div className="theme-grid">
              {THEMES.map((t) => (
                <button key={t} className={blog.theme === t ? 'active' : ''} onClick={() => setBlog({ ...blog, theme: t })}>
                  <span>{t}</span>
                  <small>{t === '2009' ? 'dense / handwritten' : t === '2012' ? 'centered / serif' : t === '2015' ? 'grid / clean' : 'quiet / modern'}</small>
                </button>
              ))}
            </div>
            <div className="field" style={{ marginTop: 12 }}><label>PALETTE</label>
              <Swatches palette={blog.palette} size={24} labels />
            </div>
            <button className="mini-link" onClick={() => setBlog({ ...blog, palette: generateBlogIdentity(mood, era).palette })}>REGENERATE PALETTE</button>
          </div>

          <div className="tumblr-block">
            <div className="block-label">04 / IMAGES</div>
            <div className="tumblr-image-row">
              <button className="tumblr-image-pick" onClick={() => setPicker('header')}>
                {header ? <img src={header.src} alt="" /> : <ImageIcon size={16} />}
                <span>HEADER</span>
              </button>
              <button className="tumblr-image-pick" onClick={() => setPicker('avatar')}>
                {avatar ? <img src={avatar.src} alt="" /> : <ImageIcon size={16} />}
                <span>AVATAR</span>
              </button>
            </div>
          </div>

          <div className="tumblr-block tumblr-block--last">
            <div className="block-label">05 / NEW POST</div>
            <button className="post-image-pick" onClick={() => setPostPickerOpen(true)}>
              {postImage ? <img src={assets.find((a) => a.id === postImage)?.src} alt="" /> : <ImageIcon size={16} />}
              <span>{assets.find((a) => a.id === postImage)?.title ?? 'CHOOSE AN IMAGE'}</span>
              <small>CHANGE</small>
            </button>
            <textarea className="textarea" rows={3} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="the caption nobody asked for…" />
            <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="tags, separated, by commas" />
            <div className="post-actions">
              <button className="btn btn--solid btn--sm" onClick={publish}><Send size={11} /> PUBLISH</button>
              <button className="btn btn--ghost btn--sm" onClick={queue}><Clock size={11} /> QUEUE</button>
            </div>
          </div>
        </aside>

        <section className="tumblr-stage">
          <div className="tumblr-browser">
            <div className="tumblr-browser-bar">
              <div className="browser-dots"><i /><i /><i /></div>
              <div className="browser-url"><ExternalLink size={9} /> {blog.url}</div>
              <span className="mono-xs muted">LIVE PREVIEW</span>
            </div>

            <div className={`tumblr-blog tumblr-blog--${blog.theme}`} style={{ '--blog-accent': blog.palette[0], '--blog-ink': blog.palette[2], '--blog-paper': '#e9e4d8' } as CSSProperties}>
              <div className="tumblr-blog-head">
                {header ? <img className="tumblr-header" src={header.src} alt="" /> : <div className="tumblr-header tumblr-header--blank" />}
                <div className="tumblr-blog-identity">
                  {avatar ? <img className="tumblr-avatar" src={avatar.src} alt="" /> : <div className="tumblr-avatar tumblr-avatar--blank" />}
                  <div>
                    <h1>{blog.title}</h1>
                    <p className="tumblr-bio">{blog.bio}</p>
                  </div>
                </div>
                <div className="tumblr-nav">
                  <span>archive</span><span>ask</span><span>theme</span><span>rss</span>
                  <span className="mono-xs">{posts.length} posts</span>
                </div>
              </div>

              <div className="tumblr-feed">
                {published.map((p) => {
                  const a = assets.find((x) => x.id === p.assetId)
                  return (
                    <article key={p.id} className="tumblr-post">
                      <div className="tumblr-post-head">
                        <span>{new Date(p.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}</span>
                        <span>{p.rebloggedFrom ? 'REBLOG' : 'PHOTO'}</span>
                        <button onClick={() => removePost(p.id)} title="Delete"><X size={10} /></button>
                      </div>
                      {a && <div className="tumblr-post-image"><img src={a.src} alt="" /></div>}
                      <p className="tumblr-caption">{p.caption}</p>
                      <div className="tumblr-tags">{p.tags.map((t) => <span key={t}>#{t.replace(/\s+/g, '')}</span>)}</div>
                      <div className="tumblr-post-foot">
                        <button onClick={() => updatePost(p.id, { notes: p.notes + 1 })}><Heart size={11} /> {p.notes.toLocaleString()}</button>
                        <button onClick={() => reblog(p)}><Repeat2 size={11} /> reblog</button>
                        <button><MessageCircle size={11} /> reply</button>
                        <span className="mono-xs muted">{a?.title ?? 'text post'}</span>
                      </div>
                    </article>
                  )
                })}
                {!published.length && <div className="tumblr-empty">Nothing published. Start with an image and a sentence.</div>}
              </div>

              <div className="tumblr-blog-foot">
                <span>{blog.title} / {blog.url}</span>
                <span>theme: {blog.theme} · powered by memory</span>
              </div>
            </div>
          </div>

          <div className="tumblr-queue">
            <div className="queue-head"><span className="mono-xs">QUEUE / {queued.length}</span><span className="mono-xs muted">NOT YET PUBLIC</span></div>
            {queued.map((p) => {
              const a = assets.find((x) => x.id === p.assetId)
              return (
                <div key={p.id} className="queue-row">
                  {a ? <img src={a.src} alt="" /> : <div className="queue-noimg" />}
                  <div>
                    <p>{p.caption}</p>
                    <span className="mono-xs muted">{p.tags.map((t) => `#${t}`).join(' ')}</span>
                  </div>
                  <button className="btn btn--ghost btn--sm" onClick={() => { updatePost(p.id, { status: 'published', createdAt: Date.now() }); toast('Published from queue', blog.title, 'success') }}><Check size={11} /> PUBLISH</button>
                  <button className="icon-btn" onClick={() => removePost(p.id)}><Trash2 size={11} /></button>
                </div>
              )
            })}
            {!queued.length && <p className="mini-note">The queue is empty. The internet can wait.</p>}
          </div>
        </section>
      </div>

      <section className="section">
        <SectionHead index="10" title="The personal web" link={<span className="mono-xs muted">NO ALGORITHM</span>} />
        <div className="tumblr-manifesto">
          <blockquote>“A blog used to be a room. You chose the wallpaper, the music, the photograph above the desk. Nobody ranked it. Nobody measured it. It existed because you wanted it to.”</blockquote>
          <div className="manifesto-side">
            <div className="kv"><span>Posts</span><span>{posts.length}</span></div>
            <div className="kv"><span>Queue</span><span>{queued.length}</span></div>
            <div className="kv"><span>Theme</span><span>{blog.theme}</span></div>
            <div className="kv"><span>Palette</span><span>{blog.palette.length} colours</span></div>
            <CopyButton text={blog.url} label="COPY BLOG URL" />
          </div>
        </div>
      </section>

      <Modal open={!!picker} onClose={() => setPicker(null)} eyebrow="BLOG IMAGERY" title={picker === 'avatar' ? 'Choose an avatar' : 'Choose a header image'} width={960} footer={<button className="btn btn--ghost btn--sm" onClick={() => setPicker(null)}>CLOSE</button>}>
        <div className="attach-grid">
          <UploadPlate
            label="UPLOAD FROM LAPTOP"
            onPicked={(a) => {
              if (picker === 'avatar') setBlog({ ...blog, avatarAssetId: a.id })
              else setBlog({ ...blog, headerAssetId: a.id })
              setPicker(null)
            }}
          />
          {assets.filter((a) => a.kind !== 'layout').slice(0, 40).map((a) => (
            <button key={a.id} className="attach-pick" onClick={() => {
              if (picker === 'avatar') setBlog({ ...blog, avatarAssetId: a.id })
              else setBlog({ ...blog, headerAssetId: a.id })
              setPicker(null)
            }}>
              <ImagePlate src={a.src} alt={a.title} ratio="1 / 1" />
              <span>{a.title}</span>
            </button>
          ))}
        </div>
      </Modal>

      <Modal open={postPickerOpen} onClose={() => setPostPickerOpen(false)} eyebrow="POST IMAGE" title="Choose a photograph" width={960} footer={<button className="btn btn--ghost btn--sm" onClick={() => setPostPickerOpen(false)}>CLOSE</button>}>
        <div className="attach-grid">
          <UploadPlate
            label="UPLOAD FROM LAPTOP"
            onPicked={(a) => { setPostImage(a.id); setPostPickerOpen(false) }}
          />
          {assets.filter((a) => a.kind !== 'layout').slice(0, 40).map((a) => (
            <button key={a.id} className="attach-pick" onClick={() => { setPostImage(a.id); setPostPickerOpen(false) }}>
              <ImagePlate src={a.src} alt={a.title} ratio="1 / 1" />
              <span>{a.title}</span>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  )
}
