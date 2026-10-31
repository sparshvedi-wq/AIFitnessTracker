# People and situations · implemented

October 26, 2026 · active Ink app, browser and Expo Go shared UI.

This implements the eight situations in the customer review, rather than every separate item in that review's broader backlog.

| Situation | Implemented behavior | Main entry |
| --- | --- | --- |
| Beginner with limited time | Workout action appears before the score; visible time/location; dedicated home-equipment step; starting-weight guidance and per-hand versus total conventions; unset weights cannot be logged accidentally; new profiles have no arbitrary bench-press target. | Home → Plan my session; Edit set |
| Regular in a busy gym | Replace the current movement with compatible alternatives; see the alternative's own history; keep completed original sets; optionally remember the preference for future daily plans; previous performance is visible in the player. | Workout menu → Replace exercise |
| Home/apartment user | Separate home equipment and available dumbbell sizes; suggestions don't round above the available target; quiet/low-impact preference; jumping in routines is replaced with quiet movements; equipment-incompatible routine entries are adapted or omitted with explanations. Added distinct dumbbell press/RDL definitions so barbell cues aren't used for them. | Home onboarding step; You → Make training fit |
| Recreational athlete | Last completed sport remains first; its warmup duration is remembered; quiet preference initializes low-impact warmups; 5/10/15/20-minute programs remain manually started; warmups don't satisfy strength-day goals or enter strength personal bests. | Train → Warm up for sport |
| Interrupted parent/shift worker | Prepared workouts survive reload and wait for Start; pause/background behavior remains; shorten only unfinished work without changing completed sets; visible Save workout action; calendar or rolling seven-day goals count distinct training days; temporary time/location changes don't silently replace defaults. | Workout menu → I have less time; You → Make training fit |
| Person avoiding body metrics | Optional display mode hides score, bodyweight and photo prompts; stored appearance emphasis no longer affects recommended training while that mode is enabled. Photos remain an optional explicit entry in You. Existing data is retained. | You → Make training fit → Training without body metrics |
| Accessibility needs | Larger text/touch controls, reduced motion (also honors device preference), higher-contrast small metadata, zoom allowed, independent existing audio/haptic settings; dialogs and full-screen workouts isolate background controls and contain keyboard focus. | You → Make training fit; Settings |
| Returning after time away | A gap of 14+ days since strength training produces a clearly explained lighter restart, reduced set volume and conservative historical load suggestions; a photo is never used to infer lost strength or fatigue. | Next daily recommendation |

## Photography

Six people-free local photos replace the earlier three photos of people. Home alternates scenes by local day and morning/afternoon/evening period. See [asset paths and exact generation prompts](assets/EDITORIAL_PHOTOS.md).

## Verification and limits

Meaningful automated checks cover stable date/time selection, equipment parsing and load ceilings, reversible unit conversion, mixed-unit workout records, distinct-day goals, return-after-break behavior, swap eligibility and preservation of completed sets, shortening, quiet routine adaptation and metric-light planning. Existing training/native persistence tests remain part of the suite.

Browser QA uses a fictional profile on a separate loopback origin. It checks onboarding, invalid input recovery, private/large-text settings, preparing and resuming after reload, starting-weight validation, a remembered swap, shortening, save and reload. These QA entries are not evidence of physical exercise.

The existing Expo native storage bridge and local development networking are retained. This is not a new offline installation, account/sync system or physical-device certification. Actual strength and comfort still require user input; load heuristics are not a clinical assessment. Exact stock-image scenes repeat from a six-image library; no claim of 42 unique images is made.

Final checks: production build passed; 45 tests passed; Expo typecheck and lint passed. A supplementary web check found no undefined JavaScript/JSX references (one pre-existing unused-disable warning). Browser checks passed at 390 × 844 and 320 × 740, including large text without horizontal overflow, dialog keyboard wrapping, Escape/focus restoration, nested workout menus, no automatic timer on preparation, saved-session reload and lb/kg quantity conversion. The final QA tab reported no browser warnings or errors.

Home shows one clear plan/resume entry; the persistent mini bar is retained on other tabs. Prepared sessions are labelled “Plan ready,” rather than “In progress.”

