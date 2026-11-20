// Scores the local parser on the labeled set in tests/fixtures/assistant-eval.json.
import { readFileSync } from 'node:fs'
import { parseRequest, INTENTS } from '../../src/lib/assistant/parse.js'

export const EVAL_CONTEXT = {
  today: '2026-11-05',
  places: [
    { id: 'gym', name: 'Gym' },
    { id: 'home', name: 'Home' },
    { id: 'on-the-go', name: 'On the go' },
    { id: 'place-hotel', name: 'Hotel' },
  ],
  planIds: ['lunge', 'push-up', 'goblet-squat', 'db-row'],
  workoutIds: [],
  historyIds: ['back-squat', 'goblet-squat', 'bench-press', 'deadlift', 'biceps-curl', 'db-hammer-curl', 'push-up'],
  custom: [],
}
const MUTATING = new Set(['plan.minutes', 'plan.place', 'exercise.replace'])

export function evaluateParser(cases = JSON.parse(readFileSync(new URL('../fixtures/assistant-eval.json', import.meta.url)))) {
  const rows = cases.map((c) => {
    const r = parseRequest(c.text, EVAL_CONTEXT)
    const types = r.intents.map((i) => i.type)
    const arg = (type, key) => r.intents.find((i) => i.type === type)?.args[key]
    const history = r.intents.find((i) => i.type === 'history.show')?.args
    let correct
    if (c.safe) {
      // Malicious text may at most produce an ordinary, previewed intent.
      correct = types.every((t) => INTENTS.includes(t)) && r.scope === 'temporary'
    } else if (c.unknown) correct = Boolean(r.unknown)
    else if (c.clarify) correct = Boolean(r.clarify)
    else {
      correct =
        !r.clarify &&
        JSON.stringify([...types].sort()) === JSON.stringify([...c.intents].sort()) &&
        (c.minutes === undefined || arg('plan.minutes', 'minutes') === c.minutes) &&
        (c.location === undefined || arg('plan.place', 'location') === c.location) &&
        (c.exId === undefined || [arg('exercise.replace', 'exId'), arg('exercise.progress', 'exId')].includes(c.exId)) &&
        (c.filter === undefined || history?.filter === c.filter) &&
        (c.days === undefined || (history && Math.round((Date.parse(history.to) - Date.parse(history.from)) / 86400000) + 1 === c.days)) &&
        (c.scope === undefined || r.scope === c.scope)
    }
    return { ...c, correct, unknown: Boolean(r.unknown), clarified: Boolean(r.clarify), types, mutating: types.some((t) => MUTATING.has(t)) }
  })
  const by = (g) => rows.filter((r) => r.group === g)
  const rate = (list) => (list.length ? +(list.filter((r) => r.correct).length / list.length).toFixed(3) : null)
  const groups = [...new Set(rows.map((r) => r.group))]
  return {
    cases: rows.length,
    accuracy: rate(rows),
    byGroup: Object.fromEntries(groups.map((g) => [g, { cases: by(g).length, accuracy: rate(by(g)) }])),
    // Requests the parser handled without needing any remote interpretation.
    deterministicHitRate: +(rows.filter((r) => !r.unknown).length / rows.length).toFixed(3),
    clarificationRate: +(rows.filter((r) => r.clarified).length / rows.length).toFixed(3),
    // Malicious text can at most become an ordinary temporary preview; nothing applies without Apply.
    maliciousPreviews: rows.filter((r) => r.group === 'malicious' && r.mutating).map((r) => r.text),
    failures: rows.filter((r) => !r.correct).map((r) => ({ text: r.text, got: r.types, clarified: r.clarified, unknown: r.unknown })),
  }
}
