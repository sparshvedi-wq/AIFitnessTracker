# Daily recommendation engine (daily-4.1, strength-3)

Loop: recommend → train → record what happened → selectively ask → update preferences → reassess.
All planning, accounting, constraints and learning are deterministic code in `src/lib/engine/`.
Numbers live in `engine/config.js` with rule versions (`RULES`). They are planning heuristics, not
measurements of recovery, fatigue or physiology.

## Modules
| Module | Role |
|---|---|
| `catalog/` | 255 exercises (88 original + 167 imported) with explicit metadata; `import-manifest.js` maps all 200 FRAME records; `migrations.js` renames colliding custom IDs idempotently |
| `engine/ledger.js` | Per-exercise outcome of a saved session: complete / partial / not reached / skipped, warm-ups, stated reason (missing = `unknown`). Stored as `record.outcome`; old or malformed records reconstructed conservatively. History corrections rebuild completion evidence; backdated logs affect their chosen date |
| `engine/exposure.js` | Decayed (36 h muscle, 48 h pattern, 24 h exercise) and 7-day exposure by muscle, area, pattern, family, joint action, exercise. Primary 1, secondary 0.5, stabiliser 0.15 per set |
| `engine/rollover.js` | Unfinished work as optional candidates (time 1, unknown 0.5, equipment-elsewhere 0.5; discomfort/soreness/unwell/dislike never). An offer is not completion: priority halves with each saved offer, closes after two offers, declines or sufficient comparable work (75% of missing dose), halves with age every 2 days, expires at 7. Partial equivalent sets reduce the remainder. Carried variants retain the original root rather than creating new debt; ≤2 per plan |
| `engine/learning.js` | Separate signals: enjoyment, comfort, difficulty, setup (per place), acceptance, skip reasons. Explicit answers vs inferred skips/swaps; one skip is weak; reset and retry events make everything reversible; dismissals carry no evidence |
| `engine/feedback.js` | ≤1 optional question per saved session, value-ranked (retry 0.95, unfamiliar variation 0.7, repeated unknown skips 0.8, conflict 0.75, new exercise 0.45, load change 0.45); 21-day repeat cooldown; interruption cost grows with recent questions; pause after 3 dismissals |
| `engine/eligibility.js` | Hard rules (never traded against benefit): equipment AND/OR capabilities, supports, space/position, quiet, experience, explicit exclusions, avoided/sore/flagged areas, reported discomfort, explicit dislike, remembered swaps. Unknown metadata = not eligible |
| `engine/scoring.js` | Normalized features: goal, need, focus, sport, rollover, preference, comfort, progression, familiarity, staple, setup, place affinity, muscle overlap, similar/pattern/exact/same-day repeat, practice |
| `engine/select.js` | Beam search (width 24, pool 40) over subsets: score + need coverage − in-session overlap − equipment changes, under pattern/family/area/time/exploration limits; greedy baseline kept |
| `engine/dose.js` | Minimum rests by role; sets added by marginal value per second. Weights and reps come from the strength model below (`strength/`); `progression.js` remains for timed work and as a fallback |
| `strength/` | The adaptive strength model: exercise library, shared fatigue/recovery, a strength graph tying every exercise together, weight and rep prescription, and the live-workout layer (see **Strength model**) |
| `engine/replan.js` | Mid-workout changes keep every logged set; fingerprints include targets, rest and side-work edits; double apply is a no-op; stale previews are refused. Current session start/pause/rest timing survives previews. Replaced timed exercises wait for Start |
| `engine/explain.js` | Reason codes → one factual headline + short reasons; full trace with `explainDailyPlan(state, { trace: true })` |
| `assistant/` + `components/AskAdjust.jsx` | Local parser, results from real data, previews with Apply/Undo |
| `server/src/assistant.ts` | Optional gpt-6-luna interpreter (off unless `ASSIST_AI_ENABLED=true` and the client build sets `VITE_ASSIST_AI=on`) |

## Strength model (`src/lib/strength/`, strength-3)

Weights and reps are planned by one model of a person's strength shared by every exercise, so what is learned on one lift informs every related lift.

