# Recommendation engine completion review

Reviewed locally on November 5, 2026, in `N:\Workspaces\AIFitnessTracker-ink-design`, branch `claude/ink-design`. The Ink design and existing mannequin guides are preserved. This work is uncommitted and has not been pushed or deployed.

## Integrated behavior

- All 200 legacy catalog records map to 255 unique built-ins including Ink-only movements; 202 are reviewed strength candidates before personal filtering. Imports participate in planning, swaps, search and logging. Only the original 88 have matching illustrations; other exercises have written guides.
- Daily recommendations combine actual completed work, available time, equipment, movement preferences, readiness, sport context, confirmed photo focus and explicit feedback. Hard exclusions are applied before scoring. The remaining candidates are selected together with time, movement-family and overlap constraints.
- Unfinished work is reconsidered rather than copied into tomorrow as debt. Time, unknown and unavailable-equipment reasons can carry; discomfort, soreness, unwellness and dislike do not. Two saved offers, sufficient replacement work or a decline close the original carryover. Carried equipment variants never renew its age.
- Optional, limited exercise questions separate enjoyment, comfort, effort and setup friction. Dismissal is not a negative preference; reset and retry controls reverse learned choices.
- Ask or adjust answers history questions from real logs and previews temporary changes. Apply, Undo and current-workout adjustments refuse stale history or newer logged sets. Prepared sessions are updated too.
- Common requests use local code. The optional Luna language adapter is off by default and cannot select invented exercise IDs, bypass constraints or directly mutate a workout. No paid model calls were needed for this review.

## Verified corrections

1. Offered-but-unfinished rollover no longer disappears after one saved offer. Partial equivalent work reduces the remainder rather than erasing it after one set.
2. History corrections rebuild the stored outcome and unfinished evidence instead of leaving the old planning outcome attached. Backdated records affect their chosen calendar date; genuine overnight completion timestamps are retained.
3. Malformed current-version outcomes fall back to reconstruction. Future preference resets cannot erase present restrictions.
4. Replan fingerprints include set targets, rest and side-work edits. Replacing a timed exercise clears the old timer and waits for Start. Session start time, pause accounting and live rest timing survive applying an older preview.
5. Missing assistance is unknown. Unfinished doses and mixed working loads no longer trigger a load increase or an inaccurate “you hit every rep” progression message.
6. Dashboard plan previews and Undo detect changed history/preferences and newly started sessions. Home shares its computed plan with Ask or adjust instead of calculating it twice.
7. Bounded beam selection retains a feasible greedy baseline. Evaluation compares the unrounded objective, distinguishes exercise-item repeat counts from sessions and includes a catalog-controlled run.
8. Two vacuous test assertions were replaced with checks of actual catalog metadata and feedback cooldown behavior.

## Verification

- Root suite: **191 passing tests**, including 12 focused completion regressions.
- Server suite: **15 passing tests** with injected providers; no paid photo or assistant calls.
- ESLint, Expo TypeScript, server TypeScript and production Vite build pass.
- Extended property suite: **1,500 generated scenarios**, with checks of constraints, deterministic seeds, equipment removal, time reduction, exclusions and safe replanning.
- Separate benchmark: **1,000 generated plans with zero hard-constraint violations**; 48 simulated people over 28 days, 898 saved sessions per engine. Full results are in `evaluations/engine-evaluation.json`.
- Browser at 390 × 844, isolated QA origin `127.0.0.26:5182`: Ask 15-minute Preview → Apply → Undo, stepwise session setup, exercise guide, load entry, logged set preservation after shortening, partial-session save, optional exercise question, next recommendation using missed work, saved-state persistence, history query and imported exercise search/text guide.

The QA origin contains synthetic test data only; the user's normal localhost data was not reset or migrated. A browser refresh during hot reload reopened onboarding because this QA profile intentionally exited setup for testing; its saved session remained in History.

## Practical limits

These are deterministic planning heuristics and synthetic behavioral evaluations, not validated estimates of recovery or proven fitness outcomes. Small eligible pools can still repeat exercises; the planner penalizes overlap rather than promising never to repeat. A mid-workout location change still gives the saved session one location. The minified main JS is about 692 kB (208 kB gzip), producing Vite's advisory chunk-size warning; the build succeeds. No new native APIs were added, but physical iPhone/Expo Go verification and live Luna cost/latency measurement remain unperformed.
