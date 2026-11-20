# Tally Ink · UX review and customer research
> Historical audit snapshot. The subsequent user-approved people/situations work and people-free photography are tracked in [the implementation notes](PEOPLE_AND_SITUATIONS_IMPLEMENTED.md); some findings below are now addressed.

Review date: October 26, 2026  
Application reviewed: `N:\Workspaces\AIFitnessTracker-ink-design` · `claude/ink-design` · base commit `fe47942`

## Decision

The strongest product promise is **“A useful workout for the time, equipment and energy you have today.”** Make that value obvious before asking people to interpret scores or supply photos. The current Ink visual identity is worth keeping: warm paper, restrained blue, distinctive type and four stable tabs.

The biggest improvements are fewer decisions, believable numbers, equipment-aware substitutions and dependable saving. More dashboard cards will work against that. Photography can improve the first impression, but cannot establish that a plan is right.

**Only editorial photography was implemented in this review. Everything below is a recommendation, not a completed change.**

## Why Claude cannot see the edits

Verified locally:

- The active Git repository is `N:\Workspaces\AIFitnessTracker-ink-design`.
- Its branch is `claude/ink-design`; origin is [sparshvedi-wq/AIFitnessTracker](https://github.com/sparshvedi-wq/AIFitnessTracker).
- HEAD is `fe47942 Restyle the app in the Ink design`.
- The recent training, photo, Expo and interface work is modified/untracked local content. There are zero local commits ahead of the existing remote-tracking branch. This compares the local tracking ref; no fresh fetch was performed.
- The older `N:\Workspaces\AIFitnessTracker` folder returns `fatal: not a git repository (or any of the parent directories): .git`.

A Claude session using GitHub/cloud cannot read these uncommitted files. A local Claude session using the older folder also sees a different application. A local session must open the exact active folder; a remote session needs a reviewed commit pushed to the branch and an updated checkout. GitHub does not synchronize unsaved/uncommitted workspace contents.

I cannot verify which folder or checkout the user's separate Claude session currently uses. No commit, push, folder migration or message to Claude was performed.

## What was reviewed and what was not

**Observed in browser:** first-run preferences; Home in empty and returning states; Train; sport warmup setup and Ready; preferences across all three steps; photo intake; History; You; paused player; workout menu; Exercise guide. Reviewed at 390 × 844 and checked the photo addition at 320 × 740. Separate loopback origins held fictional QA data; the user's phone data was not reset.

**Read in code:** app shell, dialogs, storage and native bridge, backup path, planner, sports, photo intake/request pipeline, workout state machine, set editing, picker, routine flow, summary, stats, history and profile. Findings identify UI observations versus source findings.

**Not established:** physical iPhone/Android behavior, VoiceOver/TalkBack results, real customer conversion, real-world training efficacy, vision-model accuracy, production security certification or paid AI review performance. No personal photos were uploaded and no physique-analysis API calls were made for this audit.

The research below is **secondary customer research**, not interviews with Tally users. Public forum participants are self-selected; their comments establish plausible problems, not prevalence or market size. Competitor documentation establishes advertised functionality, not independent quality.

## Customer evidence

| ID | Source and evidence | Implication for Tally |
| --- | --- | --- |
| R1 | [Fitbod team response and customer discussion](https://www.reddit.com/r/fitbod/comments/1t7bndn/what_weve_fixed_whats_next/): customers ask why sets, reps and weights were chosen; the team acknowledges recommendation overshoots and abrupt changes. | Explain a specific adjustment from real training history; avoid unexplained increases. |
| R2 | [Fitbod customer thread](https://www.reddit.com/r/fitbod/comments/1rg87e0/every_time_i_open_this_app_i_have_to_spend_a/): people describe repeatedly lowering suggested sets/loads and losing confidence when earlier feedback seems ignored. | Measure how often users correct the plan. Remember meaningful overrides and show that they changed the next suggestion. |
| R3 | [Hevy customer request about occupied equipment](https://www.reddit.com/r/Hevy/comments/1xdyfv0/feature_request_alternative_exercises_per_routine/): a user wants preset alternatives and the alternative's own last performance. | Offer a short list of suitable replacements. Preserve the session's intent without transferring an unrelated machine's load. |
| R4 | [Hevy offline-use discussion](https://www.reddit.com/r/Hevy/comments/17ehj1w/does_hevy_work_offline/): a person training without mobile reception asks about usability before committing. This is older feedback, not verification of today's Hevy offline implementation. | Reliable offline startup, local guides and clear save status can be purchase criteria for some people. |
| R5 | [Fitbod gym-profile documentation](https://fitbod.me/blog/your-gym-profile/): describes separate location/equipment profiles and temporary session-duration changes. | Separate permanent defaults from today's situation. Equipment selection is a product capability, not just onboarding decoration. |
| R6 | [Hevy logging documentation](https://www.hevyapp.com/features/track-workouts/): describes previous performance, set types, warmups, notes, substitutions and routine adjustments. | Experienced users expect quick logging and context without being forced through coaching each time. |
| R7 | [Hevy July 2026 product update](https://www.hevyapp.com/community-updates/july-26/): describes session-only versus future-workout replacements and a full program view. | “Today only / Remember this” and a simple weekly intention are useful comparison points. |
| R8 | [NN/g progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/): put common actions up front and expose specialized controls on request. | The quieter player is a good direction; do not hide frequent actions like changing location or replacing an unavailable exercise too deeply. |
| R9 | [NN/g aesthetic-usability research](https://www.nngroup.com/articles/aesthetic-usability-effect/): visual appeal can improve perceived usability but also conceal task failures during testing. | Evaluate task success separately from whether users like the new photos. |
| R10 | W3C: [contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [motion](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html). | Check actual contrast and hit areas. Respect reduced motion. A 44–48px product target is a usability recommendation; WCAG AA target-size minimum is 24px with exceptions, not 44px. |

### People and situations to design around

These are **research-informed hypotheses**, not recruited or validated personas.

| Situation | What success looks like | What should remain optional |
| --- | --- | --- |
| Beginner with 20 minutes | Understand the first exercise and choose an appropriate starting load without expert vocabulary. | Scores, bodyweight, appearance review and complex exercise programming. |
| Regular at a busy gym | Substitute an occupied machine, see previous numbers, log and continue quickly. | Repeating onboarding/readiness every visit. |
| Home/apartment user | Every movement fits available weights, space, noise limits and equipment. | Gym-only exercises and jumping. |
| Recreational athlete | Find the last sport quickly and get a warmup that fits practice time. | A full strength session or sport-heavy primary goal. |
| Interrupted parent or shift worker | Resume without losing sets; shorten the remaining plan; preserve a realistic schedule. | Fixed weekdays and elapsed-time pressure. |
| Person avoiding body metrics | Train effectively without photos, bodyweight or physique comparisons dominating Home. | Appearance-focused feedback and sharing. |
| Person with low vision, motion sensitivity or limited dexterity | Read the dose, reach controls and understand status with assistive tools. | Small text, motion and sound-only cues. |
| Returning after time away | See a cautious restart with a clear explanation and easy correction. | A streak-loss penalty or an immediate performance test. |

## Release priorities

“High” means high potential harm to trust, task completion or data correctness; it is not a medical severity rating.

| Order | Recommendation | Why first | Acceptance check |
| --- | --- | --- | --- |
| 1 | Correct unit handling throughout stored metrics, volume and records. | A correct-looking label can represent the wrong physical quantity. | 100 lb becomes approximately 45.4 kg in display, and switching back preserves the original quantity; mixed-unit history compares correctly. |
| 2 | Put today's session or Resume before the large score. | The primary job is starting/continuing training. | On a 390px phone, the primary workout action is visible without scrolling in empty and returning states. |
| 3 | Separate training volume, physique observations and actual progress. | “Growth” and “Muscle balance” imply more than their current data supports. | A new tester can explain what each metric measures; warmups do not appear as strength PRs. |
| 4 | Make logging corrections and substitutions fast and remembered appropriately. | Repeated correction undermines the personalization promise (R1–R3). | Replace an exercise in a few taps; show its own last load; ask whether the preference lasts beyond today. |
| 5 | Prove saving, recovery and startup without the development computer. | A lost workout or unavailable app outweighs visual polish. | Airplane-mode cold start, force-close after logging, low-storage save failure, backup restore and reconnect all have explicit outcomes. |
| 6 | Resolve current-version scope before advertising. | This Ink branch differs substantially from the legacy app. | Marketing and onboarding only promise features present and verified in this app. |
| 7 | Test the first workout with customers before adding more dashboards. | The recommendation must reduce decisions in practice. | Observe independent completion and correction rates, not just preference ratings. |

## Proposed navigation and attention map

Keep the four tabs. Do not add separate top-level tabs for every feature.

- **Home:** current/next session → one sentence explaining today's focus → relevant optional check-in due row → this week → progress summary.
- **Train:** recommended session; visible current location and duration; sport warmup; saved routines; collapsed starter collection; build/log tools at the end.
- **Workout:** current exercise → dose → log/start action → Exercise guide. Put replacement within easy reach. Keep elapsed session time out of the main focus.
- **History:** recent sessions first for everyday retrieval; then exercise trends and calendar; optional higher-detail analytics.
- **You:** profile and training preferences; accessibility/audio; data/privacy/backup. Development tools belong in a clearly separate area.

This is a proposed hierarchy, not a screen redesign implemented during this audit. Reserve the existing serif for titles and highlights; use the sans-serif for instructions and controls.

## Detailed findings

Legend: **O** = observed in browser; **S** = confirmed in source; **H** = design hypothesis requiring customer validation. Priorities: **H** high, **M** medium, **L** small polish. Each proposed change remains unimplemented.

### Home and first impression

| ID | Evidence / current behavior | Recommendation | Priority |
| --- | --- | --- | --- |
| H01 | O: at 390 × 844 on a fresh profile, “Plan my session” begins around y=818, beneath the fixed navigation area until scrolling. The new photo is after this button and does not cause that position. | Move the training card ahead of the score. Keep a single clear primary action. | H |
| H02 | O/S: returning Home gives the score most of the first screen; a paused session also has both a Home resume card and persistent mini bar. | Promote one clear Resume entry and avoid redundant resume surfaces on Home. | M |
| H03 | S: “Growth” is derived from a training-volume ratio, not measured muscle growth. | Call it “Training volume change,” specify the comparison period, and explain the score on demand. | H |
| H04 | O/S: “Muscle balance” is logged sets grouped into five leading categories; it is not observed physique symmetry. | Rename to “Sets by muscle group,” include all groups or an explicit Other category, and keep photo observations separate. | H |
| H05 | O: a warmup-only QA history shows 0 lb volume, 0-minute average and Other-muscle sets. | Use meaningful warmup/activity summaries and show “Under 1 min” instead of 0. Distinguish practice fixtures from genuine training. | M |
| H06 | O: photo intake precedes the first workout, even though it is optional. | Retain a visible check-in row, but avoid making photography look like a prerequisite. Offer “Train without photos” in the first-run explanation. | M |
| H07 | H: an unexplained /100 score can feel like an assessment of the person rather than logged habits. | Let people hide it; show only when enough relevant history exists. Never imply a health or attractiveness score. | M |
| H08 | S: several stat cards are disabled buttons although they are purely informational. | Render static stats as information; reserve button styling and semantics for cards that open useful detail. | L |
| H09 | O: raw date strings such as 2026-10-26 appear in photo-related UI. | Use “Today,” “In 6 days,” and a readable full date in details; make dates locale-aware. | L |

### Onboarding and preferences

| ID | Evidence / current behavior | Recommendation | Priority |
| --- | --- | --- | --- |
| O01 | O: first-run preferences open as a dismissible sheet over a score-heavy dashboard. Closing does not mark preferences complete. | Explain preview versus setup; provide a deliberate “Set up later” path and a small continuation entry. | M |
| O02 | O: 15 sport choices come before the priority controls; “Sport comes first” can sit below the fold while Continue stays visible. | Show selected sports and the priority choice together; expand the full list on request. | M |
| O03 | S: several very different sports share an entry, e.g. Rugby / American football. | Split categories where drill demands differ. Ask an optional subtype/position later, only when it changes the plan. | M |
| O04 | O: location, home equipment, duration and photo rhythm share one dense final page. Home setup is shown even with Gym selected. | Give home equipment its own conditional step or later edit screen; keep Gym and Home clearly separate. | M |
| O05 | S: units are not requested during onboarding; lb is assumed. | Ask the unit once when the first weight is needed; use a consistent default elsewhere and an explicit unit selector. | H |
| O06 | O/S: training goal defaults to General fitness and the separate profile strength goal defaults to bench press 225. | Do not assign a numerical lift goal without user choice. Offer optional relevant goals after the first session. | H |
| O07 | S: preference controls use pressed buttons for both mutually exclusive and multi-select choices. | Use clear radio-group semantics for one-choice fields; preserve multi-select semantics for sports/equipment. | M |
| O08 | S/H: this preferences flow does not pass Modal's step bodyKey. | Reset scroll position on step changes and move/announce focus to the new heading; test this with screen readers. | M |
| O09 | O: photos have a 7/14/28-day rhythm but no obvious “Off” choice in preferences. | Add an explicit reminder-off choice rather than relying on optional copy. | M |

### Plan setup and recommendation credibility

| ID | Evidence / current behavior | Recommendation | Priority |
| --- | --- | --- | --- |
| P01 | O: daily time/readiness setup is now stepped and simple, but location is in Session options until the Ready summary. | Put a small editable “Home / Gym / Bodyweight” control beside time. It changes the entire plan and is frequently relevant. | H |
| P02 | S: starting a session saves its duration and location back into the usual profile. | Distinguish “Today only” from “Make this my usual setup.” A hotel workout should not silently replace home defaults. | M |
| P03 | O/S: “Why this session?” exists, but the main explanation can be generic. | Show one concrete reason from actual data, such as recently logged legs or a confirmed preference. Keep full reasons in disclosure. | M |
| P04 | S: the daily planner selects from a fixed movement subset, not every exercise in the 70-item catalog. | Expose enough suitable alternatives and ensure new catalog entries are actually eligible for planning. | M |
| P05 | S: deterministic goals/history/readiness/equipment rules personalize sessions; this is not a live AI planner call. | Describe it honestly as an adaptive plan. Show exactly what feedback changed; a model brand is not a reason to trust a load. | M |
| P06 | H/R2: repeated effort/skip feedback needs to feel remembered. | Provide “You marked this too hard last time, so…” and bounded adjustments with an easy undo. Test across several weeks, not one generated session. | H |
| P07 | S: only home equipment categories are stored; exact available loads, increments and machine limitations are absent. | Add optional actual weight ranges/increments per location. Avoid suggesting unavailable dumbbell weights. | H |
| P08 | S/H: daily choices adapt, but there is no explicit multiweek training direction visible. | Offer a quiet “This week's focus” explanation and planned variation without turning Home into a calendar wall. | M |
| P09 | O: Ready → Prepare workout → Start session is deliberate but adds a second confirmation. | Keep the no-auto-start behavior; test naming such as “Open workout” followed by “Start when ready” so preparation is not mistaken for starting a clock. | L |
| P10 | S: custom routines shrink by dropping sets/items from the end to fit time. | Mark what was shortened before starting and allow a priority exercise to be pinned. | M |

### Workout player, guides and completion

| ID | Evidence / current behavior | Recommendation | Priority |
| --- | --- | --- | --- |
| W01 | O: the focused player, explicit Edit set and prominent Exercise guide are improvements already present. | Preserve this hierarchy. Do not reintroduce a dense control wall or persistent session clock. | Keep |
| W02 | S: unavailable equipment is handled through skip/add/full-plan controls rather than a direct guided replacement. | Add “Replace exercise” with 2–3 compatible choices, each with its own last performance and a today-only option (R3). | H |
| W03 | S: one logging action advances the set; easy accidental logging is plausible. | Offer a small immediate Undo that restores the exact set and rest state. Avoid an extra confirmation for every set. | M |
| W04 | S: completed data stores reps/load; unilateral work relies on a shared reps-per-side interpretation. | Clearly state whether dumbbell weight is per hand and whether reps are per side. Support side-specific actuals when users need them. | H |
| W05 | O/S: Overhead press guide has two concise technique cues; no setup sequence or demonstration. | Add position/setup, range and one simple regression per exercise. Keep animation/video as a later, validated content project; decorative photos must not pretend to demonstrate form. | M |
| W06 | S: guide coverage can fall back to generic muscle-group text. | Audit each exercise for specific instructions and mistakes rather than treating a generic fallback as complete coaching. | M |
| W07 | S: guide, menus and edits do not all explicitly pause the session. | Define consistent timer behavior during instructional reading and numeric editing; restore the prior state clearly. | M |
| W08 | S: any app background event pauses; five minutes without screen interaction also pauses. | Explain why it paused. Let a user distinguish a phone-call break from intentionally locking the screen during a set/rest. Validate background timers on real devices. | H |
| W09 | S: after a timed exercise, manual logging can preserve the full target seconds even when the user did not run the timer. | Let users enter actual performed duration and label manual entries. Do not equate planned duration with measured work. | H |
| W10 | O: History lists a warmup drill's 140s under Personal bests in fictional QA data, although session new-record detection excludes sport warmups. | Apply the warmup exclusion consistently in aggregate personal bests; separate preparation from performance records. | H |
| W11 | S: summary puts several statistics, score, exercise list and effort before the final save action. | Pin one Save workout action; disclose details. Make “Saved” an unmistakable state, with optional sharing afterward. | H |
| W12 | S: effort options include “Brutal,” which is imprecise for progression feedback. | Use clear difficulty labels and a brief explanation tied to the adjustment. Do not reward maximal effort as inherently better. | M |
| W13 | S: end-of-session effort is global and may hide one unusually difficult exercise. | Offer optional per-exercise “Too easy / About right / Too hard” only when relevant; remember the override. | M |

### Train, routines and sport warmups

| ID | Evidence / current behavior | Recommendation | Priority |
| --- | --- | --- | --- |
| T01 | O/S: search says routines or exercises but returns routines containing an exercise, not a standalone exercise result list. | Make the result type explicit; add a separate exercise-library route from Train. | M |
| T02 | O: eight starter routines fill much of Train, particularly when the adaptive card is hidden by an active draft. | Show Resume and saved routines first; collapse starters under a clear Browse routines entry. | M |
| T03 | S: the exercise catalog has 70 entries, including sport drills; this version is not the legacy 200-exercise library. | Inventory coverage and restore useful missing movements intentionally. Do not advertise 200 until present and usable here. | H |
| T04 | O: last sport is visible in the warmup entry and sorted first in selection. | Keep this. Consider an optional one-tap repeat after a successful session, with duration visible. | Keep |
| T05 | S: low-impact warmups exist but are inside options and default off for each new setup. | Allow an explicit remembered low-impact preference and a session override; surface it when relevant. | M |
| T06 | S/H: warmup stages exist in data, but users may not understand the sequence. | Show a quiet stage label such as “Warm up → Move → Activate → Rehearse,” without another countdown or completion score. | L |
| T07 | H: people may want only five minutes, practice prep or light movement. | Add one restrained “Short sessions” collection with duration and purpose filters, not many Home buttons. Keep recovery separate from claims to fix pain. | M |

### History, profile and data trust

| ID | Evidence / current behavior | Recommendation | Priority |
| --- | --- | --- | --- |
| D01 | S: Units updates only settings.weightUnit; metric values and goals are unchanged. Volume aggregation sums raw values across workouts; best-lift comparisons use raw numbers. | Store canonical quantities with source units and convert for display, comparison and planner input. Preserve record provenance. | H |
| D02 | O/S: Month view charts eight weekly points while its headline is the latest week's volume. | Make range, period and units agree: four weeks, calendar month or explicit eight-week view. Label comparisons consistently. | M |
| D03 | S: Year compares current partial month to a completed prior month. | Compare equal elapsed periods or state explicitly “versus full previous month.” | M |
| D04 | S: calendar map holds one workout per date, so a date with multiple sessions opens only one. | Open a small day list with both warmup and training; add a count badge. | M |
| D05 | O/S: neutral “Your training” names repeat; the saved focus exists in records but is not prominent in session rows. | Keep the neutral name and display a short focus/location subtitle so sessions remain distinguishable. | M |
| D06 | O: History says “1 sets.” Home shows a warmup as “0 lb.” | Apply singular/plural and activity-specific summary formatting across both screens. | L |
| D07 | S: exercise trends and history search/filter are not exposed in the main History experience. | Let users tap an exercise for last performance and a simple comparable trend; filter by workout type and location. | M |
| D08 | S: browser load failure falls back to a fresh state; browser save failure is console-only. Native has stronger failure handling. | Preserve a corrupt/raw save for recovery; expose persistent save-failure and retry UI in the browser too. Never silently replace valuable progress. | H |
| D09 | S: backups exclude personal photo previews; older previews beyond the recent 20 are removed. | State these limits at export and in older check-in records. Offer explicit optional image export if users want a complete archive. | M |
| D10 | O/S: name editing is a local profile, not an account; no current sign-in, cross-device sync or group system in Ink. | Make “Stored on this device” clear. Treat accounts/sync as a separate planned feature, not something this profile screen already supplies. | H |
| D11 | O: sample history and destructive development controls are in ordinary settings, albeit grouped/confirmed. | Keep testing tools in development builds or a developer section; show a persistent sample-data indicator when enabled. | M |

### Photos, accessibility and small visual details

| ID | Evidence / current behavior | Recommendation | Priority |
| --- | --- | --- | --- |
| A01 | O: photo sheet combines date, guidance, three thumbnails, capture buttons, consent and two save choices. | Separate capture from review/consent in a small step sequence. Preserve the ability to save without AI. | M |
| A02 | S: quality checks run during final review, not immediately after each capture; current camera path is the OS picker, not the legacy custom five-second camera. | Explain when validation happens, or later restore per-photo checks with a deliberate cost budget. Do not promise the old capture flow before rebuilding it. | M |
| A03 | O/S: AI button remains disabled until images/ownership/consent requirements are met; the missing requirement is not summarized beside the action. | Show the next actionable requirement: “Add back photo,” then “Confirm photo permission,” rather than only a grey button. | M |
| A04 | S: cached quality checks avoid repeat checks for unchanged images during the current sheet; requests show text status and can abort on close. | Keep these. Add a clear cancel action and an honest stalled-network timeout; never display invented progress percentages. | M |
| A05 | S: saved check-in reviews and previews are available, but no aligned before/after comparison tool exists. | Offer a private same-angle comparison with date and capture-condition reminders; keep uncertainty visible. | M |
| A06 | S: consent names OpenAI and the Tally server; UI already states no social sharing and local preview storage. | Preserve accurate disclosure. Add a direct provider-data-policy link and a concise privacy details view; do not promise nobody else processes photos. | H |
| A07 | S: only confirmed, recent adult photo focus affects planning; extra side work needs a real movement comparison. | Keep the confirmation boundary. Explain appearance versus strength; never claim that a photograph measures fatigue, body fat or a medical condition. | Keep |
| A08 | S: faint #807D76 on card #1B1C1F computes to about 4.15:1; some 10–12px metadata uses it. Normal text AA threshold is 4.5:1 (R10). | Raise that token for meaningful small text. Existing muted text is about 6.52:1; retain the restrained palette. | M |
| A09 | S: viewport includes maximum-scale=1; many text sizes are fixed in pixels. | Remove zoom restrictions and test 200% text/zoom, system text scaling and an onscreen keyboard without clipping. | H |
| A10 | S: some controls are 28–40px high (toggles, chips, close buttons); captions are often 11–12px. | Use 44–48px touch areas for common controls, which can include invisible padding. Aim for 14px secondary text and 16px instructions where layout allows. This is a product recommendation, not a claim that every smaller control fails WCAG. | M |
| A11 | S: Modal traps keyboard focus and restores it, but background content is not made inert; the full-screen player is a separate overlay. | Test and isolate the active surface for screen readers; ensure background tabs cannot receive unintended navigation while training/modal is open. | H |
| A12 | S: line charts are aria-hidden; segmented filters lack explicit selected-state semantics in several places. | Add readable chart summaries/data views and announce selected range/filter; preserve descriptive icon labels already present. | M |
| A13 | S: some player progress/spinner motion is reduced-motion aware; page/sheet transitions are not handled globally. | Honor reduced motion across all transitions and avoid pulsing/parallax in the new photos. | M |
| A14 | O: at 320px the main action wraps and the large training title consumes two lines. | Test shorter action copy and flexible buttons before shrinking type; keep readable targets and natural wrapping. | L |
| A15 | S: fonts load from Google; app shell loads from the local development server in Expo. | Bundle/cache essential resources and test font fallback and cold startup without the laptop. Do not advertise full offline availability yet. | H |

## Precision recommendations for a future design pass

These are starting specifications to test, not claims about a mathematically optimal design.

- Keep the current ~22px horizontal gutter on a 390px device; allow 16–20px on very narrow devices.
- Use a repeatable 4/8px spacing system: 8 within a tight group, 12–16 within a card, 24–32 between sections. Do not apply one spacing everywhere.
- Keep one 48–56px primary action per setup screen and the existing larger player action. Secondary actions should not consume the same visual emphasis.
- Titles: preserve the serif; typically 28–34px for sheets/pages. Player exercise title may remain larger because it is the main task.
- Instructions: 16–18px with roughly 1.45–1.6 line height; metadata: 13–14px when it carries actual decisions.
- Keep photo and action regions separate. No text baked into images, no contrast-dependent text over faces, no automatic carousel.
- Use a consistent selected treatment plus a check/radio indicator; color alone should not carry selection.
- Keep icon-only actions limited and labelled. Prefer “Options” for unfamiliar overflow entry points when space allows.
- Reserve animation for state transitions and feedback; 120–220ms is a reasonable initial range. Respect reduced motion.
- Preserve scroll position within a tab if someone switches briefly. Reset only when navigating to a new task intentionally.
- Show meaningful empty states with one next action; avoid large empty charts and repeated zero-stat cards.
- Do not add invented ratings, member counts, user photographs, transformation outcomes or “popular” badges as conversion decoration.

### Microcopy examples

| Current | Candidate | Reason |
| --- | --- | --- |
| Growth +12% | Training volume · +12% versus the same days last week | States the measured quantity and comparison. |
| Muscle balance | Sets by muscle group | Avoids implying a physique assessment. |
| Fits 30 min | Planned for about 30 min | Communicates an estimate, not a deadline. |
| Plan my session | Review workout | Shorter option to test; only if the next screen really previews/adjusts the plan. |
| Prepare workout | Open workout | Makes the deliberate start step easier to understand. |
| Nothing starts yet… | Start when you're ready. | Same reassurance with less text. |
| Bench press 225 | Set a strength goal · optional | Avoids an arbitrary target unrelated to the user. |
| Brutal | Too hard today | More actionable feedback; validate against the actual adjustment logic. |
| Next: 2026-11-09 | Next check-in · Nov 9 | More readable without losing a concrete date. |
| 1 sets | 1 set | Basic polish matters in a finished product. |

## Useful feature opportunities, without adding clutter

None of these were built in this task. Impact and effort are relative estimates, not measured ROI. Most can use existing local data/rules rather than an API call per interaction.

| Feature | Especially useful for | Minimal entry point | Scope / guardrail | Relative effort |
| --- | --- | --- | --- | --- |
| 1. Busy-equipment swap | Public-gym users | Current exercise → Replace | 2–3 suitable alternatives; own load history; today-only versus remember. R3. | Medium |
| 2. Exact equipment profiles | Home gyms, hotels, multiple gyms | Location control → Manage setup | Available dumbbell sizes, cable/machine availability, load increments; respect real limits. R5. | Medium |
| 3. Weight convention + plate helper | Beginners, barbell users | Edit set → Weight details | Per hand versus total, bar weight, available plates; no automatic load increase because plates exist. R6. | Medium |
| 4. Apartment/quiet mode | Upstairs flats, shared spaces, sleeping children | Session options → Quiet | Replace impact/noisy moves, remember preference; do not simply mute the audio. | Small–medium |
| 5. “I have less time now” | Parents, commuters, interrupted sessions | Workout menu | Rebuild only unfinished work, preserve logged sets, identify essentials; no missed-work debt. | Medium |
| 6. Return-after-a-break adjustment | People resuming after absence | Contextual Home note | Explain conservative changes; ask current comfort/constraints; no injury diagnosis. | Medium |
| 7. Private, metric-light mode | People who do not want appearance tracking | You → Display preferences | Hide score, bodyweight and photo prompts while keeping training fully functional. | Small–medium |
| 8. Left/right actual logging | Users with explicit unilateral goals | Edit set → Side details | Separate performed reps/load when needed; avoid prescribing correction solely from a photo. | Medium |
| 9. Match/practice calendar | Recreational athletes | Sport preferences | Optional practice days, workload and “sport soon”; adapt strength scheduling, not an extra daily questionnaire. | Medium |
| 10. Flexible-week goal | Shift workers, irregular schedules | Weekly goal | Rolling schedule/recovery awareness and intentional rest; no streak freezes sold as progress. | Medium |
| 11. Exercise setup memory | Frequent machine users, beginners | Exercise guide → My note | Remember bench/machine seat setting, band color, grip cue and preferred alternative, per location. R6. | Small |
| 12. Session receipt + change explanation | Anyone checking personalization | After saving → Next time | One specific “We learned…” adjustment, with user correction. No false precision or invented muscle recovery. R1/R2. | Medium |
| 13. Reliable offline pack + save status | Poor-reception gyms, travelers | You → Offline and backup | Bundled app/guides, local-first saves, explicit photo-analysis connectivity, reconnect handling. Not just a network badge. R4. | Large |
| 14. Private side-by-side check-ins | Users who choose photos | Check-in history → Compare | Same angle/date alignment; optional manual measurements and uncertainty. Never fabricate a transformation. | Medium |
| 15. Private coach handoff | Users with a coach or trusted supporter | History → Export selected | Explicitly selected exercise history/constraints, photo sharing off by default; consent before any external send. | Medium–large |
| 16. Accessible workout controls | Low vision, dexterity or motion needs | You → Accessibility | Larger controls, scalable text, reduced motion, optional spoken cues and haptic alternatives. | Medium |
| 17. Exercise favorites/exclusions | Experienced trainees and constrained setups | Exercise menu | Persistent preferences with an explanatory “Why not available?” route, rather than deleting from one session only. | Medium |

Build 1, 2, 5 and 13 before a broad social feed or more scoring systems. Validate demand for the others with the relevant people. Avoid filling every empty area with an opportunity card.

## Conversion and retention hypotheses to test

No conversion uplift is claimed.

1. **First value:** show a useful preview from time/location/goals before optional photo requests. Compare first-plan views and first saved sessions.
2. **Credibility:** one concrete explanation beats generic “AI personalized” language. Ask users what input caused the recommendation.
3. **Effort reduction:** fewer repeated corrections should help continued use. Track override rate and the same correction repeated next session.
4. **Control:** make changes possible without requiring them. Measure whether users can find location, replacement and actual weight on their own.
5. **Trust:** visible save/recovery status can matter more than another chart. Observe reload/reconnect behavior rather than merely showing a reassuring badge.
6. **Progress:** surface a comparable exercise improvement or a kept weekly commitment. Do not infer body change from volume.
7. **Calm use:** keep workout time optional and avoid guilt about missed days. Validate that shortening a workout feels legitimate.
8. **Visual warmth:** test the added photos with task-based measures; attractiveness ratings alone cannot show improved usability (R9).

Suggested events, only if later implemented with appropriate privacy choices: preferences started/completed, plan reviewed, workout prepared/started/saved, manual target correction, substitution reason, resume success and persistence failure. Do not log photo content, raw health notes or identifying descriptions as analytics.

Useful denominators: saved sessions / started sessions; repeated corrections / comparable recommendations; successful resume / interrupted sessions; successful first task / attempted first task. Define the sampling window before comparing variants.

## Customer validation plan

Recruit a small discovery round across beginner, regular gym, home/apartment, recreational sport and interrupted-schedule situations. Include people who use larger text or assistive technology; don't assume a few participants establish accessibility conformance.

Observe these tasks without explaining where to tap:

1. “You have 20 minutes at home with dumbbells. Find a suitable session.”
2. “That machine is occupied. Continue training without losing what you logged.”
3. “Your actual set differed from the suggestion. Record it and find out what happens next time.”
4. “Take a phone-call break, reopen the app and continue.”
5. “Warm up for the sport you played last, with only five minutes.”
6. “Find both activities you completed on the same day.”
7. “Change units and explain what happened to an older bodyweight/lift.”
8. “Train without photos, then find when a check-in would be due.”
9. “Find where your data is stored and how you would recover it on another device.”

Record task success, wrong turns, taps, corrections, time-to-first-useful-action and post-task confidence. Ask what they expected before explaining the feature. Compare visual preference after task completion. Do not ask only “Do you like this?”

Proposed product targets to validate: workout entry visible without scrolling; common location/replacement actions discoverable within a few taps; correct quantity after every unit change; no lost logged set after app restart; clear reason whenever a plan changes; all core training usable without photography.

## Current-version inventory and operational limits

- **Present:** 70 catalog exercises (including sport drills), eight starter routines, 15 sport categories, deterministic adaptive planning, per-set logging, local profiles/preferences, optional photo review, local check-ins, backup/restore and an Expo WebView/device adapter.
- **Not present in this Ink source:** the complete legacy 200-exercise library, user accounts, cloud sync, the earlier group system, a full exercise-demo video library, or the old custom five-second capture UI.
- Photo review uses a local photo service on port 3010, proxied through Vite on 5182. Expo Go serves the launcher on 8081. The phone still depends on the computer and shared Wi-Fi for this development setup.
- Local state is separate across browser origins and the Expo native store. A visible local profile is not evidence of shared accounts or a hosted backend.
- Full offline release, cross-device synchronization and production deployment need deliberate implementation and verification; they are not implied by successful bundling.

## What changed in this task

Three fictional-adult editorial photos were generated using the built-in imagegen tool, saved as optimized WebP assets under `src/assets/editorial/`, and added only to the existing training recommendation cards and Train sport-warmup thumbnail. Home/gym visual selection follows the stored location; the sport thumbnail is illustrative, not sport-specific instructional content.

The card actions remain ahead of the image; there is no image overlay behind essential text. No generated photo was placed in a personal check-in, progress history, testimonial or exercise instruction. No runtime image-generation calls, new dependencies, navigation changes or feature changes were added.

Exact prompts, asset paths and byte sizes are recorded in [the photo manifest](assets/EDITORIAL_PHOTOS.md).

## Verification

- Production build passed, including hashed local WebP assets.
- 30 existing tests passed.
- Expo TypeScript check and Expo lint passed. The root lint script delegates to Expo; this is not a claim of a full React web accessibility/static-analysis audit.
- Browser photo rendering checked at 390 × 844 and 320 × 740. Images loaded and the checked narrow Train page had no document-level horizontal overflow.
- These checks establish that the photo integration builds and renders; they do not resolve the pre-existing issues listed above or certify the app for production.

