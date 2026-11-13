// Short, factual explanations rendered from reason codes and decision facts.
//
// Copy only states what the engine actually knows: completed work, answers
// the person gave, settings and dates. It never claims soreness, recovery,
// dislike or progress that was not recorded or reported, and never promises
// that missed work will roll over.
import { findExercise } from '../exercises.js'

const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1)
const GROUP = {
  push: 'pressing',
  pull: 'pulling',
  lower: 'leg',
  arms: 'arm',
  core: 'core',
}
const GROUP_PLURAL = {
  push: 'pressing movements',
  pull: 'pulling movements',
  lower: 'lower body',
  arms: 'arms',
  core: 'core work',
}

/** Headline candidates in priority order; the first that applies is shown. */
export function headline(decision) {
  const f = decision.facts
  if (f.mode === 'movement')
    return { code: 'movement-day', text: 'Gentle movement today. Rest is a good option too.' }
  if (!f.items)
    return {
      code: 'nothing-fits',
      text: 'Nothing fits what you’re avoiding today. Take a break.',
    }
  if (f.returning) return { code: 'returning', text: 'A lighter restart. Build back at your own pace.' }
  if (f.mode === 'lighter') return { code: 'lighter-day', text: 'A lighter session, with room to recover.' }
  if (f.rolloverExercise)
    return {
      code: 'rollover',
      text: `${f.rolloverExercise} is back: you missed it last time.`,
    }
  if (f.recentGroup && f.planGroup && f.recentGroup !== f.planGroup && f.recentWhen)
    return {
      code: 'rotate-emphasis',
      text: `More ${GROUP_PLURAL[f.planGroup]}, after ${GROUP[f.recentGroup]} work ${f.recentWhen}.`,
    }
  if (f.preferredExercise)
    return {
      code: 'learned-preference',
      text: `${f.preferredExercise} is back: you preferred it last time.`,
    }
  if (f.short) return { code: 'short', text: 'A shorter session today. Nothing to make up later.' }
  return null
}

/** The few factual lines shown under “Why this session?”. */
export function reasonLines(decision) {
  const f = decision.facts
  const lines = []
  if (f.scheduleNote) lines.push(f.scheduleNote)
  if (f.movementSummary) lines.push(f.movementSummary)
  if (f.seated) lines.push('Seated moves on a stable chair.')
  if (f.returning) lines.push(`Last strength session ${f.awayDays} days ago, so a lighter restart.`)
  if (f.quiet) lines.push('Quiet: no jumps or impact.')
  // A plan well short of the time asked for says so, rather than claiming to fill it.
  const brief =
    f.mode === 'normal' && !f.short && f.estimatedMinutes > 0 && f.estimatedMinutes <= f.minutes * 0.7
  lines.push(
    brief
      ? f.recentAreas?.length >= 3
        ? `About ${f.estimatedMinutes} of your ${f.minutes} minutes: most areas were trained in the last few days.`
        : `About ${f.estimatedMinutes} of your ${f.minutes} minutes is useful today.`
      : `Fits ${f.minutes} minutes, with time to ease in and rest.`,
  )
  if (f.short) lines.push('A short option. Nothing to make up later.')
  lines.push(
    f.goal === 'Sport performance'
      ? 'Sport preparation with balanced strength work.'
      : `${f.goal}, sized for ${lower(f.experience)}.`,
  )
  if (f.sportsLine) lines.push(f.sportsLine)
  if (f.focusSource)
    lines.push(
      f.focusSource === 'manual'
        ? 'Your chosen focus gets priority.'
        : 'A small photo-based emphasis, reviewed with your next check-in.',
    )
  if (f.weakAreas?.length)
    lines.push(`A little extra ${f.weakAreas.join(' and ').toLowerCase()} work: it’s behind your other lifts.`)
  if (f.sore?.length) lines.push(`Resting ${f.sore.join(', ').toLowerCase()}.`)
  if (f.pain?.length) lines.push(`Avoiding ${f.pain.join(', ').toLowerCase()}. Stop if anything hurts.`)
  if (f.recentAreas?.length)
    lines.push(`Recent work in ${f.recentAreas.join(', ').toLowerCase()} counts toward today’s balance.`)
  if (f.tough)
    lines.push(
      f.toughRested
        ? 'Your last session felt very hard, so those muscles get a break today.'
        : 'Your last session felt very hard, so work for the same muscles is lighter.',
    )
  if (f.unwell) lines.push('You said you’re not feeling well, so nothing strenuous is planned.')
  if (f.recentUnwell && !f.unwell)
    lines.push('You stopped last time because you weren’t feeling well, so this starts lighter.')
  if (f.sportSoon) lines.push('Light, with sport coming up.')
  if (f.flagged) lines.push('Moves you skipped for pain or soreness stay out for now.')
  if (f.bodyweightOnly) lines.push('Bodyweight only.')
  if (f.rolloverExercise)
    lines.push('Unfinished work is reconsidered, not owed. It drops out after a few days.')
  if (f.learnedLine) lines.push(f.learnedLine)
  if (f.exploring) lines.push(`${f.exploring} is new for you; you can swap it any time.`)
  return lines
}

