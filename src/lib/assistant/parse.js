// Local, deterministic understanding of short requests typed into
// "Ask or adjust…". No network. The parser only recognises intents; IDs,
// numbers and dates are resolved here, and every statistic or change is
// computed by app code (assistant/actions.js), never by text generation.
//
// Result: { intents: [{ type, args }], scope, clarify?: { question, options }, unknown?: true }
import { addDays, fromKey, toKey } from '../date.js'
import { EXERCISES } from '../exercises.js'

export const PARSER_VERSION = 1
export const INTENTS = [
  'history.show',
  'exercise.progress',
  'plan.explain',
  'plan.minutes',
  'plan.place',
  'exercise.replace',
  'activity.add',
  'filters.clear',
]

const WORD_NUMBERS = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, 'forty-five': 45, fortyfive: 45, sixty: 60, ninety: 90,
}

export function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)
}

// Small, explicit typo tolerance for the command words people type most.
const KEYWORDS = {
  show: ['show', 'list', 'see', 'view', 'display', 'what did i do', 'history', 'workouts', 'sessions', 'trainings'],
  progress: ['improved', 'improve', 'progress', 'progressed', 'progressing', 'gotten better', 'got better', 'getting better', 'stronger at', 'how is my', 'hows my', 'how has my', 'trend'],
  explain: ['why', 'explain', 'reason'],
  replace: ['replace', 'swap', 'switch out', 'instead of', 'change out', 'no more', 'dont want', 'do not want', 'skip the', 'without'],
  activity: ['add', 'log', 'played', 'playing', 'game', 'match', 'hike', 'hiking', 'ran', 'race', 'activity', 'event'],
  clear: ['clear', 'reset filter', 'reset filters', 'show all', 'remove filter', 'remove filters', 'start over'],
}
const TYPOS = { shwo: 'show', hsitory: 'history', histroy: 'history', workuots: 'workouts', wrokouts: 'workouts', replce: 'replace', repalce: 'replace', minuets: 'minutes', mintues: 'minutes', mins: 'minutes', min: 'minutes', hr: 'hour', hrs: 'hours', improvd: 'improved', imporved: 'improved', squats: 'squat', lunges: 'lunge', curls: 'curl', rows: 'row', presses: 'press', deadlifts: 'deadlift', pushups: 'push-up', 'push-ups': 'push-up', pullups: 'pull-up', 'pull-ups': 'pull-up', planks: 'plank' }

function tokens(text) {
  return normalizeText(text)
    .split(' ')
    .map((t) => TYPOS[t] || t)
}

const has = (text, list) => list.some((k) => new RegExp(`(^| )${k}( |$)`).test(text))

/** Minutes requested: "15 min", "half an hour", "an hour", "quarter of an hour", "90 seconds" ignored. */
export function parseMinutes(text) {
  const t = ` ${text} `
  if (/ half (an )?hour /.test(t)) return 30
  if (/ (an|one|1) hour and a half /.test(t) || / 1 5 hours /.test(t)) return 90
  if (/ quarter (of )?(an )?hour /.test(t)) return 15
  if (/ (an|one|1) hour /.test(t)) return 60
  const hours = t.match(/ (\d+(?:\.\d+)?) hours? /)
  if (hours) return Math.round(Number(hours[1]) * 60)
  const m = t.match(/ (\d{1,3}|[a-z-]+) minutes? /)
  if (m) {
    const n = /^\d+$/.test(m[1]) ? Number(m[1]) : WORD_NUMBERS[m[1]]
    if (n) return n
  }
  const bare = t.match(/ only (\d{1,3}) /) || t.match(/ (\d{1,3}) today /)
  if (bare) return Number(bare[1])
  return null
}

