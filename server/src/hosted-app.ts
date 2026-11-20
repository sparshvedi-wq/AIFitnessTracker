import fastifyStatic from '@fastify/static'
import { access } from 'node:fs/promises'
import { resolve } from 'node:path'
import { buildApp } from './app.js'

export async function createHostedApp(directory: string) {
  const root = resolve(directory)
  await access(resolve(root, 'index.html'))
  const app = buildApp({ allowSynthetic: false })
  await app.register(fastifyStatic, { root, wildcard: false })
  app.setNotFoundHandler((request, reply) => {
    const path = request.url.split('?')[0]
    if (path === '/api' || path.startsWith('/api/') || path.startsWith('/assets/') || path.startsWith('/exercise-guides/') || !['GET', 'HEAD'].includes(request.method)) {
      return reply.code(404).send({ error: 'Not found.' })
    }
    return reply.type('text/html').sendFile('index.html')
  })
  return app
}
