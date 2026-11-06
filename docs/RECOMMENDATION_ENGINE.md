# Daily recommendation engine (daily-3.1)

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
| `engine/dose.js`, `progression.js` | Minimum rests by role; sets added by marginal value per second; progression from comparable logs (units converted, warm-ups excluded, per-hand never summed, listed dumbbell sizes, assistance decreases, missing loads excluded). Holds on easy/returning/discomfort days, unfinished doses and mixed working loads |
| `engine/replan.js` | Mid-workout changes keep every logged set; fingerprints include targets, rest and side-work edits; double apply is a no-op; stale previews are refused. Current session start/pause/rest timing survives previews. Replaced timed exercises wait for Start |
| `engine/explain.js` | Reason codes → one factual headline + short reasons; full trace with `explainDailyPlan(state, { trace: true })` |
| `assistant/` + `components/AskAdjust.jsx` | Local parser, results from real data, previews with Apply/Undo |
| `server/src/assistant.ts` | Optional gpt-6-luna interpreter (off unless `ASSIST_AI_ENABLED=true` and the client build sets `VITE_ASSIST_AI=on`) |

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
