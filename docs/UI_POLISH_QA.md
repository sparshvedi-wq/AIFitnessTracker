# Tally Ink UI review — November 4, 2026

Main project: `N:\Workspaces\AIFitnessTracker-ink-design`. Shared browser/Expo UI: `src/`. Phone launcher: `expo/`, SDK 58, port 8081. The separate FRAME copy is preserved and its comparison servers were stopped.

## Implemented

- Onboarding: visual goal cards, experience bars, duration tiles, sport emoji, location icons, five-stage progress, and a short illustrated welcome. No forced interstitials or waiting screens.
- Home equipment: recognizable equipment icons, selectable dumbbell sizes, custom sizes, decimal input and validation. Saved weights remain per dumbbell.
- Starting point: photos and the manual alternative remain required paths. Demo photos remain available in development without API spending.
- Comfort: the same accessible front/back body picker is used in setup and session preparation. Labels and a list alternative remain available.
- Review: actual exercises and muscles, editable answers, accurate flexible-time wording, and distinct copy for first-time and returning users.
- Daily screens: less repeated time/place information on Home, a visible Details control, sport-aware shortcuts, a quieter Train header, illustrated empty history, and a goal entry on the empty profile.
- Library: a single collection control and muscle picker, sticky search/filter area, clear search, full exercise names, meaningful empty states, and result counts. Search retains focus when cleared.
- Routine editor: one options menu per exercise, responsive target fields, per-hand dumbbell labels, numeric keyboards, and focus restoration after reordering/removing exercises.
- Access: visible keyboard focus, descriptive dialogs, respect for input autofocus, and larger-text/reduced-motion preferences inherited by portal sheets.
- Rest: progress uses a transform rather than repeated layout-width changes. Existing explicit timer-start behavior is preserved.

## Browser walkthroughs completed

All work used isolated local QA origins, not the user's phone storage.

- Full setup with a sport, home dumbbells, flexible time, no weekly target, excluded legs, bundled demo photos, plan review and dashboard completion.
- No-sport setup with seated/bodyweight travel preferences and a manual height/weight baseline; final plan contained seated exercises.
- Setup reload restored the draft and muscle exclusions. Home weights reached workout preparation unchanged.
- Invalid custom dumbbell values blocked continuation; valid custom sizes merged with selected preset sizes.
- Goal editing returned to review. Returning users saw setup-editing language rather than a first-session claim.
- Guided workout preparation, exercise guide, workout menu, and ending an unlogged session.
- Library name search, muscle selection, combined filters, saved-empty state and resetting filters.
- Routine creation, weight entry, reorder, remove and save. Other exercise targets survived the changes.
- Dark/light themes and 320/390px layouts. No horizontal overflow in the inspected views.
- Larger text and reduced motion; the portal muscle picker had `animation-name: none` and inherited the HTML access classes.
- Browser console was free of runtime errors in the completed walkthroughs.

Screenshots are in `artifacts/onboarding-polish/`. Build/test commands are recorded by the coding session; do not infer physical-device verification from an iOS bundle check. Native camera capture and a paid AI assessment were not part of this UI review.
