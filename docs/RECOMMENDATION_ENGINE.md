# Daily recommendation engine (daily-4.3, strength-5)

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
| `engine/select.js` | Beam search (width 24, pool 40) over subsets: score + need coverage − in-session overlap − equipment changes, under pattern/family/area/time/exploration limits; greedy baseline kept. Up to 6 exercises below an hour, 7 from 60 minutes, 8 from 75. When the strong picks leave a requested session short (the week's targets are met, or the few that remain clash), it is filled in steps: candidates scoring ≥ 0.5 to one short of full, ≥ 0 to two thirds, with a second move of one pattern allowed (never of one family). Negative scores are never filler, and lighter days are never filled |
| `engine/dose.js` | Minimum rests by role; sets added by marginal value per second. In a long session (from 60 minutes; from 40 for someone starting out, after their first three sessions) time still unused at the usual cap buys one more set on compound, accessory and isolation work. Weights and reps come from the strength model below (`strength/`); `progression.js` remains for timed work and as a fallback |
| `strength/` | The adaptive strength model: exercise library, shared fatigue/recovery, a strength graph tying every exercise together, weight and rep prescription, and the live-workout layer (see **Strength model**) |
| `engine/replan.js` | Mid-workout changes keep every logged set; fingerprints include targets, rest and side-work edits; double apply is a no-op; stale previews are refused. Current session start/pause/rest timing survives previews. Replaced timed exercises wait for Start |
| `engine/explain.js` | Reason codes → one factual headline + short reasons; full trace with `explainDailyPlan(state, { trace: true })` |
| `assistant/` + `components/AskAdjust.jsx` | Local parser, results from real data, previews with Apply/Undo |
| `server/src/assistant.ts` | Optional gpt-6-luna interpreter (off unless `ASSIST_AI_ENABLED=true` and the client build sets `VITE_ASSIST_AI=on`) |

## Strength model (`src/lib/strength/`, strength-5)

Weights and reps are planned by one model of a person's strength shared by every exercise, so what is learned on one lift informs every related lift.

| Module | Role |
|---|---|
| `library.js` | Every exercise's profile: share of the work per muscle (from the catalog, refined per exercise from EMG and coaching evidence), how a logged number becomes the load actually moved (`ext × logged + bw × bodyweight`), and a reference lift with a ratio and its uncertainty. 207 strength exercises; 155 tied together. Similarity (muscles, joint actions, pattern, equipment) lists related exercises |
| `recovery.js` | Per-muscle fatigue from every set, scaled by involvement and closeness to failure: acute (fades within the hour: set-to-set and exercise-to-exercise, e.g. triceps work before bench) and residual (fades over days at each muscle's own half-life, 16–32 h). An exercise's available strength blends the average fatigue of its muscles with its most tired important muscle |
| `graph.js` | One Kalman filter over: muscle strengths θ (correlated through a general and a regional factor), per-region improvement rates, today's form (shared by every exercise in a session), each exercise's own offset δ, a per-place offset for machines and cables, and per-exercise rep endurance κ. Sessions are combined per exercise; one-sided evidence ("did the reps", "too heavy") corrects only when contradicted; deliberate taps are never treated as typos; typo screening; trained muscles improve with stimulus, untrained ones detrain after 10 days; new exercises learn fast (skill), exercises that keep beating predictions speed up; stalls (two tough sessions, no gain) trigger one lighter reset. Rebuilt from history (edits correct it) and extended incrementally when a workout is saved (exactly equal to a rebuild) |
| `prescribe.js` | Works backwards from the estimate to a loadable weight and reps in effective-load terms (bars, per-hand dumbbells with bodyweight, assistance). Double progression with hysteresis, caution only on increases, jump limits on total and on added weight, a floor at what was just done comfortably, rep-range and reps-in-reserve targets by goal and experience, lighter days, bodyweight rep progression |
| `session.js` | In a workout: one-tap "how did it feel" (and "how many more?" after Easy), "I couldn't do this" (too heavy / some reps / hurt / swap / type), typed numbers never overwritten, "set my working weight" (anchor) and "start over"; remaining sets and upcoming related exercises are re-planned from today's form and fatigue |
| `index.js` | `strengthTarget`, `strengthSummary`, `todayReadiness`, `exerciseReadiness`, `experienceSuggestion`, `startingWeights`, `strengthBalance`; caching; any internal error falls back to the simple rules (never a broken plan) |
| `../baseline.js` | The starting-point session (below): movement choice, the step-by-step flow, typed starting numbers, result lines |

Planning also uses the model: a `fit` feature (outgrown, too hard even at the lightest option) and a `fatigue` feature (muscles still recovering, counted only beyond what recent overlap already penalises), and a coverage step-up (one level up, gentlest equipment first) when a main movement has nothing at someone's level.

**Starting point** (`lib/baseline.js`, `components/baseline/`). Someone with no strength training saved is offered a ~30-minute first session instead of a normal plan: one movement per slot (legs, push, row, hinge, overhead, pulldown, curl, then a timed hold; fillers when little fits), chosen by the same hard rules as any plan, machines and dumbbells before barbells for someone starting out, and never a heavy barbell deadlift. Per movement: pick a weight (four choices about an eighth apart around a suggestion from `startingWeights`; the first is scaled by bodyweight, later ones come from the movements already done), one set stopped with about two reps left and never past 15, then reps done and reps left ("none", "1 or 2", "3 or 4", "5 or more"). A second set is added only after "5 or more" (heavier) or a set too heavy to read (lighter); never a third. "Too heavy" records the attempt and suggests lighter. It is saved as an ordinary workout (`kind: 'baseline'`, nothing carried over, no feedback question, not used for pace), so the graph learns from it like any session. It can be skipped, or replaced by typing known numbers: those are anchors with `scope: 'baseline'`, which update the muscles as well as the lift (an ordinary "set my working weight" stays with its one lift). The answers are measurements: `RESERVE` now has 0, 1 and 6 ("5 or more": a firm floor with a wide guess above it), each tied to one answer (`RESERVE_FEEL`).

**Pre-filled weights.** A never-done exercise is planned from a close, well-known relative as before; once three or more lifts are known it is also planned from a looser one (similarity ≥ 0.3, spread ≤ 0.5) with a wider margin (`GRAPH.wideTransfer`), so the first workout after a starting point arrives with weights instead of questions. Lighter than ideal is one "easy" tap from right. First guesses at bodyweight reps use half the margin (the worst case is stopping early). In `tests/starting-point-and-test-sets.test.mjs`, scripted lifters with hidden strength end a starting point with every weighted exercise in the next two plans filled, never-done lifts estimated within 25%, and every borrowed weight doable for its planned reps with at least one to spare.

**Where a beginner starts.** The experience prior is regional (`GRAPH.levelByRegion`): someone new to training is further from the reference lifter in pressing and pulling than in the legs and trunk, which daily life already loads.

**Strength balance** (`strengthBalance`, `graph.js areaBalance`). Each lift's estimated max is compared with the library's reference for it and with what is usual at the person's stage; the precision-weighted average is their overall level, and an area's figure is the average deviation of the lifts that mainly train it (≥ 30% of the work). The spread of each lift's ratio is carried through, so a gap on a barbell lift means more than the same gap on a machine. An area is called behind only when the gap is at least 12% and at least one spread wide, at most two at a time, and only with two or more lifts to compare. It is relative to the person's own lifts, never to other people. Behind areas get 25% more weekly target (`WEAK_AREA_BOOST`), and the plan says so when it trains one.

**Test sets** (`TEST`, `session.js`). A planned step up in weight is offered, not imposed: the plan keeps last time's weight and reps and carries `offer { weight, reps, from, fromReps }`; the first working set shows "Ready to try…?". Accepted, that set is the test: every planned rep and not "hard" makes it the working weight for the rest of the exercise and next time; short, "hard" or "too heavy" puts the rest back to the usual numbers, the set still teaches the estimate but is not "last time" (no failure flag, no floor lost), and the offer waits for two more clean sessions. "Not today" leaves the plan alone and the offer returns next session. At most two offers per workout. One more rep is still simply planned, and a weight that was plainly too light ("5 or more left") still just goes up. Saved routines now step too: after clean sessions at the routine's own reps, the next weight is offered at those reps. A pass moves related lifts through the shared graph (close relatives more than distant ones).

**Too heavy, one tap.** During a set, "Too heavy" means too heavy for the planned reps (`attempt.reps`, a softer limit than "couldn't lift it at all", which stays under "Other problem"). It always goes at least one real weight down and at most about an eighth, with Undo; tap again if it is still heavy. The attempt is saved, so the next session agrees.

**No news, no change.** A set logged exactly as planned no longer re-plans the sets after it (`logSet`). Before, the model's own doubt about unanswered sets could lower the third set of a weight the person was completing.

**Easier versions.** The mirror of harder versions: a bodyweight movement the person cannot yet do for the bottom of its range gives way to an easier member of its family that they can (push-ups from the knees before full push-ups).

**Progress without answers.** Sets logged without a "how did it feel" answer only prove "at least 0 left", which never raises an estimate. After two clean sessions running that never went backwards (every set done at the top weight, nothing hard, missed or very hard), each plan the model would only repeat asks for one more rep, or offers the next weight as a test set once the top of the range is reached (`STEADY_SESSIONS_BEFORE_STEP`): ordinary double progression. The attempt is the evidence; a miss hands control back to the model with a real measurement. A weight just done cleanly is not taken away on a normal day. Neither rule applies mid-workout, on lighter days, when muscles are still recovering, or to a held load. Simulated lifters who never answer (`tests/session-fill-and-steady-progress.test.mjs`, and the hidden-strength harness with answers off): sets short of the plan 2.8% → 3.1%; with answers the results are unchanged.

**Everything that plans weights uses the same model and context.** Daily plans, saved routines (with this place, today's bodyweight, lighter-day signals, held loads and past activities, and a preview that shows the weights the workout will start with), mid-workout swaps and place changes (after today's sets), short focus sessions (easy, several reps left) and the "Next time" note after saving (the model a few days on, with the saved workout counted) all ask `strengthTarget`. Simple scaling rules (lighter days, warm-ups) always snap to weights the equipment can hold (`snapLoad`).

**Answers fade into evidence.** "Harder than expected" holds a load for the next session only; a discomfort report that isn't a restriction settles after a "Good" answer or two complete sessions (the report itself is kept). Explicit "too heavy" and "N or more left" answers are limits: exact in the workout and, once saved, within a normal day-to-day difference. After "5 or more left" a step up is judged on the best estimate and may be any weight inside the rep range.

**Lighter where it matters.** A session reported as very hard asks less of the muscles it worked for three days (lighter loads and a preference for other areas), not the whole body. A match, competition or hard activity nearby lightens the whole session; a normal practice or activity lightens only its muscles. Sport and activities that already happened add fatigue to their muscles in the recovery model (`sport-schedule.js pastActivityLoad`, `recovery.js withActivityFatigue`). Short focus sessions add fatigue but are not strength evidence.

**Weekly balance and focus use the library's shares.** Each set counts toward the muscles and areas it trains by their share (a bench press set: chest in full, triceps and shoulders in part); a set tapped "easy" with reps to spare counts for less. A compound lift gets credit for the helper areas it trains. Photo and chosen focus areas count any exercise that works the area at least half as hard as its prime mover (a close-grip bench counts for the arms). Photo focus still never changes loads.

**Session length learns.** Sets are saved with the time they were logged. `engine/pace.js` compares the gaps between sets with the estimator's expectation over recent sessions (breaks over 15 min ignored, at least three sessions, pulled toward 1, within 0.8–1.5) and scales the time budget, so "30 minutes" keeps meaning about 30 minutes for each person. Recovery uses the real set times.

**Harder versions.** A bodyweight or timed exercise this person has done that is outgrown (top of its reps, a held 90 s hold) makes harder members of its family more attractive, named in the plan ("A harder version: you've outgrown plank"); if none is open at the person's level, the gentlest harder one a level up is allowed as a step up. Timed holds progress from last time's target, not the plan's default.

**What the main numbers rest on.** Push-ups move about 64% of bodyweight, 49% on the knees, 41–55% hands raised and 70–74% feet raised ([Ebben et al. 2011, summarised](https://www.strengthlog.com/how-much-of-your-bodyweight-do-you-lift-in-a-push-up/)); a dumbbell bench press is about 80% of a barbell bench in total, ~40% per hand ([Arkansas State thesis](https://arch.astate.edu/all-etd/866)); incline ≈ 78% of flat, front squat ≈ 85% of back squat, overhead press ≈ ⅔ of bench ([Lift Vault](https://liftvault.com/resources/strength-ratio-calculator/), [Fitnessvolt](https://fitnessvolt.com/strength-standards/compare/bench-press-vs-incline-bench-press)); a pull-up's whole-body max is about 1.25 × a lat pulldown's ([Johnson et al. 2009](https://read.qxmd.com/read/19387371/relationship-of-lat-pull-repetitions-and-pull-ups-to-maximal-lat-pull-and-pull-up-strength-in-men-and-women)); a squat or deadlift moves about 77% of bodyweight as load ([ExRx](https://www.exrx.net/WeightTraining/Bodyweight.html)); bench pressing loads the chest most, then triceps and front delts, and steep inclines shift work to the front delts ([PMC7579505](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7579505/)); training to failure slows recovery by 24–48 h ([Morán-Navarro 2017](https://pubmed.ncbi.nlm.nih.gov/28965198/)); triceps work before bench reduces bench reps ([Soares et al. 2016](https://www.jssm.org/jssm-15-111.xml-abst)). These are planning estimates; each person's own ratios, endurance and recovery are learned from their sets.

**Evaluation** (`tests/strength-graph.test.mjs`, `tests/strength-model.test.mjs`). Simulated lifters with hidden per-muscle strengths, exercise quirks and rep curves, trained through the real live-workout flow for 30 sessions with a rotating pool of 20 exercises: 2.9% of sets short of the plan, 4.4% of first tries short, mean |reps in reserve − target| 1.4 over 2,270 planned sets. `tests/algorithm-holes.test.mjs` covers the cross-feature rules above. Hostile-history fuzzing (thousands of seeds: typos, NaN, missing fields, mixed units, attempts, anchors): no internal fallbacks, every weight loadable, jumps within limits, results independent of record order. Incremental updates match full rebuilds exactly; a 300-session history builds in ~0.3 s and each saved workout extends it in ~1 ms.

**Known limits.** Machine weights differ between brands, so a never-used machine starts from a deliberately light guess (or asks, when fewer than three lifts are known), and a gap measured only on machines is rarely called a weak spot; the starting point's timed hold is a personal mark the strength model does not use; the balance view needs lifts for an area before it can say anything about it (core is usually unmeasured); band resistance is unknown, so band exercises keep their own reps-only model; timed holds keep simple +5 s rules (with a harder version once a 90 s hold is reached); bodyweight is taken from logged weights or assumed (~75 kg) with extra uncertainty.

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
