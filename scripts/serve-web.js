import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const port = Number.parseInt(process.env.PORT || '4173', 10)
const mime = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.sh', 'text/x-shellscript; charset=utf-8'],
  ['.tgz', 'application/gzip'],
])

const server = createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname)
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
  let requested = path.resolve(root, relative)

  if (!requested.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403).end('Forbidden')
    return
  }

  try {
    let info
    try {
      info = await stat(requested)
    } catch (error) {
      if (path.extname(requested)) throw error
      requested = `${requested}.html`
      info = await stat(requested)
    }
    if (!info.isFile()) throw new Error('Not a file')
    response.writeHead(200, {
      'Content-Type': mime.get(path.extname(requested)) || 'application/octet-stream',
      'Content-Length': info.size,
      'X-Content-Type-Options': 'nosniff',
    })
    createReadStream(requested).pipe(response)
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found')
  }
})

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`GitTyper web app: http://127.0.0.1:${port}\n`)
})
