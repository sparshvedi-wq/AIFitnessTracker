// Optional server interpretation for requests the local parser didn't
// understand. Used only when the build enables it (VITE_ASSIST_AI=on), only
// after the person submits, and never on load, keystrokes or timers. The
// reply is treated as a suggestion: names are re-resolved locally and
// anything doubtful becomes a clarification.
import { addDays } from '../date.js'
import { INTENTS, resolveExercises } from './parse.js'

const TIMEOUT_MS = 9000
const CLIENT_KEY = 'tally:assist-client'

export function remoteInterpretationAvailable() {
  const flag = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_ASSIST_AI : undefined
  return flag === 'on' && typeof navigator !== 'undefined' && navigator.onLine !== false
}

// An anonymous, per-device identifier used only for budgets and cache isolation.
function clientId() {
  try {
    let id = localStorage.getItem(CLIENT_KEY)
    if (!id) {
      id = (crypto.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`).replace(/[^A-Za-z0-9-]/g, '')
      localStorage.setItem(CLIENT_KEY, id)
    }
    return id
  } catch {
    return 'anonymous-device'
  }
}

/** Turns a validated server reply into the same shape the local parser returns. */
export function toParsed(reply, context) {
  if (!reply || !INTENTS.concat('unknown').includes(reply.intent)) return { unknown: true, intents: [] }
  const scope = reply.scope === 'persistent-requested' ? 'persistent-requested' : 'temporary'
  if (reply.needsClarification || reply.intent === 'unknown')
    return reply.clarification
      ? { intents: [], scope, clarify: { question: String(reply.clarification).slice(0, 120), options: [] } }
      : { unknown: true, intents: [] }
  const exercise = (pool) => {
    if (!reply.exercise) return null
    // Only a complete match to a known exercise counts; anything else is asked about.
    return resolveExercises(reply.exercise, { pool, custom: context.custom }).find((m) => m.complete)?.id || null
  }
  const place = reply.place ? context.places.find((p) => p.name.toLowerCase() === String(reply.place).toLowerCase()) : null
  const intent = (() => {
    switch (reply.intent) {
      case 'plan.minutes':
        return Number.isInteger(reply.minutes) && reply.minutes >= 5 && reply.minutes <= 90
          ? { type: 'plan.minutes', args: { minutes: reply.minutes } }
          : null
      case 'plan.place':
        return place ? { type: 'plan.place', args: { location: place.id } } : null
      case 'exercise.replace': {
        const id = exercise([...new Set([...(context.workoutIds || []), ...(context.planIds || [])])])
        return id ? { type: 'exercise.replace', args: { exId: id } } : null
      }
      case 'exercise.progress': {
        const id = exercise(context.historyIds?.length ? context.historyIds : null)
        return id ? { type: 'exercise.progress', args: { exId: id } } : null
      }
      case 'history.show': {
        const days = Number.isInteger(reply.days) && reply.days > 0 && reply.days <= 366 ? reply.days : 30
        return {
          type: 'history.show',
          args: { from: addDays(context.today, -(days - 1)), to: context.today, label: `past ${days} days`, filter: reply.filter || 'all' },
        }
      }
      case 'plan.explain':
        return { type: 'plan.explain', args: {} }
      case 'activity.add':
        return { type: 'activity.add', args: {} }
      default:
        return null
    }
  })()
  if (!intent) return { intents: [], scope, clarify: { question: 'Could you say that a little differently?', options: [] } }
  return { intents: [intent], scope }
}

export async function interpretRemotely(text, context, signal) {
  const timeout = AbortSignal.timeout(TIMEOUT_MS)
  const combined = AbortSignal.any ? AbortSignal.any([signal, timeout]) : signal
  try {
    const res = await fetch('/api/assistant/interpret', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: combined,
      body: JSON.stringify({
        text: text.slice(0, 200),
        today: context.today,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        places: context.places.map((p) => p.name).slice(0, 12),
        exercises: (context.workoutIds?.length ? context.workoutIds : context.planIds)
          .map((id) => context.nameOf?.(id) || id)
          .slice(0, 12),
        clientId: clientId(),
      }),
    })
    if (res.status === 429) return { status: 'rate-limited', message: 'That’s enough language help for now.' }
    if (!res.ok) return { status: 'error', message: 'I didn’t catch that.' }
    return { status: 'ok', parsed: toParsed(await res.json(), context) }
  } catch {
    if (signal.aborted) return { status: 'cancelled' }
    return { status: 'error', message: timeout.aborted ? 'That took too long.' : 'I didn’t catch that.' }
  }
}
