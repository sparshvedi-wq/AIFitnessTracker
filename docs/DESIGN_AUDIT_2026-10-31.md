# Tally Ink · design and product audit

October 31, 2026 · `claude/ink-design` working tree (uncommitted changes on top of `fe47942`).
Nothing in the app was changed. This document is the only file added.

**How this was checked:** I read the app shell, all four tabs, the onboarding, session setup, workout player, summary, store, storage, units, backup and planner entry points. I walked a fresh profile through onboarding, Home, Review workout, the player (set edit, log, rest), Train, History, You and Preferences at 390 × 844 on a separate local port, using fictional data. Build, 105 tests, typecheck and lint all pass. Not checked: a physical phone, screen readers, or the photo AI service.

Tags: **O** = seen in the running app · **S** = confirmed in source.


## Implementation status (October 31, 2026)

**Kept by decision:** 1.1, 1.2, 1.4 and 1.5. Setup stays long because payment comes after it, and photos (or the manual starting profile) remain required.

**Implemented:** everything else in sections 1–5, plus section 6 items 1, 2, 4, 5, 6 and 7. Highlights:

- **Player:** timers keep running in the background, with a rest-end notification in Expo Go (`expo-notifications`). Only 30 idle minutes pause the session. Toasts moved to the top. The rest timer is now the hero, with a next-set preview. Starting-weight quick picks, and +/− steps through your own dumbbells. A warm-up set is added before the first loaded lift. "End workout" replaces the misleading "Finish → Discard?" flow.
- **Settings:** one Training preferences sheet (setup, events, equipment, comfort, display). Units, appearance and workout cues live on You. Rhythm is always "any seven days", and the unreachable calendar-week code is gone.
- **Design system:** light theme, with Automatic, Light and Dark settings. Fonts are self-hosted: Fraunces for titles and numbers, Hanken Grotesk for body text. Card corners are even, with the tucked corner kept for the hero and primary button. Colours come from tokens only. Weekday labels follow the device language. No native `<select>` controls remain.
- **Copy:** sessions are named for their content ("Push", "Lower body", "Quick full body"). Buttons use only Review and Start. Footnotes are cut to one line, every count is pluralized correctly, and History and You have real empty states.
- **Data:** check-in photos live outside the main save (IndexedDB in the browser, device storage in Expo Go), and older saves are moved over safely. Storage now uses the key `tally:v1`; the legacy key is still read and never deleted. Height follows the unit system. The bodyweight change is labelled with the date it compares against. Weight can be logged for past dates. Backup names use the local date. Restored workouts are sorted.
- **Hygiene:** ESLint (react, hooks, jsx-a11y) and Prettier now cover `src/`. Calorie-tracker leftovers and dead code are removed.
- **Also fixed:** Home's rotating photo now matches where you train.

**Added in the follow-up pass:**
- **Saved places (6.3):** Gym, Home and On the go, plus up to 8 places of your own. Each is a Full gym, My equipment or No equipment place, with its own equipment, dumbbell sizes, space limits and a quiet flag. You can add a place in Training preferences, or from session setup. Places are available on Home's "Today I have" chip and in onboarding when editing. The planner, swaps, saved-routine adaptation, load suggestions, notes and unit conversion all use the chosen place. Workouts keep the place's name, so History still shows it after the place is deleted. The model is in `src/lib/places.js`; older saves need no migration.
- **"Next time" on the saved screen:** shows up to three concrete changes, using the same rule the planner applies, and respects your listed dumbbells. It's hidden after a pain or soreness finish. New personal bests show here instead of a toast.
- **"Don't suggest this exercise"** in the exercise guide. Plans, short sessions, swaps and saved routines respect it, and the routine change list names it. You can undo it under Training preferences → Exercise choices.
- **Barbell plate breakdown** ("45 lb bar + 25 + 10 each side") in the player and set editor.
- **Quiet training** is now either "everywhere" (Movement comfort) or set per place.
- **Builds:** the dev-only test photos no longer ship in production builds (`vite.config.js` alias).

**Not done:** existing saves keep their stored `dark` theme; new installs follow the system.

**Not verified:** physical-device behaviour, including the background notification, Expo Go cold start and haptics.

---

## The core problem