/** A local-date range from words. Calendar dates use the device's time zone. */
export function parseRange(text, today) {
  const t = ` ${text} `
  const n = (word) => (/^\d+$/.test(word) ? Number(word) : WORD_NUMBERS[word])
  let m = t.match(/ (?:past|last|previous) (\d+|[a-z]+) (day|days|week|weeks|month|months) /)
  if (m && n(m[1])) {
    const count = n(m[1]) * (m[2].startsWith('week') ? 7 : m[2].startsWith('month') ? 30 : 1)
    return { from: addDays(today, -(count - 1)), to: today, label: `past ${count} days` }
  }
  if (/ (past|last) (week) /.test(t)) return { from: addDays(today, -6), to: today, label: 'past 7 days' }
  if (/ (past|last) month /.test(t)) return { from: addDays(today, -29), to: today, label: 'past 30 days' }
  if (/ this week /.test(t)) {
    const d = fromKey(today)
    return { from: addDays(today, -((d.getDay() + 6) % 7)), to: today, label: 'this week' }
  }
  if (/ this month /.test(t)) return { from: today.slice(0, 8) + '01', to: today, label: 'this month' }
  if (/ this year /.test(t)) return { from: today.slice(0, 5) + '01-01', to: today, label: 'this year' }
  if (/ yesterday /.test(t)) return { from: addDays(today, -1), to: addDays(today, -1), label: 'yesterday' }
  if (/ today /.test(t) && !/ minutes? today | today i /.test(t)) return { from: today, to: today, label: 'today' }
  m = t.match(/ since (\d{4}-\d{2}-\d{2}) /)
  if (m) return { from: m[1], to: today, label: `since ${m[1]}` }
  const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
  m = t.match(/ (?:since|in) ([a-z]+)(?: (\d{1,2}))? /)
  if (m && MONTHS.some((name) => name.startsWith(m[1]) && m[1].length >= 3)) {
    const month = MONTHS.findIndex((name) => name.startsWith(m[1]))
    const year = Number(today.slice(0, 4)) - (month > Number(today.slice(5, 7)) - 1 ? 1 : 0)
    const from = toKey(new Date(year, month, m[2] ? Number(m[2]) : 1))
    const to = t.includes(' in ') && !m[2] ? toKey(new Date(year, month + 1, 0)) : today
    return { from, to: to > today ? today : to, label: `${t.includes(' in ') ? 'in' : 'since'} ${MONTHS[month]}` }
  }
  return null
}

// Exercise references: canonical names, legacy aliases and common short forms.
const SHORT = {
  squat: 'back-squat', squats: 'back-squat', bench: 'bench-press', deadlift: 'deadlift', 'overhead press': 'ohp',
  rows: 'barbell-row', row: 'barbell-row', 'pull up': 'pull-up', 'pull-up': 'pull-up', pullup: 'pull-up',
  'push up': 'push-up', 'push-up': 'push-up', pushup: 'push-up', lunge: 'lunge', lunges: 'lunge',
  plank: 'plank', rdl: 'rdl', 'leg press': 'leg-press', 'goblet squat': 'goblet-squat',
}
const searchName = (s) => normalizeText(s).replace(/-/g, ' ')

// Damerau–Levenshtein distance, capped: enough to forgive one typo.
function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > 1) return 2
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  return d[a.length][b.length]
}
const VOCABULARY = [...new Set(EXERCISES.flatMap((e) => [e.name, ...(e.aliases || [])]).flatMap((n) => searchName(n).split(' ')))].filter((w) => w.length >= 4)
/** Corrects one typo in a word when exactly one catalog word is that close. */
export function spellCorrect(word) {
  if (word.length < 4 || VOCABULARY.includes(word)) return word
  const close = VOCABULARY.filter((v) => editDistance(word, v) <= 1)
  return close.length === 1 ? close[0] : word
}
const FILLER = new Set(['my', 'the', 'a', 'an', 'with', 'for', 'today', 'please', 'pls', 'improved', 'improve', 'progress', 'progressed', 'progressing', 'going', 'been', 'doing', 'coming', 'along', 'lately', 'recently', 'getting', 'gotten', 'got', 'better', 'stronger', 'how', 'has', 'is', 'it', 'on', 'at', 'am', 'i', 'im', 'are', 'you', 'we', 'only', 'have', 'minutes', 'minute', 'hour', 'hours', 'time', 'just', 'so', 'now', 'something', 'anything', 'one', 'this', 'that'])

