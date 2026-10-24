# Tally

Tally: count every rep. A fully local training tracker with guided workouts.
No backend, no login. All data lives in your browser's `localStorage` and never
leaves your device.

Built with **React + Vite + Tailwind**.

## Run it

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173). To try it on a
phone, run `npm run dev -- --host` and open the network URL on the same Wi-Fi.

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

Pick a routine or build your own. The player walks you through it one set at a
time: big −/+ controls for reps and weight, a form guide for each exercise,
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
