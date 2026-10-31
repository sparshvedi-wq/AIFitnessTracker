# Sport schedules and on-the-go training

Implemented October 27, 2026 in `N:\Workspaces\AIFitnessTracker-ink-design`, shared by browser and Expo Go.

## Where to find it

- **Train → Sport schedule** opens a dedicated schedule sheet. It is also available in **You → Make training fit**, and optionally on the sport step of onboarding.
- **You → Make training fit → On-the-go space and movement** saves defaults.
- **Plan my session → On the go → Space and movement** changes today's setup. These choices stay temporary unless you explicitly save today's setup in Session options.
- Warmups also offer location and movement preferences. Their temporary changes do not overwrite saved defaults.

## Sport events

Choose a sport, practice or competition, weekly days or a single date, local start time, duration and expected effort. Weekly events start on the date they are added. One occurrence can be skipped without removing the weekly schedule; edit the event to restore skipped dates. Events can be edited or removed before saving the schedule.

The planner looks ahead 48 hours and back 24 hours:

- Normal practices within 24 hours, and hard practices or competitions within 48 hours, make training lighter. Events marked easy do not trigger this reduction.
- A recent hard practice or non-easy competition keeps the following 24 hours lighter.
- The affected sport's muscle groups receive less priority and at most one recommended set per exercise. Other groups get at most two. Suggested loads and reps are reduced; automatic overload does not counteract those reductions.
- Saved routines receive a session copy with the same reductions. The original routine is unchanged. Added exercises and replacements start with lighter targets during that prepared session too.
- A sport event overlapping the requested session time is explained before preparation. This is advice, not a deadline or a forced timer.
- The upcoming sport is selected for the warmup shortcut. The last-used sport remains available and ordered prominently.

These are transparent planning heuristics based on a saved schedule, not measured recovery, verified attendance or an injury-prevention guarantee. Update or skip an event if plans change. Daily pain, soreness and energy feedback still apply. No make-up training debt is added.

## Movement preferences

On-the-go sessions use bodyweight. Options are small space or room to move; any position, standing only or seated only; no floor exercises; no jumping; and wall availability. They affect daily plans, routine adaptation, exercise replacements, added-exercise choices and sport warmups. Unknown custom exercises are excluded from automatic restricted recommendations because their space and movement requirements are not known.

Seven light movement exercises provide seated and standing alternatives, with specific instructions and form-guide content. Six stationary sport rehearsals retain useful sport preparation without jumps or travel. Some drills must be omitted or replaced; the app explicitly explains that an adapted warmup does not rehearse every sport movement. It does not promise equivalent stimulus when equipment or movement is limited.

Seated bodyweight sessions are saved as light movement, separately from strength-day goals, strength bests and the Tally score. A seated sport warmup stays a sport warmup. Sessions still wait for the user's explicit Start action.

## Data and cost

Events and preferences use the existing local app save and JSON backup. They do not require calendar access, an account, an AI call or additional API spend. Browser and Expo retain their existing separate stores. There are no push reminders, calendar sync or multi-device schedule sync in this change.

## Verification

Automated coverage includes recurrence, single dates, cancellation, invalid events, midnight overlap, multiple sports, lighter daily/routine targets, immutable authored routines, restricted plan and replacement choices, all 15 sports at four durations and three position preferences, and old-save defaults.

Browser checks use a fictional profile on a separate loopback origin, including onboarding, edited time/date inputs, one skipped practice, a one-off competition, persistence after reload, temporary seated choices, stationary tennis warmups, narrow phone layouts and an explicit prepared state. No personal photos or paid analysis calls are used. This is responsive browser verification, not physical iPhone verification.

All 57 root tests, production build, Expo typecheck and lint passed. The supplemental web undefined-name check passed with one existing unused-directive warning in WorkoutHost. No new dependencies were required.

## Suggested next polish, not implemented here

1. Finish the exercise guide presentation with one consistent illustration or animation style, setup instructions and an easy/harder alternative. Avoid empty video placeholders.
2. Add a compact, optional week view combining sport, training and check-in dates. Keep today's action primary; do not create another wall of dashboard cards.
3. Give loading, empty, saving, offline and retry states the same level of attention as populated screens. Confirm when a session is saved and explain exactly what needs a connection.
4. Replace generic success numbers with a short weekly recap of actual logged progress and upcoming adjustments. Avoid implying photos measure strength or fatigue.
5. Audit every screen against a shared spacing, type, button and sheet system. Maintain a clear primary action and readable contrast; use motion only to explain a state change.
