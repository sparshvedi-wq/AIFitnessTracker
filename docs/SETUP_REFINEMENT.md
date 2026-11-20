# Setup and pre-workout refinement

This supersedes the inter-question response-screen design in the earlier onboarding notes.

## Setup

- Questions advance directly, with short card labels and a simple transition. The welcome screen explains photos, guided workouts, sport warmups, and short sessions. The final screen previews actual exercises instead of repeating promises.
- Initial setup cannot close via backdrop or Escape. A small X exists in development for testing. Editing an already completed setup can still close normally. Existing progress is retained.
- Starting photos are the default path, with one view visible at a time. The small **Opt out of photos** action leads to a manual profile. Height and weight are required on that route; the muscle estimate can stay **Not sure**. A training focus is optional.
- Manual measurements are stored in centimetres/kilograms and the current weight is also logged in the user's chosen unit. User-selected focus affects exercise priority. A muscle estimate does not infer strength or prescribe a starting load.
- Initial setup cannot finish until a three-view photo record or valid manual baseline exists. Photo upload still needs explicit AI consent; local saving without AI remains available under other options. The server does not save uploaded images.
- Form progress is saved between questions. A complete manual draft survives a reload before final confirmation. Completed setup and measurement data are not reset during normal edits. Explicit testing resets clear manual measurements and baseline links with other progress.

## Fake photos

Development: **Photo screen → Testing tools → Load fake photos**. This reuses the three existing fictional adult images. The default **Preview demo results** uses no API credits and is labelled as a simulation.

To test the real AI pipeline, enable **Use real AI analysis · spends API credits**, then allow the AI review. Custom uploads can be marked as fictional adult test photos. Loaded fixtures cannot be relabelled as personal photos; choosing personal photos clears the fixtures first.

The photo service enables synthetic input explicitly in its local development entry point, and rejects it with `NODE_ENV=production`. The route factory rejects synthetic input by default. Consent, image validation, limits and origin checks continue to apply. No new image generation or paid model calls were used in implementation verification; API route tests inject analyzers.

Test results do not count as real photo progress or confirmed photo-based training cues. They can complete a development test run and are clearly marked in Home and the photo viewer. Test controls are hidden in the production UI.

## Before a workout

Full-height screens ask one thing at a time: time, place, how you feel, then the plan. Duration tiles and location cards replace the crowded first page. Soreness selection still uses the body map. Advanced settings remain in the menu. The plan shows actual exercises and sets/reps before preparation; the player still waits for an explicit Start.

Browser verification uses isolated local origins rather than real app data. Production preview verifies the required setup and absence of development controls. Physical iPhone camera and picker verification still requires an actual device.
