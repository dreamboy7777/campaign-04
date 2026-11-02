import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve, sep } from 'node:path'

const root = resolve('dist')
const port = Number(process.env.PORT || 5173)
const host = process.env.HOST || '127.0.0.1'

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8',
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    ...headers,
  })
  res.end(body)
}

const server = createServer(async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return send(res, 405, 'Method not allowed', { 'Content-Type': 'text/plain; charset=utf-8' })
    }

    if (req.url === '/__health') {
      return send(res, 200, JSON.stringify({ ok: true, app: 'campaign-04' }), {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      })
    }

    const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname)
    let file = normalize(join(root, pathname))
    if (file !== root && !file.startsWith(root + sep)) {
      return send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain; charset=utf-8' })
    }

    let fileStat
    try {
      fileStat = await stat(file)
    } catch {
      fileStat = null
    }

    if (!fileStat || fileStat.isDirectory()) {
      file = join(root, 'index.html')
      fileStat = await stat(file)
    }

    const data = await readFile(file)
    const extension = extname(file).toLowerCase()
    const isHtml = extension === '.html'
    const isHashedAsset = pathname.startsWith('/assets/')

    send(res, 200, req.method === 'HEAD' ? undefined : data, {
      'Content-Type': mime[extension] || 'application/octet-stream',
      'Content-Length': data.length,
      'Cache-Control': isHtml ? 'no-cache' : isHashedAsset ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
    })
  } catch (error) {
    console.error(error)
    send(res, 500, 'Internal server error', { 'Content-Type': 'text/plain; charset=utf-8' })
  }
})

server.listen(port, host, () => {
  console.log(`CAMPAIGN 04 is live at http://localhost:${port}/`)
})
