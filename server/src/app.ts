import Fastify from 'fastify'
import rateLimit from '@fastify/rate-limit'
import {
  assessmentRequest,
  modelAssessment,
  qualityRequest,
  photoQuality,
  reviewAssessment,
} from './photo/schema.js'
import {
  createAnalyzer,
  createQualityAnalyzer,
  type Analyzer,
  type QualityAnalyzer,
} from './photo/analyze.js'
import { preparePhotos, PhotoInputError } from './photo/images.js'
import { activityRequest, activityImpact, createActivityAnalyzer, type ActivityAnalyzer } from './activity.js'
import { assistRequest, createAssistService, createInterpreter } from './assistant.js'

export function buildApp(
  options: {
    analyze?: Analyzer
    quality?: QualityAnalyzer
    activity?: ActivityAnalyzer
    assist?: ReturnType<typeof createAssistService> | null
    allowSynthetic?: boolean
  } = {},
) {
  // No request logger: images, goals, provider errors and credentials must never be logged.
  const app = Fastify({ logger: false })
  app.register(rateLimit, { global: false })
  const analyze = options.analyze ?? createAnalyzer()
  const quality = options.quality ?? createQualityAnalyzer()
  const activity = options.activity ?? createActivityAnalyzer()
  // Language help is off unless explicitly enabled and configured.
  const assist =
    options.assist !== undefined
      ? options.assist
      : process.env.ASSIST_AI_ENABLED === 'true' && process.env.OPENAI_API_KEY?.trim()
        ? createAssistService(createInterpreter())
        : null
  let active = 0
  app.setErrorHandler((error, _req, reply) =>
    reply
      .header('Cache-Control', 'no-store')
      .code((error as { statusCode?: number }).statusCode || 500)
      .send({
        error:
          (error as { statusCode?: number }).statusCode === 413
            ? 'This photoset is too large. Choose smaller photos.'
            : 'The photo request could not finish. Try again shortly.',
      }),
  )
  app.get('/api/health', async () => ({
    service: 'tally-ink-photos',
    configured: Boolean(process.env.OPENAI_API_KEY?.trim()),
  }))
  app.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store')
    // Dev service binds to loopback and is reached only through Vite's same-origin proxy.
    const origin = request.headers.origin
    if (origin) {
      let allowed = false
      try {
        const u = new URL(origin)
        allowed =
          ['http:', 'https:'].includes(u.protocol) &&
          u.host === request.headers.host
      } catch {
        /* reject malformed */
      }
      if (!allowed)
        return reply
          .code(403)
          .send({ error: 'Open photo check-ins from the Tally app.' })
    }
  })
  app.post('/api/activity-impact', { bodyLimit:4096, config:{rateLimit:{max:8,timeWindow:'10 minutes'}} }, async (request,reply) => {
    const parsed=activityRequest.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({error:'Describe the activity in 8–700 characters and allow AI interpretation.'})
    if (active>=2) return reply.code(503).send({error:'AI service is busy. You can set the activity details manually.'})
    active++
    try { return { ...activityImpact.parse(await activity(parsed.data.description)), model:'gpt-6-luna' } }
    catch { return reply.code(502).send({error:'AI could not interpret this activity. Try again or choose the involved areas yourself.'}) }
    finally { active-- }
  })
  app.post(
    '/api/assistant/interpret',
    { bodyLimit: 4096, config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } },
    async (request, reply) => {
      if (!assist) return reply.code(503).send({ code: 'disabled', error: 'Language help is off. Common requests still work.' })
      const parsed = assistRequest.safeParse(request.body)
      if (!parsed.success) return reply.code(400).send({ code: 'invalid', error: 'That request could not be read.' })
      const controller = new AbortController()
      request.raw.on('close', () => {
        if (!reply.sent) controller.abort()
      })
      const result = await assist.interpret(parsed.data, controller.signal)
      if (result.status === 'ok') return { ...result.output, cached: result.cached, schemaVersion: 1 }
      const status = { budget: 429, timeout: 504, cancelled: 499, error: 502 }[result.status]
      return reply.code(status).send({
        code: result.status,
        error:
          result.status === 'budget'
            ? 'That’s enough language help for today. Common requests still work.'
            : 'Language help didn’t answer. Common requests still work.',
      })
    },
  )
  app.post(
    '/api/photo-quality',
    {
      bodyLimit: 5 * 1024 * 1024,
      config: { rateLimit: { max: 18, timeWindow: '10 minutes' } },
    },
    async (request, reply) => {
      const parsed = qualityRequest.safeParse(request.body)
      if (!parsed.success || parsed.data.synthetic && !options.allowSynthetic)
        return reply.code(400).send({
          error:
            'Confirm photo ownership, AI consent and age permissions first.',
        })
      if (active >= 2)
        return reply
          .code(503)
          .send({ error: 'Photo service is busy. Please try again.' })
      active++
      try {
        const [image] = await preparePhotos([parsed.data.photo])
        return photoQuality.parse(await quality(image, parsed.data.ageGroup))
      } catch (err) {
        return reply.code(err instanceof PhotoInputError ? 400 : 502).send({
          error:
            err instanceof PhotoInputError
              ? err.message
              : 'Photo quality could not be checked. Check the server key, model access or billing and retry.',
        })
      } finally {
        active--
      }
    },
  )
  app.post(
    '/api/photo-assessments',
    {
      bodyLimit: 13 * 1024 * 1024,
      config: { rateLimit: { max: 6, timeWindow: '10 minutes' } },
    },
    async (request, reply) => {
      const parsed = assessmentRequest.safeParse(request.body)
      if (!parsed.success || parsed.data.synthetic && !options.allowSynthetic)
        return reply.code(400).send({
          error:
            'Choose three different front, side and back photos and confirm age, ownership and consent.',
        })
      if (active >= 2)
        return reply
          .code(503)
          .send({ error: 'Photo service is busy. Please try again.' })
      active++
      try {
        const photos = await preparePhotos(parsed.data.photos)
        const result = modelAssessment.parse(
          await analyze(
            photos,
            parsed.data.goal,
            parsed.data.ageGroup,
            parsed.data.focusPreferences,
          ),
        )
        return {
          ...reviewAssessment(result),
          analyzedAt: new Date().toISOString(),
        }
      } catch (err) {
        return reply.code(err instanceof PhotoInputError ? 400 : 502).send({
          error:
            err instanceof PhotoInputError
              ? err.message
              : 'Photo review could not finish. Check the server key, model access or billing and retry. Your photos were not saved on the server.',
        })
      } finally {
        active--
      }
    },
  )
  return app
}
