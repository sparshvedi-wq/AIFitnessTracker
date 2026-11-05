import { buildApp } from './app.js'
import { createHostedApp } from './hosted-app.js'
const app = process.env.STATIC_DIR
  ? await createHostedApp(process.env.STATIC_DIR)
  : buildApp({ allowSynthetic: process.env.NODE_ENV !== 'production' })
await app.listen({ host: process.env.HOST || '127.0.0.1', port: Number(process.env.PORT || 3010) })
console.log(
  'Tally photo service ready on port ' + (process.env.PORT || '3010'),
)
