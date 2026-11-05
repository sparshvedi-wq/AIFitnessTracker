import type { IncomingMessage, ServerResponse } from 'node:http'
import type { HTTPMethods } from 'fastify'
import { buildApp } from './app.js'

const MAX_BODY = 4_000_000
export function createHttpHandler(app = buildApp({ allowSynthetic: false })) {
  const ready = app.ready()
  return async (req: IncomingMessage & { body?: unknown }, res: ServerResponse) => {
    try {
      await ready
      let payload: string | Buffer | undefined
      if (req.body !== undefined) {
        payload = Buffer.isBuffer(req.body) ? req.body : typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
      } else {
        const chunks: Buffer[] = []
        let size = 0
        for await (const chunk of req.iterator({ destroyOnReturn: false })) {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
          size += buffer.length
          if (size > MAX_BODY) { req.resume(); res.writeHead(413, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end('{"error":"Photoset is too large. Choose smaller photos."}'); return }
          chunks.push(buffer)
        }
        if (size) payload = Buffer.concat(chunks)
      }
      if (payload && Buffer.byteLength(payload) > MAX_BODY) {
        res.writeHead(413, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
        res.end('{"error":"Photoset is too large. Choose smaller photos."}')
        return
      }
      const headers = { ...req.headers }
      delete headers['content-length']
      delete headers['transfer-encoding']
      const reply = await app.inject({ method: (req.method || 'GET') as HTTPMethods, url: req.url || '/', headers, payload, remoteAddress: req.socket.remoteAddress })
      res.writeHead(reply.statusCode, reply.headers)
      res.end(reply.rawPayload)
    } catch {
      res.writeHead(500, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
      res.end('{"error":"The service could not finish this request."}')
    }
  }
}
