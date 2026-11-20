# Cleaner Ink UI, week view and weekly recap

Implemented October 27, 2026 in the current Ink app at `N:\Workspaces\AIFitnessTracker-ink-design`.

## Layout

Home now has one primary workout action, a compact seven-day schedule, a photo check-in entry, a weekly recap and recent sessions. Score, volume, bodyweight and four-week muscle-set totals are available under **Training stats** rather than competing with the workout.

Home and Train share the same workout card: existing people-free photography, a short factual description, duration and exercise count, and one Plan session button. The exercise list is available from the list icon. Daily and time-based Home photography continues unchanged.

Train has compact sport-warmup and sport-schedule tiles. Routines use grouped rows with meaningful last-used dates, without repeated “New” labels. The preferences sheet groups sport, movement, equipment, week and display settings behind clear rows.

The consistency pass covers page and section type, 44-pixel icon targets, 48-pixel primary buttons, row spacing, card corners, date tiles, switches, filter states and sheet headings. Onboarding and workout copy use plain labels. Exercise guides show numbered technique cards with planning explanations under “Why this exercise.” The full-screen workout remains focused on the current exercise.

## Week view

- Monday–Sunday strip, with previous/next navigation and a Today shortcut.
- Different markers for saved sessions, scheduled sport and photos; button labels describe each day without depending on color.
- Select a date to see its agenda. Details can open every saved session, sport scheduling or photos.
- Saved sessions and scheduled events are separate. Empty days are not invented rest days or assigned training days.
- The strength-day goal respects the user's calendar or rolling-seven-day preference. Light movement, warmups and duplicate sessions do not inflate it.
- Overdue photo reminders appear on today; hidden-metrics mode omits photo markers and prompts.
- The default empty day does not duplicate the dedicated Home photo entry.

## Weekly recap

The card defaults to the last completed calendar week when it contains saved sessions, otherwise the current week so far. The sheet can switch between last week and this week.

It shows distinct strength-training days, logged sets, completed warmups, set activity by day and muscle-group distribution. Comparisons for an unfinished week use the same elapsed weekdays in the previous week. First-use empty states stay compact.

Exercise progress compares the latest result in the selected week with its last recorded baseline before that week. More reps require the same load; a higher load requires at least the baseline's reps. Units are converted before comparing. The UI shows the baseline date. Timed targets are not treated as proof of physical progress, and a comparison is not presented as an all-time record or a physique assessment.

The recap can link to the actual next-session recommendation and show the next sport event. Reported equipment limits can link back to equipment preferences. No new AI calls or API costs are involved.

Sample records, future records, unfinished sets and scheduled-but-unlogged events do not count as completed recap work. Sample session rows are labeled Demo. Existing data is kept on the same device; no migration, deletion or upload is part of this change.

## Related corrections

History's Month view now represents the current calendar month; Year shows year-to-date totals. Comparable periods and mixed-unit volume are handled explicitly. Its calendar opens every session when a date has multiple records. Profile best streaks now use the same distinct strength-day rule as weekly goals.

## Verification

- 68 root tests passed, including new week, recap, comparison, history-range and streak cases.
- Production build, Expo typecheck and Expo lint passed.
- Supplemental web undefined-name check passed; one pre-existing unused-directive warning remains in WorkoutHost.
- Responsive browser checks at 390 × 844 and 320 × 740, including larger text and reduced motion.
- Checked empty and populated recaps, period switching, day agendas, multiple sessions on one date, grouped settings, keyboard focus trapping/restoration, onboarding, explicit preparation/start, pause and exercise guides.
- Fictional populated history was rendered from an ignored, in-memory QA harness without storage writes or API calls. A separate loopback profile was used for onboarding/workout flow checks; no real user data was reset.
- Browser verification does not constitute physical iPhone or Android testing.

Preview captures are in `artifacts/clean-home-phone.jpg`, `artifacts/clean-weekly-recap.jpg`, `artifacts/clean-train-phone.jpg` and `artifacts/clean-exercise-guide.jpg`. Populated screenshots use fictional QA history.