/**
 * All exercises a phrase could mean, best first. `pool` limits matching to
 * IDs in context (today's plan, the workout in progress, or history).
 */
export function resolveExercises(phrase, { pool = null, custom = [] } = {}) {
  const words = searchName(phrase)
    .split(' ')
    .filter((w) => w.length > 1 && !FILLER.has(w) && !/^[0-9]+$/.test(w))
    .map(spellCorrect)
  if (!words.length) return []
  const q = words.join(' ')
  const candidates = [...EXERCISES, ...custom].filter((e) => !pool || pool.includes(e.id))
  const scored = []
  for (const e of candidates) {
    const names = [e.name, ...(e.aliases || []), e.id].map(searchName)
    let score = 0
    let complete = false
    for (const name of names) {
      if (name === q) {
        score = Math.max(score, 100)
        complete = true
      } else if (name.includes(q)) {
        score = Math.max(score, 60 - name.length / 10)
        complete = true
      } else {
        const hit = words.filter((w) => name.split(' ').some((n) => n === w || n.startsWith(w) || (w.startsWith(n) && n.length > 3))).length
        if (hit === words.length) {
          score = Math.max(score, 40 - name.length / 10)
          complete = true
        } else if (hit) score = Math.max(score, (20 * hit) / words.length - name.length / 20)
      }
    }
    if (score > 0) scored.push({ id: e.id, name: e.name, score, complete })
  }
  const short = SHORT[q]
  if (short && (!pool || pool.includes(short)))
    scored.push({ id: short, name: EXERCISES.find((e) => e.id === short)?.name, score: 90, complete: true })
  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
  const seen = new Set()
  return scored.filter((s) => (seen.has(s.id) ? false : seen.add(s.id)))
}

function exercisePhrase(text, after) {
  const m = text.match(new RegExp(`(?:${after}) (?:the |my |doing )?(.+?)(?: (?:with|for|today|please|instead|and)\\b.*)?$`))
  return m ? m[1].trim() : ''
}

/**
 * @param text     what the person typed
 * @param context  { today, places: [{ id, name }], planIds: [], workoutIds: [], historyIds: [], custom }
 */
