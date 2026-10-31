# Tally

Tally: count every rep. A training tracker with guided workouts, sport warmups
and optional photo check-ins. No login. Browser data lives in `localStorage`;
the Expo Go launcher stores training in SQLite on the phone. Optional AI photo
reviews go through the local photo service to OpenAI only when requested.

Built with **React + Vite + Tailwind**.

## Run it

```bash
npm install
npm run dev
```

Then open the URL Vite prints (http://localhost:5182). To try it on a
phone, run `npm run dev -- --host` and open the network URL on the same Wi-Fi.
For AI photo reviews, also run `npm run setup:photos` once and `npm run dev:photos`.
Server-only credentials belong in `server/.env`; see `server/.env.example`.

### Expo Go — current phone version

This repository is the active app for future changes. The preserved legacy FRAME
folder is not the app served to Expo Go anymore.

```powershell
cd N:\Workspaces\AIFitnessTracker-ink-design
npm.cmd install
npm.cmd run setup:phone  # once, or after the Expo lockfile changes
npm.cmd run setup:photos # once, or after the photo service lockfile changes
npm.cmd run dev:phone
```

Scan the Expo QR code with your iPhone camera or Expo Go on Android. Keep the
computer running and use the same Wi-Fi. This starts/reuses Vite on port 5182
and starts the photo service on loopback port 3010 plus Expo on port 8081. If another app owns
8081, stop its terminal first; the helper does not kill arbitrary processes.

The launcher displays the **same Ink UI from `src/`**, so normal design and feature
edits go there and update through Vite. Native storage, voice, haptics, keep-awake,
file backup/restore and sharing adapters live in `expo/`. It is a WebView launcher,
not a second React Native implementation of the screens.

Browser and Expo Go storage are separate. To transfer an existing **Ink** save,
export its JSON backup and restore it in the destination after reviewing the
confirmation. Do not reset the old app to migrate. The legacy FRAME backup format
is different and is not imported automatically.

Full cold startup currently needs the development computer. This setup is not
an offline production build or a hosted release. See [Expo Go notes](docs/EXPO_GO.md).

To build for production:

```bash
npm run build
npm run preview
```

## App layout

| Tab | What lives there |
| --- | --- |
| **Home** | Greeting, Tally score with its trend, growth and consistency, this week vs your goal, the routine up next, streak / volume / bodyweight / average session, recent workouts, muscle balance |
| **Train** | A recommended routine, routines filtered by tag (Push, Pull, Legs, Upper, Full body, Conditioning), your routines, starter routines, new routine, empty workout |
| **History** | Volume by week, month or year, a calendar of trained days, personal bests, every session |
| **You** | Profile and lifetime stats, lift and weekly goals, bodyweight log and chart, workout settings, sample data, backup and reset |

## Guided workouts

Home and Train now offer an adaptive session based on your goal, sports,
equipment, available time, confirmed photo focus, recovery and training history.
Train also has **Warm up for sport** near the top: 15 sports, four preparation
stages and 5–20 minute options. A saved sport warmup is remembered for next time.
Onboarding/preferences ask about sports and their priority against your main goal.

Setup now moves through time, a brief recovery check and a simple overview.
Recommendations use **Your training** and a short description of their focus.
Location, effort, full exercise lists and explanations live in optional menus.

**Prepare workout** opens the player without starting a clock. Tap **Start
session** when ready; each timed exercise still requires its own Start tap.
No elapsed timer or remaining-workout deadline dominates the player. Background
interruptions pause the session. See [training behavior and verification](docs/TRAINING_AND_SPORT_WARMUPS.md)
and the separate [usability suggestions](docs/INK_USABILITY_RECOMMENDATIONS.md).

Pick a routine or build your own. The player walks you through it one set at a
time: Edit set opens −/+ controls for reps and weight, Exercise guide provides technique cues, muscle information and common mistakes,
a rest timer with −15s / +15s / skip, and a plan list you can jump around in.
Targets come from your last session: hit every rep and the weight goes up one
step (5 lb / 2.5 kg). Minimize the player and it keeps running in a bar above
the tabs; reload the page and it picks up where you left off.

The summary shows time, volume, sets, new bests and how your Tally score moved,
then asks how it felt and saves the workout.

## Tally score

`src/lib/score.js` holds a **placeholder** formula: 60% consistency (sessions in
the last four weeks against your weekly goal) and 40% growth (volume in the last
four weeks against the four before). Swap in the real formula there and Home and
the summary follow.

## Design

The Ink look: near-black surfaces, warm paper for the one card that matters on
a page, and a single blue accent. Young Serif for headings, Fraunces for numbers,
Hanken Grotesk for everything else. Corners are rounded with one tucked corner
rather than all equal. Tokens live in `src/index.css` and `tailwind.config.js`;
shared pieces (logo, charts, steppers) in `src/components/Ink.jsx`.

## Project structure

```
src/
  lib/            # pure logic, no React
    workout.js    # sessions, phases, progression, records, weekly stats
    exercises.js  # exercise catalog and starter routines
    score.js      # Tally score (placeholder)
    derive.js     # numbers for Home and History
    sample.js     # ten weeks of sample history
    form.js       # form guide content
    storage.js    # localStorage load/save + default state
    backup.js     # JSON export/import
  store/AppContext.jsx  # reducer-backed store, mirrored to localStorage
  components/     # shared UI and the workout player
  pages/          # Home, Train, History, You
```

The data key is `calorie-tracker:v1`, kept so existing history still loads.
