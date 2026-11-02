import type { ZineIssue } from './types'

export interface PublicationPage {
  index: number
  headline: string
  template: string
  dataUrl: string
  width: number
  height: number
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export function publicationSlug(issue: ZineIssue): string {
  return (issue.title || 'campaign-04-issue')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

export function buildPublicationHtml(issue: ZineIssue, pages: PublicationPage[], studioName: string): string {
  const title = escapeHtml(issue.title)
  const number = escapeHtml(issue.number)
  const season = escapeHtml(issue.season)
  const publisher = escapeHtml(issue.publisher)
  const description = escapeHtml(issue.description)
  const studio = escapeHtml(studioName)
  const cover = pages[0]?.dataUrl ?? ''
  const pageMarkup = pages
    .map(
      (page) => `    <section class="page" id="page-${page.index}" data-page="${page.index}">
      <figure>
        <img src="${page.dataUrl}" alt="${escapeHtml(page.headline)}" loading="lazy" />
        <figcaption><span>${String(page.index).padStart(2, '0')} / ${String(pages.length).padStart(2, '0')}</span><span>${escapeHtml(page.template)}</span></figcaption>
      </figure>
    </section>`,
    )
    .join('\n')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="description" content="${description}" />
<meta property="og:title" content="${title} — ${number}" />
<meta property="og:description" content="${description}" />
<meta property="og:type" content="article" />
${cover ? `<meta property="og:image" content="${cover}" />` : ''}
<title>${title} — ${number}</title>
<style>
  :root{--paper:#efe8d8;--ink:#171512;--accent:#9b5e63;--muted:#8d8579;--dark:#131210;--light:#f4efe4}
  *{box-sizing:border-box}
  html{scroll-behavior:smooth}
  body{margin:0;background:var(--dark);color:var(--light);font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
  .cover{min-height:100vh;display:grid;grid-template-rows:auto 1fr auto;gap:32px;padding:clamp(24px,5vw,72px);background:var(--paper);color:var(--ink);border-bottom:1px solid rgba(255,255,255,.08)}
  .cover-top{display:flex;justify-content:space-between;gap:20px;font-size:10px;letter-spacing:.16em;text-transform:uppercase;border-bottom:1px solid rgba(23,21,18,.35);padding-bottom:12px}
  .cover-middle{display:grid;align-content:center;gap:18px;max-width:1200px}
  .kicker{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--accent)}
  h1{margin:0;font-family:Georgia,"Times New Roman",serif;font-weight:400;font-size:clamp(58px,13vw,180px);line-height:.84;letter-spacing:-.055em;max-width:10ch}
  .deck{max-width:620px;margin:0;font-family:Georgia,"Times New Roman",serif;font-size:clamp(18px,2.1vw,28px);line-height:1.35;color:#3b3730}
  .cover-foot{display:flex;justify-content:space-between;align-items:end;gap:24px;border-top:1px solid rgba(23,21,18,.35);padding-top:14px;font-size:10px;letter-spacing:.12em;text-transform:uppercase}
  .cover-foot p{margin:0;max-width:36ch;line-height:1.6}
  .reader{display:flex;flex-direction:column;align-items:center;padding:clamp(26px,5vw,72px) 18px 130px;scroll-snap-type:y proximity}
  .page{width:100%;display:flex;justify-content:center;padding:clamp(18px,4vw,56px) 0;scroll-snap-align:start}
  figure{margin:0;width:min(100%,1000px);display:grid;gap:12px}
  figure img{display:block;width:100%;height:auto;background:#24211c;box-shadow:0 40px 100px -40px rgba(0,0,0,.95);border:1px solid rgba(244,239,228,.08)}
  figcaption{display:flex;justify-content:space-between;gap:16px;font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:#a39a8b}
  .toolbar{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:20;display:flex;align-items:center;gap:2px;padding:5px;border:1px solid rgba(244,239,228,.18);background:rgba(19,18,16,.92);backdrop-filter:blur(16px);color:var(--light)}
  .toolbar button{border:0;background:transparent;color:inherit;font:inherit;font-size:9px;letter-spacing:.14em;text-transform:uppercase;padding:10px 13px;cursor:pointer}
  .toolbar button:hover{background:rgba(244,239,228,.1)}
  .toolbar .count{min-width:86px;text-align:center;font-size:9px;letter-spacing:.14em;color:#bdb4a6}
  .end{display:grid;place-items:center;gap:12px;min-height:52vh;padding:40px;text-align:center;border-top:1px solid rgba(244,239,228,.1)}
  .end strong{font-family:Georgia,"Times New Roman",serif;font-size:clamp(30px,5vw,64px);font-weight:400;letter-spacing:-.04em}
  .end span{font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:#a39a8b}
  @media (max-width:700px){.cover-top,.cover-foot{flex-direction:column;align-items:start}.toolbar{width:calc(100% - 24px);justify-content:space-between}.toolbar button{padding:10px 8px}}
  @media print{
    :root{--dark:#fff;--light:#000}
    html,body{background:#fff;color:#000}
    .cover{display:none}
    .reader{padding:0;display:block;scroll-snap-type:none}
    .page{display:block;padding:0;margin:0;break-after:page;page-break-after:always}
    figure{width:100%;max-width:none;gap:0}
    figure img{box-shadow:none;border:0;width:100%;height:auto;max-height:100vh;object-fit:contain}
    figcaption,.toolbar,.end{display:none}
    @page{size:A5 portrait;margin:0}
  }
</style>
</head>
<body>
  <header class="cover" id="cover">
    <div class="cover-top"><span>${publisher}</span><span>${number} · ${season}</span></div>
    <div class="cover-middle">
      <span class="kicker">${studio} / independent publishing</span>
      <h1>${title}</h1>
      <p class="deck">${description}</p>
    </div>
    <div class="cover-foot"><p>${pages.length} pages. Edited in the browser. Printed nowhere yet.</p><span>${season}</span></div>
  </header>
  <main class="reader" id="reader">
${pageMarkup}
    <footer class="end"><strong>${title}</strong><span>${publisher} · ${number} · ${season}</span><span>CAMPAIGN 04 / MAKE SOMETHING WORTH REMEMBERING</span></footer>
  </main>
  <nav class="toolbar" aria-label="Issue navigation">
    <button type="button" data-cover>COVER</button>
    <button type="button" data-prev>PREV</button>
    <span class="count" id="count">01 / ${String(pages.length).padStart(2, '0')}</span>
    <button type="button" data-next>NEXT</button>
    <button type="button" onclick="window.print()">PRINT / PDF</button>
  </nav>
  <script>
    (() => {
      const pages = [...document.querySelectorAll('[data-page]')];
      const count = document.getElementById('count');
      const total = pages.length;
      let current = 0;
      const show = (index) => {
        current = Math.max(0, Math.min(total - 1, index));
        pages[current]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (count) count.textContent = String(current + 1).padStart(2, '0') + ' / ' + String(total).padStart(2, '0');
      };
      document.querySelector('[data-prev]')?.addEventListener('click', () => show(current - 1));
      document.querySelector('[data-next]')?.addEventListener('click', () => show(current + 1));
      document.querySelector('[data-cover]')?.addEventListener('click', () => document.getElementById('cover')?.scrollIntoView({ behavior: 'smooth' }));
      const observer = new IntersectionObserver((entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        current = Number(visible.target.getAttribute('data-page')) - 1;
        if (count) count.textContent = String(current + 1).padStart(2, '0') + ' / ' + String(total).padStart(2, '0');
      }, { threshold: [0.25, 0.5, 0.75] });
      pages.forEach((page) => observer.observe(page));
      window.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); show(current + 1); }
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); show(current - 1); }
      });
    })();
  </script>
</body>
</html>`
}