export function parseRequest(text, context) {
  const raw = normalizeText(text)
  const t = tokens(text).join(' ')
  const out = { text: raw, intents: [], scope: 'temporary', version: PARSER_VERSION }
  if (!t) return { ...out, unknown: true }
  if (/\b(always|from now on|every time|by default|default|usually)\b/.test(t)) out.scope = 'persistent-requested'

  if (has(t, KEYWORDS.clear)) out.intents.push({ type: 'filters.clear', args: {} })

  // Plan changes: time and place can come together in one request.
  const minutes = parseMinutes(t)
  if (minutes && !has(t, ['show', 'history', 'workouts over', 'sessions over'])) {
    out.intents.push({ type: 'plan.minutes', args: { minutes } })
  } else if (/\b(short on time|less time|quick one|quick session|in a hurry|not much time)\b/.test(t)) {
    out.intents.push({ type: 'plan.minutes', args: { minutes: 15, inferred: true } })
  }
  const places = context.places || []
  const mentioned = places.filter((p) => new RegExp(`(^| )${normalizeText(p.name)}( |$)`).test(t))
  const negated = (p) => new RegExp(`(no|not at|not the|not) (the )?${normalizeText(p.name)}( |$)`).test(t)
  const place = mentioned.find((p) => !negated(p))
  if (place && /(^| )(at|use|using|train|training|working out|today|equipment|gear|in)( |$)/.test(t))
    out.intents.push({ type: 'plan.place', args: { location: place.id } })
  else if (/\b(on the go|travelling|traveling|hotel room|no equipment|bodyweight only)\b/.test(t) && places.some((p) => p.id === 'on-the-go'))
    out.intents.push({ type: 'plan.place', args: { location: 'on-the-go' } })

  if (has(t, KEYWORDS.explain) && /(exercise|exercises|workout|plan|session|these|this|today)/.test(t))
    out.intents.push({ type: 'plan.explain', args: {} })

  if (has(t, KEYWORDS.replace)) {
    const phrase = exercisePhrase(t, 'replace|swap|switch out|instead of|change out|no more|dont want|do not want|skip the|without')
    const pool = [...new Set([...(context.workoutIds || []), ...(context.planIds || [])])]
    const found = phrase ? resolveExercises(phrase, { pool: pool.length ? pool : null, custom: context.custom }) : []
    const matches = found.filter((m) => m.complete)
    if (!phrase || !matches.length)
      return {
        ...out,
        clarify: {
          question: found.length ? 'Did you mean one of these?' : 'Which exercise should change?',
          options: (found.length ? found.slice(0, 4).map((m) => m.id) : pool).map((id) => ({ type: 'exercise.replace', args: { exId: id } })),
        },
      }
    const top = matches.filter((m) => m.score >= matches[0].score - 5)
    if (top.length > 1 && matches[0].score < 90)
      return {
        ...out,
        clarify: { question: 'Which one do you mean?', options: top.slice(0, 4).map((m) => ({ type: 'exercise.replace', args: { exId: m.id } })) },
      }
    out.intents.push({ type: 'exercise.replace', args: { exId: matches[0].id } })
  }

  if (has(t, KEYWORDS.progress) && !out.intents.some((i) => i.type === 'exercise.replace')) {
    const phrase =
      exercisePhrase(t, 'how has my|how is my|hows my|progress on|progress with|progress for|stronger at|trend for|trend of') ||
      t.replace(/\b(how|has|have|my|improved|improve|progress|progressed|gotten|got|getting|better|trend|is|the|on|with|been|going)\b/g, ' ').trim()
    const found = phrase ? resolveExercises(phrase, { pool: context.historyIds?.length ? context.historyIds : null, custom: context.custom }) : []
    const matches = found.filter((m) => m.complete)
    if (!matches.length)
      return {
        ...out,
        clarify: {
          question: 'Which exercise?',
          options: (context.historyIds || []).slice(-4).reverse().map((id) => ({ type: 'exercise.progress', args: { exId: id } })),
        },
      }
    const top = matches.filter((m) => m.score >= matches[0].score - 5)
    if (top.length > 1 && matches[0].score < 90)
      return {
        ...out,
        clarify: { question: 'Which one do you mean?', options: top.slice(0, 4).map((m) => ({ type: 'exercise.progress', args: { exId: m.id } })) },
      }
    out.intents.push({ type: 'exercise.progress', args: { exId: matches[0].id } })
  }

  const range = parseRange(t, context.today)
  const wantsHistory = has(t, KEYWORDS.show) || (range && /(workout|session|trained|training|did i|history)/.test(t))
  if (wantsHistory && !out.intents.some((i) => ['exercise.progress', 'plan.explain'].includes(i.type))) {
    const filter = /\bwarm ?ups?\b/.test(t)
      ? 'warmup'
      : /\b(activity|activities|events?|games?|matches)\b/.test(t)
        ? 'activity'
        : /\bphotos?\b|check-?ins?/.test(t)
          ? 'photo'
          : /\b(strength|training|lifting|workouts?)\b/.test(t)
            ? 'training'
            : 'all'
    out.intents.push({ type: 'history.show', args: { ...(range || { from: addDays(context.today, -29), to: context.today, label: 'past 30 days', defaulted: true }), filter } })
  }

  if (!out.intents.length && has(t, KEYWORDS.activity) && /(add|log|played|tomorrow|saturday|sunday|monday|tuesday|wednesday|thursday|friday|game|match|hike|race)/.test(t))
    out.intents.push({ type: 'activity.add', args: {} })

  if (!out.intents.length) return { ...out, unknown: true }
  // Asking about history and changing the plan in one breath: keep both,
  // read-only first. Two plan changes of the same kind are a conflict.
  const kinds = out.intents.map((i) => i.type)
  if (kinds.filter((k) => k === 'plan.place').length > 1) return { ...out, clarify: { question: 'Which place?', options: places.map((p) => ({ type: 'plan.place', args: { location: p.id } })) } }
  return out
}