The app works, and it's careful about honesty. What makes it feel machine-made is that **every new idea became one more surface**: a card, a disclosure, a footnote, a settings entry. A sophisticated team does the opposite. It removes options until each screen has one job and one voice. Most of what follows is about subtraction and consistency, not new features.

The product promise is "fitness on no fixed schedule, for everyone." Three things currently work against it:

1. **Onboarding gates the app behind body data** (see 1.1).
2. **Every session is called "Your training"**, so the app never seems to know what it planned (see 2.1).
3. **Locking your phone pauses the workout**, which breaks the most common gym behaviour (see 1.3).

---

## 1 · Fix first: these break the promise

| # | Finding | Evidence | Suggestion |
|---|---|---|---|
| 1.1 | **You can't finish onboarding without body photos, or height and weight.** "Opt out of photos" opens a required height/weight form. Pressing Continue with it empty does nothing and shows no error. | O; S `TrainingProfile.jsx` `advance()` → `hasStartingProfile` | Make the starting point truly optional, with a third choice: "Skip, just train." Show inline validation when a field is required. This contradicts the metric-light mode and "photos are your choice" copy. |
| 1.2 | **The welcome screen leads with photos.** Step 01 is "Start with your photos", and the tagline is "Your photos set the starting point." | O | Lead with what the app does for the user: "Tell us your time, place and energy. Get a workout." Photos belong later and optional, not as step one of the pitch. |
| 1.3 | **Locking the phone or switching apps pauses the session and freezes the rest timer**, so the rest-end cue never fires. Five minutes without a tap also auto-pauses, even during long holds or rest. | S `WorkoutHost.jsx:25-41` | Keep timers running in the background (timestamps already make this cheap), and fire the cue through a native notification in Expo. Only pause on an explicit tap, or after a long gap (for example 20+ minutes), and ask "Still training?" on return. |
| 1.4 | **About 10 screens before any value**: goal, experience, about, sport, location, home, time, rhythm, avoid areas, photos/profile, review. The progress label stays on "1 of 5" for three screens. | O | Ask three things (goal, where, how long) and show a real workout. Ask the rest in context: equipment when Home is first chosen, sport when they tap Sport warmup, rhythm after the third session. Use a continuous progress bar, not stage counts. |
| 1.5 | **"Gender" and "Age group" are asked with no visible reason.** Age offers only 13-17 or 18+. | O | Drop gender unless it changes something the user can see. If age gates photo features, ask only when photos are chosen and say why. |
| 1.6 | **The Training preferences button reopens the entire onboarding wizard.** Settings are spread across three overlapping places: Train ⚙, You → Training, and You → Preferences. Rhythm and equipment each appear in two of them. | O; S `App.jsx` `openProfile` / `openPersonal` | Use one Preferences screen with sections (Goal, Places & equipment, Rhythm, Comfort, Display). Keep onboarding as a first-run flow only. |
| 1.7 | **Toasts cover the player's primary button.** "Workout started" sits over "Choose starting weight" for 4 seconds. | O | Put toasts at the top, or above the dock inside the player. Better: drop confirmation toasts for things the screen already shows. |
| 1.8 | **Editing your weekly goal silently switches it to a rolling window.** Three places hard-code `goalWindow: 'rolling'`, so the calendar-week logic can never be reached. | S `You.jsx:193`, `PersonalSettings.jsx:23`, `TrainingProfile.jsx:63` | Pick one model and delete the other, or expose the choice. |

## 2 · What makes it feel AI-generated

