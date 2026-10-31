import { buildApp } from './app.js'
const app = buildApp({ allowSynthetic: process.env.NODE_ENV !== 'production' })
await app.listen({ host: '127.0.0.1', port: Number(process.env.PORT || 3010) })
console.log(
  'Tally photo service ready on loopback port ' + (process.env.PORT || '3010'),
)