/** A short note for one planned item (shown in the exercise details). */
export function itemNote(entry, ctx) {
  const parts = []
  const codes = entry.codes
  if (codes.includes('rollover')) parts.push('You didn’t get to this last time.')
  else if (codes.includes('learned-preference')) parts.push('You’ve chosen this one before.')
  else if (codes.includes('focus'))
    parts.push(ctx.focusSource === 'manual' ? 'Your chosen focus.' : 'Your photo focus.')
  else if (codes.includes('sport')) parts.push('Supports your sport.')
  else if (codes.includes('need')) parts.push(`Balances your ${entry.areaLabel} training.`)
  else parts.push(`Balances your ${entry.areaLabel} training.`)
  if (codes.includes('exploring')) parts.push('New for you; swap it if it doesn’t suit.')
  if (ctx.returning) parts.push('Lighter restart; adjust to how you feel.')
  if (ctx.quiet) parts.push('Quiet: no jumping.')
  if (entry.unilateral) parts.push('Reps per side; weaker side first.')
  if (entry.exId === 'biceps-curl') parts.push('One dumbbell at a time.')
  if (entry.progression?.code === 'more-reps-before-jump') parts.push('One more rep before the next weight.')
  if (entry.progression?.code === 'next-size-missing')
    parts.push('Your next dumbbell size isn’t listed here.')
  if (entry.progression?.code === 'fitted-to-available')
    parts.push('The dumbbells here are lighter than last time; aim for clean reps.')
  if (entry.progression?.code === 'missed-twice') parts.push('A little lighter after two tough sessions.')
  if (entry.progression?.code === 'less-assistance') parts.push('A little less assistance than last time.')
  // From the strength model (src/lib/strength).
  const pr = entry.progression || {}
  const flags = pr.flags || []
  if (codes.includes('harder-version'))
    parts.push(
      entry.harderThan
        ? `A harder version: you’ve outgrown ${entry.harderThan.toLowerCase()}.`
        : 'A harder version of something you’ve outgrown.',
    )
  else if (codes.includes('step-up'))
    parts.push('A small step up from your level: start light and focus on form.')
  if (pr.code === 'deload') parts.push('A lighter session to reset after some tough ones.')
  if (pr.offer) parts.push('Ready to test the next weight: you decide when you get there.')
  if (pr.code === 'estimated-start')
    parts.push(
      pr.facts?.source
        ? `A careful first guess from your ${pr.facts.source.toLowerCase()}.`
        : 'A careful first guess from a similar exercise.',
    )
  else if (flags.includes('outgrown'))
    parts.push(
      entry.weighted
        ? 'You’ve outgrown the weights here; add weight if you can.'
        : 'This is getting easy; a harder version is next.',
    )
  else if (flags.includes('lightest-is-heavy') || (flags.includes('below-range') && !entry.weighted))
    parts.push('Hard for now: do the reps you can, with good form.')
  else if (pr.code === 'load-up') parts.push('Up a step: you’re ready for it.')
  else if (pr.code === 'load-down') parts.push('A little lighter, based on your last sets.')
  else if (flags.includes('more-reps-before-jump')) parts.push('A few more reps before the next weight up.')
  else if ((pr.facts?.readiness ?? 1) < 0.95)
    parts.push('Slightly lighter: these muscles are still recovering.')
  if (entry.side) parts.push(`Last set: one extra ${entry.side}-side rep if it feels fine.`)
  return parts.join(' ')
}

export const exerciseName = (id, custom) => findExercise(id, custom)?.name || id
