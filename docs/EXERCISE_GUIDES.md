# Mannequin exercise guides

All 88 built-in exercises have an individual two-position mannequin illustration in `public/exercise-guides/`. Each PNG is a 2:1 sheet containing two square frames. The app displays one square at a time without loading another file when the position changes. Assets are requested only when a guide opens; the library does not preload the image collection.

`src/lib/exercise-visuals.json` supplies the captions and exercise names. `ExerciseVisualGuide.jsx` renders the positions inside the shared `FormSheet.jsx`, used by both the guided workout and exercise library. Custom exercises keep their written cues without an unrelated image. A failed image request leaves the cues available and offers a retry.

Generated using the built-in image generation tool. The prompt for every exercise is archived in `EXERCISE_GUIDE_GENERATION.json`. No image-generation calls run inside the app and viewing these illustrations does not spend API credits.

## Verification — November 5, 2026

- Visually reviewed all 88 pairs in the six-exercise review gallery against their captions: pose, equipment, body support, frame boundaries and consistent mannequin styling. Inspected knee extension, dumbbell RDL and back squat at larger resolution as well.
- Tested the actual guided-workout guide, position switching, Muscles and Mistakes tabs, and return to the same set. Tested the exercise library search and opening a row guide.
- Checked phone-sized presentation at 390 × 844 and the illustration in light and dark layouts. No timed frame playback or animation is required to follow a movement.
- Asset coverage test verifies the complete catalog, captions, PNG signatures, resolution and two-frame aspect ratio. Root suite: 128 passing tests. Build, lint and Expo launcher typecheck pass.

These are two illustrated reference positions, not a continuous demonstration or a measurement of the user's technique. Multi-stage movements still require the written cues. This review does not establish professional coaching certification or physical-device verification.

Future catalog additions must include metadata and a matching image; the coverage test deliberately fails if either is missing. Keep the exercise ID stable to preserve asset URLs.
