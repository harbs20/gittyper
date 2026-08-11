import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { SessionSandbox } from './repository.js'

async function readJson(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 8_192) throw new Error('Request body is too large.')
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}

export async function createSandboxServer() {
  const sandbox = new SessionSandbox()
  const token = randomBytes(24).toString('hex')
  const server = createServer(async (request, response) => {
    response.setHeader('content-type', 'application/json; charset=utf-8')
    if (request.headers.authorization !== `Bearer ${token}`) {
      response.statusCode = 401
      response.end(JSON.stringify({ error: 'Unauthorized.' }))
      return
    }

    try {
      if (request.method === 'POST' && request.url === '/session') {
        const { challengeId } = await readJson(request)
        response.end(JSON.stringify(await sandbox.reset(challengeId)))
      } else if (request.method === 'POST' && request.url === '/command') {
        const { command } = await readJson(request)
        response.end(JSON.stringify(await sandbox.run(String(command ?? ''))))
      } else {
        response.statusCode = 404
        response.end(JSON.stringify({ error: 'Not found.' }))
      }
    } catch (error) {
      response.statusCode = 400
      response.end(JSON.stringify({ error: error.message }))
    }
  })

  await new Promise((resolvePromise, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolvePromise)
  })
  const address = server.address()
  const url = `http://127.0.0.1:${address.port}`

  return {
    url,
    token,
    sandbox,
    async close() {
      await new Promise((resolvePromise) => server.close(resolvePromise))
      await sandbox.close()
    },
  }
}

export class SandboxClient {
  constructor(url, token) {
    this.url = url
    this.token = token
  }

  async post(path, body) {
    const response = await fetch(`${this.url}${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error || `Sandbox request failed (${response.status}).`)
    return payload
  }

  session(challengeId) { return this.post('/session', { challengeId }) }
  command(command) { return this.post('/command', { command }) }
}
