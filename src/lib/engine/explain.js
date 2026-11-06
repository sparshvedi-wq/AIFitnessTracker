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
const GROUP_PLURAL = { push: 'pressing movements', pull: 'pulling movements', lower: 'lower body', arms: 'arms', core: 'core work' }

/** Headline candidates in priority order; the first that applies is shown. */
export function headline(decision) {
  const f = decision.facts
  if (f.mode === 'movement') return { code: 'movement-day', text: 'Gentle movement today. Rest is a good option too.' }
  if (!f.items) return { code: 'nothing-fits', text: 'Nothing fits what you’re avoiding today, so a break is the sensible choice.' }
  if (f.returning) return { code: 'returning', text: 'A lighter restart. Build back at your own pace.' }
  if (f.mode === 'lighter')
    return { code: 'lighter-day', text: 'A lighter session today, with balanced work and room to recover.' }
  if (f.rolloverExercise)
    return {
      code: 'rollover',
      text: `You didn’t get to ${lower(f.rolloverExercise)} last time, so it’s back today.`,
    }
  if (f.recentGroup && f.planGroup && f.recentGroup !== f.planGroup && f.recentWhen)
    return {
      code: 'rotate-emphasis',
      text: `You finished your ${GROUP[f.recentGroup]} work ${f.recentWhen}. Today gives ${GROUP_PLURAL[f.planGroup]} more attention.`,
    }
  if (f.preferredExercise)
    return {
      code: 'learned-preference',
      text: `You preferred ${lower(f.preferredExercise)} last time, so it’s back today.`,
    }
  if (f.short) return { code: 'short', text: 'A shorter session today, with the remaining work reassessed next time.' }
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
  lines.push(`Fits ${f.minutes} minutes, with time to ease in and rest.`)
  if (f.short) lines.push('A short option. Nothing to make up later.')
  lines.push(
    f.goal === 'Sport performance'
      ? 'Sport preparation with balanced strength work.'
      : `${f.goal}, sized for ${lower(f.experience)}.`,
  )
  if (f.sportsLine) lines.push(f.sportsLine)
  if (f.focusSource) lines.push(f.focusSource === 'manual' ? 'Your chosen focus gets priority.' : 'Your photo focus gets priority.')
  if (f.sore?.length) lines.push(`Resting ${f.sore.join(', ').toLowerCase()}.`)
  if (f.pain?.length) lines.push(`Avoiding ${f.pain.join(', ').toLowerCase()}. Stop if anything hurts.`)
  if (f.recentAreas?.length)
    lines.push(`Recent work in ${f.recentAreas.join(', ').toLowerCase()} counts toward today’s balance.`)
  if (f.tough) lines.push('Last session felt very hard, so this one is lighter.')
  if (f.unwell) lines.push('You said you’re not feeling well, so nothing strenuous is planned.')
  if (f.recentUnwell && !f.unwell) lines.push('You stopped last time because you weren’t feeling well, so this starts lighter.')
  if (f.sportSoon) lines.push('Light, with sport coming up.')
  if (f.flagged) lines.push('Moves you skipped for pain or soreness stay out for now.')
  if (f.bodyweightOnly) lines.push('Bodyweight only.')
  if (f.rolloverExercise) lines.push('Unfinished work is reconsidered, not owed. It drops out after a few days.')
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
  else if (codes.includes('focus')) parts.push(ctx.focusSource === 'manual' ? 'Your chosen focus.' : 'Your photo focus.')
  else if (codes.includes('sport')) parts.push('Supports your sport.')
  else if (codes.includes('need')) parts.push(`Balances your ${entry.areaLabel} training.`)
  else parts.push(`Balances your ${entry.areaLabel} training.`)
  if (codes.includes('exploring')) parts.push('New for you; swap it if it doesn’t suit.')
  if (ctx.returning) parts.push('Lighter restart; adjust to how you feel.')
  if (ctx.quiet) parts.push('Quiet: no jumping.')
  if (entry.unilateral) parts.push('Reps per side; weaker side first.')
  if (entry.exId === 'biceps-curl') parts.push('One dumbbell at a time.')
  if (entry.progression?.code === 'more-reps-before-jump') parts.push('One more rep before the next weight.')
  if (entry.progression?.code === 'next-size-missing') parts.push('Your next dumbbell size isn’t listed here.')
  if (entry.progression?.code === 'fitted-to-available')
    parts.push('The dumbbells here are lighter than last time; aim for clean reps.')
  if (entry.progression?.code === 'missed-twice') parts.push('A little lighter after two tough sessions.')
  if (entry.progression?.code === 'less-assistance') parts.push('A little less assistance than last time.')
  if (entry.side) parts.push(`Last set: one extra ${entry.side}-side rep if it feels fine.`)
  return parts.join(' ')
}

export const exerciseName = (id, custom) => findExercise(id, custom)?.name || id
