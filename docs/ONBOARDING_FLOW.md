# Onboarding flow

The shared browser/Expo UI uses a 28–35 screen onboarding, depending on sports,
home equipment, movement preferences, and the photo/manual starting profile.
Question screens stay short. Demonstrations explain the product by letting the
person try it rather than adding paragraphs to each choice.

## Order

1. Interactive workout-length preview; no progress bar yet.
2. Goal, goal-based training mix, physique preference, experience.
3. What has stopped the person before; why plans fail (one sourced figure, the
   obstacle put down to the plan, each answer matched to what Tally does); then
   a live demonstration headed by the person's own words.
4. Exercise variety, first name, gender, age (separate screens).
5. Sport; selected sports, priorities, and a real warm-up preview when relevant.
6. Usual place, home equipment, dumbbell sizes, on-the-go preferences as relevant.
7. Location demonstration using actual equipment restrictions.
8. Usual time, live shorter-workout preview, preferred weekly structure.
9. Cumulative training-time graph and an interactive planning-time example.
10. Areas to avoid and a live soreness-adjustment demonstration.
11. When the first session will happen (a commitment; "not sure yet" is allowed).
12. Existing photo flow or manual starting profile.
13. The plan being built: up to six true lines quoting the answers.
14. Plan reveal: why it fits, a typical session, the first weeks, optional
    starting-weights session, collapsed answer edits.
15. The offer (still non-functional), then **Continue to Tally**.

The Tally logo remains visible. One continuous progress line appears after the
first goal answer. No visible step counter. Existing completed users are not
forced to repeat onboarding; its stored completion version remains 2.

## Demonstrations and persistence

- `src/lib/onboarding.js` owns branching and edit navigation.
- `src/lib/onboarding-demo.js` builds preview plans with the real daily planner.
- `src/components/training/OnboardingDemos.jsx` renders the demos and offer.
- `TrainingProfile.jsx` saves the current screen and answers to the existing draft.
- Changing a demo's time, place, soreness, or exercise never changes saved
  preferences, readiness, workout history, learning, or records.
- Ending-early status changes are a labelled example, not fabricated saved work
  or a promise that every missed set will be carried into the next session.
- The variety question writes the planner's existing `variety` preference.
- Multiple obstacles can be selected; the response preview can switch between them.
- Editing answers from the plan skips demonstrations and goes back to the plan.
- Saved drafts, including the offer screen, resume after a reload. Existing legacy
  chapter-recap drafts remain supported.

## Persuasion, and where it stops

The flow is built to convert, using only things that are true:

- **The person's own words.** Obstacles are worded in the first person, quoted
  back above the demonstration that answers them, and reused on the plan and
  the offer (`BARRIER_ANSWERS`, `pickedBarriers`, `offerPoints`).
- **Blame the plan, not the person.** The "why plans fail" screen removes
  self-blame and positions an adapting plan as the fix. Its one statistic
  (`DROPOUT_FACT`: about half of people who start an exercise programme stop
  within six months) is from exercise-adherence research (Dishman 1988;
  Wilson & Brookfield 2009). Re-check the wording against the source before a
  public release.
- **Commitment.** Naming when the first session will happen (implementation
  intentions; Gollwitzer & Sheeran 2006), shown back on the plan.
- **Effort made visible.** The building screen lists what actually went into
  the plan (`planIngredients`). It is not a fake loading delay: the button is
  available at once.
- **Future pacing.** "Your first weeks" describes what the app will do
  (`firstWeeks`), never what the person's body will do or by when.
- **Loss framed as time.** Deciding time is counted in the person's own
  sessions (plain division in `planningTimeExample`).
- **Price framing.** Per-week prices and the yearly saving are computed from
  the two prices and rounded against us (`offerPricing`); the trainer
  comparison is a rough anchor, worded as "about".
- **Objections answered at the offer** with things the app already does.

Deliberately left out, and tested for in `tests/onboarding-funnel.test.mjs`:
invented user counts, ratings or testimonials; promised results or timelines
("lose X in Y weeks", "save N months"); countdowns and other false urgency; a
trial, guarantee or refund that does not exist yet; and copy that makes someone
feel bad about their body or tells them they will fail without the app. The
last matters doubly because the same flow serves the 13–17 age group. When
real ratings, reviews, a trial or a refund policy exist, the offer screen is
where they go.

## Graphs and offer

The eight-week chart compares two explicitly labelled example schedules: two
15-minute sessions per week (240 minutes) and three 60-minute sessions in total
(180 minutes). It does not claim a strength gain or predict a body transformation.

The planning example calculates minutes spent choosing a workout, using the
selected assumption and three workouts/week over twelve weeks. It does not claim
measured time savings, months saved, or clinical results.

The offer displays $59.99/year and $12.99/month as preview choices only, with
per-week prices, the saving, what the person keeps and three answered doubts.
It has no billing SDK, checkout, trial, entitlement, or payment request, and
says so on the screen. Continue completes onboarding regardless of the selection. Save changes bypasses the offer for
returning users. New demos run locally and make no model API calls.

## Verification

`tests/onboarding-funnel.test.mjs` checks branching, editing shortcuts, exclusive
obstacle selection, real equipment/time/avoidance constraints, preview isolation,
example arithmetic, and draft restoration. Browser QA also covers the sports and
manual-profile path, changing live previews, editing answers, offer reload,
completion, and returning-user preference saves.