| Module | Role |
|---|---|
| `library.js` | Every exercise's profile: share of the work per muscle (from the catalog, refined per exercise from EMG and coaching evidence), how a logged number becomes the load actually moved (`ext × logged + bw × bodyweight`), and a reference lift with a ratio and its uncertainty. 207 strength exercises; 155 tied together. Similarity (muscles, joint actions, pattern, equipment) lists related exercises |
| `recovery.js` | Per-muscle fatigue from every set, scaled by involvement and closeness to failure: acute (fades within the hour: set-to-set and exercise-to-exercise, e.g. triceps work before bench) and residual (fades over days at each muscle's own half-life, 16–32 h). An exercise's available strength blends the average fatigue of its muscles with its most tired important muscle |
| `graph.js` | One Kalman filter over: muscle strengths θ (correlated through a general and a regional factor), per-region improvement rates, today's form (shared by every exercise in a session), each exercise's own offset δ, a per-place offset for machines and cables, and per-exercise rep endurance κ. Sessions are combined per exercise; one-sided evidence ("did the reps", "too heavy") corrects only when contradicted; deliberate taps are never treated as typos; typo screening; trained muscles improve with stimulus, untrained ones detrain after 10 days; new exercises learn fast (skill), exercises that keep beating predictions speed up; stalls (two tough sessions, no gain) trigger one lighter reset. Rebuilt from history (edits correct it) and extended incrementally when a workout is saved (exactly equal to a rebuild) |
| `prescribe.js` | Works backwards from the estimate to a loadable weight and reps in effective-load terms (bars, per-hand dumbbells with bodyweight, assistance). Double progression with hysteresis, caution only on increases, jump limits on total and on added weight, a floor at what was just done comfortably, rep-range and reps-in-reserve targets by goal and experience, lighter days, bodyweight rep progression |
| `session.js` | In a workout: one-tap "how did it feel" (and "how many more?" after Easy), "I couldn't do this" (too heavy / some reps / hurt / swap / type), typed numbers never overwritten, "set my working weight" (anchor) and "start over"; remaining sets and upcoming related exercises are re-planned from today's form and fatigue |
| `index.js` | `strengthTarget`, `strengthSummary`, `todayReadiness`, `exerciseReadiness`, `experienceSuggestion`; caching; any internal error falls back to the simple rules (never a broken plan) |

Planning also uses the model: a `fit` feature (outgrown, too hard even at the lightest option) and a `fatigue` feature (muscles still recovering, counted only beyond what recent overlap already penalises), and a coverage step-up (one level up, gentlest equipment first) when a main movement has nothing at someone's level.

**Everything that plans weights uses the same model and context.** Daily plans, saved routines (with this place, today's bodyweight, lighter-day signals, held loads and past activities, and a preview that shows the weights the workout will start with), mid-workout swaps and place changes (after today's sets), short focus sessions (easy, several reps left) and the "Next time" note after saving (the model a few days on, with the saved workout counted) all ask `strengthTarget`. Simple scaling rules (lighter days, warm-ups) always snap to weights the equipment can hold (`snapLoad`).

**Answers fade into evidence.** "Harder than expected" holds a load for the next session only; a discomfort report that isn't a restriction settles after a "Good" answer or two complete sessions (the report itself is kept). Explicit "too heavy" and "N or more left" answers are limits: exact in the workout and, once saved, within a normal day-to-day difference. After "5 or more left" a step up is judged on the best estimate and may be any weight inside the rep range.

**Lighter where it matters.** A session reported as very hard asks less of the muscles it worked for three days (lighter loads and a preference for other areas), not the whole body. A match, competition or hard activity nearby lightens the whole session; a normal practice or activity lightens only its muscles. Sport and activities that already happened add fatigue to their muscles in the recovery model (`sport-schedule.js pastActivityLoad`, `recovery.js withActivityFatigue`). Short focus sessions add fatigue but are not strength evidence.

**Weekly balance and focus use the library's shares.** Each set counts toward the muscles and areas it trains by their share (a bench press set: chest in full, triceps and shoulders in part); a set tapped "easy" with reps to spare counts for less. A compound lift gets credit for the helper areas it trains. Photo and chosen focus areas count any exercise that works the area at least half as hard as its prime mover (a close-grip bench counts for the arms). Photo focus still never changes loads.

**Session length learns.** Sets are saved with the time they were logged. `engine/pace.js` compares the gaps between sets with the estimator's expectation over recent sessions (breaks over 15 min ignored, at least three sessions, pulled toward 1, within 0.8–1.5) and scales the time budget, so "30 minutes" keeps meaning about 30 minutes for each person. Recovery uses the real set times.

**Harder versions.** A bodyweight or timed exercise this person has done that is outgrown (top of its reps, a held 90 s hold) makes harder members of its family more attractive, named in the plan ("A harder version: you've outgrown plank"); if none is open at the person's level, the gentlest harder one a level up is allowed as a step up. Timed holds progress from last time's target, not the plan's default.

**What the main numbers rest on.** Push-ups move about 64% of bodyweight, 49% on the knees, 41–55% hands raised and 70–74% feet raised ([Ebben et al. 2011, summarised](https://www.strengthlog.com/how-much-of-your-bodyweight-do-you-lift-in-a-push-up/)); a dumbbell bench press is about 80% of a barbell bench in total, ~40% per hand ([Arkansas State thesis](https://arch.astate.edu/all-etd/866)); incline ≈ 78% of flat, front squat ≈ 85% of back squat, overhead press ≈ ⅔ of bench ([Lift Vault](https://liftvault.com/resources/strength-ratio-calculator/), [Fitnessvolt](https://fitnessvolt.com/strength-standards/compare/bench-press-vs-incline-bench-press)); a pull-up's whole-body max is about 1.25 × a lat pulldown's ([Johnson et al. 2009](https://read.qxmd.com/read/19387371/relationship-of-lat-pull-repetitions-and-pull-ups-to-maximal-lat-pull-and-pull-up-strength-in-men-and-women)); a squat or deadlift moves about 77% of bodyweight as load ([ExRx](https://www.exrx.net/WeightTraining/Bodyweight.html)); bench pressing loads the chest most, then triceps and front delts, and steep inclines shift work to the front delts ([PMC7579505](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7579505/)); training to failure slows recovery by 24–48 h ([Morán-Navarro 2017](https://pubmed.ncbi.nlm.nih.gov/28965198/)); triceps work before bench reduces bench reps ([Soares et al. 2016](https://www.jssm.org/jssm-15-111.xml-abst)). These are planning estimates; each person's own ratios, endurance and recovery are learned from their sets.

**Evaluation** (`tests/strength-graph.test.mjs`, `tests/strength-model.test.mjs`). Simulated lifters with hidden per-muscle strengths, exercise quirks and rep curves, trained through the real live-workout flow for 30 sessions with a rotating pool of 20 exercises: 2.9% of sets short of the plan, 4.4% of first tries short, mean |reps in reserve − target| 1.4 over 2,270 planned sets. `tests/algorithm-holes.test.mjs` covers the cross-feature rules above. Hostile-history fuzzing (thousands of seeds: typos, NaN, missing fields, mixed units, attempts, anchors): no internal fallbacks, every weight loadable, jumps within limits, results independent of record order. Incremental updates match full rebuilds exactly; a 300-session history builds in ~0.3 s and each saved workout extends it in ~1 ms.

**Known limits.** Machine weights differ between brands, so a never-used machine asks for a weight (with suggestions) unless a close relative is known; band resistance is unknown, so band exercises keep their own reps-only model; timed holds keep simple +5 s rules (with a harder version once a 90 s hold is reached); bodyweight is taken from logged weights or assumed (~75 kg) with extra uncertainty.

## Provisional photo priorities

Photo appearance is not evidence of strength, muscle mass or a side that needs extra reps.
Previously approved adult photo priorities start at one quarter of the selection/scoring
priority of an explicit manual preference and a 5% increase to the internal area target.
A later review recommending the same area at least seven calendar days later can raise
those values to 0.4 and 10%, respectively; repeated uploads never escalate beyond that.
These are bounded planning heuristics, not confidence estimates or guaranteed extra sets.
Time limits, normal set caps, discomfort exclusions and recovery rules still apply.

Only one review per calendar day counts. A newer usable review that no longer supports
an approved area retires its photo emphasis; new areas still need approval. A contradictory
review breaks the follow-up chain. Photo emphasis pauses on lighter/recovery days and for
sore or painful areas, fades after 14 days without a fresh supported check-in, and expires
at 42 days. Sample, future, malformed and unusable reviews cannot reinforce it. Old approved
saves without review details receive only the initial weight. No visual cue modifies loads
or enables extra work on one side. The decision record retains the dated evidence used.

## Exploration decision
Evaluated greedy (posterior mean), UCB, epsilon-greedy and Thompson sampling on 48 simulated people × 28 days
(`node scripts/engine-evaluation.mjs`). The sampling policies added variety but also more 24 h repeats and did not
show a consistent benefit (epsilon found 162 liked recommendations versus 159, with 69 versus 54 exact repeats), so the simpler mean policy is the default. Novelty is still bounded per session by the
variety setting (familiar 0 / balanced 1 / more 2) and only counts within families that have a familiar, available member.

## Acceptance criteria and results (docs/evaluations/engine-evaluation.json)
| Criterion | Target | Result |
|---|---|---|
| Hard-constraint violations (1,000 generated plans) | 0 | 0 |
| Plans over the time estimate | 0 | 0 |
| Uncomfortable exercise recommended again without retry | 0 | 0 (legacy 27) |
| Exercise skipped twice as disliked recommended again | ≤ 50 % of legacy | 0 (legacy 47) |
| Missed work reconsidered next session | ≥ 70 % | 86.2 %: 480/557 opportunities (legacy 68 %) |
| Sets per item after a short day (no debt) | ≤ normal cap 3 | 3 |
| Questions per session | ≤ 0.5 | 0.27 |
| Exact repeat exercise items within 24 h | Monitor with constrained equipment | 54/3,204 planned items, 1.7 % (legacy 0 via a blanket muscle ban) |
| Beam ≥ greedy objective | ≥ 95 % | 99.7 % (197 better, 189 equal, 1 worse; a minimum-item constraint can prefer a larger set) |
| Worst individual's p95 plan time | ≤ 100 ms | 62 ms in this run; affected by concurrent local checks |
Simulated behaviour is not evidence of fitness outcomes. Frequently recommended exercises accumulate more
observations (selection bias); decision records store strategy and exploration flags for later correction.

### Catalog-controlled comparison

The whole-system comparison changes both candidate coverage and policy. A third run restricts the new engine to the old planner's strength IDs; simulated answers and later histories still diverge with the recommendations, so this is a diagnostic rather than a causal study.

| Synthetic measure | Old planner | New engine, old candidate IDs | New engine, expanded catalog |
|---|---:|---:|---:|
| Missed-family reconsideration | 68.0% | 86.8% | 86.2% |
| Previously uncomfortable exercise recommended again | 27 | 0 | 0 |
| Exercise recommended after two dislike skips | 47 | 21 | 0 |
| Exact repeated exercise items within 24h | 0 | 95 | 54 |
| Distinct exercises per person | 10.3 | 10.7 | 13.7 |

Broader coverage helps find alternatives. Repeated inferred dislike skips are weaker evidence than an explicit “Rather not”; the explicit answer excludes the exercise until reset. The test does not establish injury prevention, physiological accuracy or user retention.

## Language evaluation
Labeled set (built with the parser): 100 % on 70 cases. Held-out set (not tuned): 96 % (24/25; the miss asks a
clarifying question). Common commands make no remote call. Remote replies are revalidated; unknown names become clarifications.

## Known limits
- Exposure contributions, capacities and weekly targets are heuristics; no fatigue or recovery is measured.
- A mid-workout place change records one location for the whole workout.
- 24 h exact repeats remain for people with very few eligible exercises (e.g. bodyweight only).
- Imported exercises have written guides only (no illustrations); 88 originals keep their mannequin guides.
- Luna cost/latency are instrumented (`createAssistService().report()`) but not measured with real traffic; no paid calls were made.
- Verified in a phone-sized browser viewport only, not on a physical iPhone.

## Reproduce
`npm test` · `npm --prefix server test` · `npm run lint` · `npm run typecheck` · `npm run build` ·
`node scripts/engine-evaluation.mjs` · `ENGINE_SCENARIOS=1500 node --test tests/engine-properties.test.mjs` ·
`node scripts/catalog-report.mjs` · `npm run dev` then manually verify the UI at a phone-sized viewport.

See [ENGINE_COMPLETION_REVIEW.md](ENGINE_COMPLETION_REVIEW.md) for the integration fixes and final verification, and [EXERCISE_CATALOG_IMPORT.md](EXERCISE_CATALOG_IMPORT.md) for every source-to-canonical mapping.