| # | Finding | Suggestion |
|---|---|---|
| 2.1 | **Every plan is named "Your training"** (S `planner.js:508`), with summaries like "Focused on balancing your muscle groups today" even on day one (O). History becomes a list of identical titles. | Generate names from the content: "Lower body · Gym", "Push & core · 30 min", "Quiet home session". Make the summary specific ("Legs haven't been trained in 6 days"), or leave it out. |
| 2.2 | **Too many hedges and footnotes.** "How this is counted", "How targets adjust", "Privacy & other options", "This is a reported activity, not a guided workout or measured recovery result…". Honest, but the volume reads as defensive generated copy. | Keep one line per claim. Move methodology to a single "How Tally works" page in You. Edit all copy in one pass for a single voice: short, warm, specific. |
| 2.3 | **The asymmetric "tucked" corners are applied inconsistently.** Cards tuck bottom-left, onboarding choices bottom-right, and the hero tucks bottom-left at a different radius. At small sizes they look like rendering glitches. | Choose one: either a single tuck direction used only on the hero and primary button as a brand signature, or plain uniform radii everywhere. |
| 2.4 | **Three typefaces (Young Serif, Fraunces, Hanken Grotesk) loaded from Google at runtime.** The number serif is also used for words ("Flexible" on You). | Two families are enough: serif for titles, sans with tabular figures for numbers. Self-host the fonts so offline and Expo starts don't fall back. |
| 2.5 | **Duplicate status surfaces.** Train shows a "Resume your workout" row plus the floating mini bar. Home's resume card says "In progress" but not the live rest countdown that the mini bar shows. The mini bar is a loud full-accent pill. | Use one live element: a calm mini bar showing the rest countdown, also on Home. Remove the Train row. Tone the bar down to surface colour with an accent progress line. |
| 2.6 | **The app is dark-only** (`html class="dark"`, `color-scheme: dark`), although `settings.theme` exists and `docs/polish` has light screenshots. | Ship light mode following the system setting. Warm paper on ink already suggests it. Many people train outdoors or in bright gyms. |
| 2.7 | **Hard-coded colours bypass the tokens**: `#C9C5BA`, `#D3CFC5` (TrainingCard) and `#222327` (tab bar). | Use tokens only. This is a prerequisite for 2.6. |
| 2.8 | **The weekly recap's M–S labels use `justify-around`, so they don't line up with the bars.** The week is hard-coded to start on Monday, with English-only day letters in four places. | Use one shared week-strip component with a locale-aware first day and labels from `Intl`. |
| 2.9 | **Empty states show walls of zeros.** History shows three 0 cards, filters and a search box for an empty list. You shows "0 Sessions · 0 Working sets · 0 Days" and an empty strength-goal bar with "–". | When there's no data, show one sentence and one action. Hide stats until they mean something. |
| 2.10 | **Branding is redundant.** Home shows the Tally mark beside the date under a page already titled "Today". You has no page title, while the other tabs do. | Put the brand in the app icon and splash screen only. Give all four tabs the same header structure. |
| 2.11 | **The CTA vocabulary drifts** for the same action: "Review workout", "Plan session", "Open session", "Start workout", "Start session", "Prepare workout". | Settle on two verbs: **Review** (see and adjust the plan) and **Start** (the clock begins). |
| 2.12 | **Native `<select>` controls inside the polished UI**: set type in Edit set, the "More" filter chip in History, the exercise picker in History, lift selection. | Replace them with the existing segmented and sheet patterns. A select styled as a chip especially looks broken. |

## 3 · Everyday friction in the workout

| # | Finding | Suggestion |
|---|---|---|
| 3.1 | **The first weight starts at 0** and steps +5 lb, so 25 lb takes 5 taps. Starting-weight help is collapsed (O). | Offer 3–4 quick picks based on experience and exercise (for example 10 / 15 / 20 / 25 lb) and "I don't know, suggest one." |
| 3.2 | **The rest timer is small and dim by default** (`calmRest`, 40px muted, O), with a large empty card below it. You can't read it from a bench. | Make the rest number the hero: large, high-contrast, with a progress ring. Show "Up next" with the next set's numbers, so the screen is useful while you wait. |
| 3.3 | **"Finish" with 0 sets logged opens a "Discard workout?" dialog** (S `WorkoutPlayer.jsx`). | Disable Finish until a set is logged, or label the dialog clearly: "Nothing logged yet: discard?" |
| 3.4 | **No warm-up set suggested for loaded lifts**, even for "New or returning." | Add one optional lighter warm-up set to the first compound lift, pre-marked as warmup so it doesn't count. |
| 3.5 | **The session setup "Feel" defaults to "Good"** without asking, yet the review says "Adjusted to your time and how you feel" (O). | Either ask with one tap (Low / OK / Great) or remove the claim. |
| 3.6 | **The Train tab hides the day's recommendation whenever a workout is active**, and the empty "Your routines" state has no button (only the small "Create" link in the header). | Show a recap of today's plan under Resume, and add a "Save a routine" button to the empty state. |

## 4 · Data and correctness

