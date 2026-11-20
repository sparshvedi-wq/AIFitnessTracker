# Silhouette — implementation spec

Source: the approved "Silhouette" row of the Tally Onboarding Directions canvas (screens 1–10, after the avatar-crop, spacing and Adjust-sheet revisions).

## Idea
Everything that is not chosen is a quiet ghost; the choice is lit in Tally blue. M1, the ivory manufactured mannequin, guides setup in a short speech bubble. Controls feel pressable: a solid edge under tiles and buttons that compresses on press.

## Tokens (index.css)
| Token | Dark | Light | Use |
| --- | --- | --- | --- |
| `--accent` | #7AA2FF | #345CD6 | focus, progress, selected edge |
| `--lit` | #1E2433 | #E4EAFB | selected tile fill |
| `--lit-edge` | #3E5590 | #A9BBEE | selected tile depth edge |
| `--accent-ink` | #A9C1FF | #2848AA | text on a lit tile |
| `--depth` | #0B0C0D | #D9D3C7 | depth edge under unselected tiles/secondary buttons |
| `--ink-depth` | #8F8B83 | #000000 | depth edge under the primary (ink) button |

Ghost figures: `.ghost-figure` — dark: `brightness(0) invert(1)` at 0.2; light: `brightness(0)` at 0.16. Never `pointer-events:none` on the control itself; ghosts are artwork, the tile stays fully readable.

## Shape and rhythm
- Radii: buttons and tiles 18px; large tiles/cards 22–26px; sheets 30px top.
- Depth: 4–5px solid edge (`box-shadow: 0 5px 0`); on press translate 3px and shrink the edge.
- Spacing: 16px side gutters on full-bleed setup screens (22px app pages), 24px between sections, 8–12px between tiles.
- Type: Fraunces 500 for display (questions 23–36px, numbers); Hanken Grotesk 15–17px body, 700 for tile labels and buttons; 13–14px only for secondary labels.
- Progress: 12px rounded track with a lighter top highlight; none on welcome and goal.
- Motion: 160–220ms opacity/transform; selection lights over 180ms; images decoded before swap; reduced-motion removes movement.

## Reference → component map
| Board | Implementation |
| --- | --- |
| 1 Welcome | `SetupWelcome` (SetupVisuals.jsx) — lit M1, ghost team, M1 bubble |
| 2 Goal, 4 Sports, 5 Place | `GuideBubble` + `ImageChoices` in TrainingProfile.jsx |
| 3 Goal reaction | `SetupResponse` — lit figure on stage, tally-stroke burst |
| 5 Equipment icons | `EnvironmentFields variant="icons"` |
| 6 Building plan | Review step: plan checklist + preview (real data, no fake wait) |
| 7–8 Finding / detail | `PhotoReviewStory` finding slide — real observation, uncertainty, evidence; area highlight is qualitative |
| 9 Home | `Home.jsx` week strip, tally + check-in cards, `TrainingCard` |
| 10 Adjust sheet | `AdjustSheet.jsx` — time/place/energy tiles + Ask/adjust |
| Everything else | shared `.btn*`, `.tile`, `.segmented`, `.chip`, `Choice`, `Modal` |