| # | Finding | Evidence | Suggestion |
|---|---|---|---|
| 4.1 | **Height defaults to cm for lb users.** Home then shows "178 cm · 170 lb". | O; S `manualEntryOf` | Derive both height and weight units from one regional "Units" choice (Imperial / Metric). |
| 4.2 | **The bodyweight change is labelled "this week"** but compares against the newest entry that's 7 or more days old, which could be months back. | S `You.jsx` `weekAgo` | Say "since Oct 3", or only compare within 7–10 days. |
| 4.3 | **"Training since" and Home's "Recent sessions" assume `workouts` is sorted.** Import and restore don't guarantee that. | S `You.jsx` `workouts[0]`, `Home.jsx` `slice(-2)` | Sort by `startedAt` once in a selector. |
| 4.4 | **The backup filename uses the UTC date**, so an evening export in the Americas is named tomorrow. | S `backup.js` `toISOString()` | Use the local `todayKey()`. |
| 4.5 | **Photo previews (about 60 images as base64) live in the main state**, which is re-serialized to localStorage or native on every dispatch, including each logged set. This risks the ~5 MB browser quota and adds jank during workouts. | S `PhotoCheckins.jsx:98`, `AppContext.jsx` save effect | Move images to IndexedDB or native files and keep only references in state. Debounce saves outside the player. |
| 4.6 | **The weight log is always "Saved for today."** It can't be backdated or edited, and the plate math has no 2.5 lb option. | S | Add a date field to Log weight. Let the weight step follow the user's available increments. |
| 4.7 | **Toast timers aren't cleared on unmount.** The pause button contains an unreachable `paused ? resume : pause` branch. | S | Minor cleanup. |

## 5 · Engineering hygiene (invisible to users, visible to any team that inherits this)

- **Calorie-tracker leftovers**: `package.json` name `calorie-tracker`, storage key `calorie-tracker:v1`, and food/macro/water reducers and defaults that nothing uses (`ADD_ENTRY`, `SAVE_FOOD`, `macroPercent`, `waterGoal`). There's also a stray personal comment ("Evening, Sid."). Rename them with a migration for the storage key.
- **Lint doesn't cover the app.** `npm run lint` lints only `expo/`, not `src/`. Add ESLint (react, react-hooks, jsx-a11y) for `src/`.
- **106 JSX lines are over 400 characters** (whole screens on one line in Home, History, Train, PhotoCheckins). Run Prettier and split components. This alone changes how "generated" the codebase looks to a reviewer.
- **Dead code**: `corner()` always returns the same class; `RoutineList`'s `highlight` is never passed; and the code compares `onboardingVersion !== 2` in Home while elsewhere it uses the `ONBOARDING_VERSION` constant.
- **Test fixtures ship in the production bundle** (`src/assets/testing/*.jpg`, 38–100 KB each). Load them only in `DEV`.

## 6 · Personalisation that fits "no fixed schedule"

These all use data the app already has, so none of them need AI calls.

1. **A "What do you have today?" quick bar on Home**: three chips (time · place · energy) that rebuild the card instantly, instead of a sheet. This is the whole product in one line.
2. **Session names and reasons from history**: "Upper body: you trained legs Tuesday."
3. **Remembered places**: Gym, Home, Hotel, Office, each with its own equipment, picked with one tap. Today they're tied to a single location setting.
4. **"Anything is better than nothing" mode**: when someone opens the app after a long gap or at night, offer a 5-minute version first, without guilt copy.
5. **Exercise notes per place**: seat height, band colour, the cue that worked.
6. **Gentle greeting with the name** ("Evening, Sam"), which the comments imply was planned. Keep it calm, with no streak pressure.
7. **A quiet weekly rhythm view**: dots for days trained in the last 4 weeks. It shows consistency without a target.

## 7 · Suggested order of work

1. **Onboarding rework** (1.1, 1.2, 1.4, 1.5, 4.1): fewest steps to a first workout.
2. **One settings home** (1.6, 1.8).
3. **Player reliability** (1.3, 1.7, 3.1, 3.2, 3.3).
4. **Design-system pass** (2.3, 2.4, 2.6, 2.7, 2.8, 2.11, 2.12): tokens only, two fonts, light mode, shared components.
5. **Copy and naming pass** (2.1, 2.2, 2.9, 2.10).
6. **Storage and hygiene** (4.x, section 5).
7. **Personalisation features** (section 6), one at a time, each measured.
