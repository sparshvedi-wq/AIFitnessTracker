# Tally

Tally: a fully-local training and nutrition tracker. Count every rep, every meal, every glass. No backend, no login, no AI —
all data lives in your browser's `localStorage` and never leaves your device.

Built with **React + Vite + Tailwind**, charts via **Recharts**.

## Run it

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).

To build for production:

```bash
npm run build
npm run preview
```

## Features

- **Fast food entry** — one-tap re-add of recent foods, per-serving nutrition
  that auto-scales by number of servings, and a live total preview.
- **Daily view** — date picker (prev/next + calendar), prominent *remaining
  calories*, running totals, per-meal grouping with subtotals, and progress
  bars for calories + macros vs. your goals.
- **Water & weight** — quick +1 water button and an optional daily weight log.
- **Goals & settings** — set calorie + macro goals directly in grams, or by
  macro percentage (auto-calculates gram targets from your calorie goal).
- **Trends** — calories per day (7/30-day), average macros, a weight line
  chart, logging streak, and weekly averages (Recharts).
- **Backup** — export/import all data as a JSON file.
- **Guided workouts** — step-by-step player with a get-ready countdown, rest
  timers, timed sets, form tips, last-time numbers and automatic progression
  (see below).
- **Nice touches** — confirm before delete, toast notifications, mobile-first
  layout, graceful first-run empty states.

## Project structure

```
src/
  lib/            # pure logic — no React
    date.js       # local date-key helpers (no UTC drift)
    storage.js    # localStorage load/save + default state shape
    calc.js       # totals, per-serving scaling, streaks, trend series
    backup.js     # JSON export/import
    id.js         # unique id helper
  store/
    AppContext.jsx  # single reducer-backed store; mirrors localStorage
  components/     # reusable UI (sheets, food form, cards, Icon set)
  pages/          # DailyView (Today), Trends (Progress), Settings
  App.jsx         # shell: bottom tabs + the logging sheets
  index.css       # design tokens (light/dark CSS variables) + shared classes
```

## App layout

| Tab | What lives there |
| --- | --- |
| **Today** | Date and a tappable week strip, calories left + macros, **Log food** button, the four meals (tap an item to edit or delete), training (today's workout or what's up next, plus this week vs your goal), water, weight (with change since last time), daily note |
| **Workout** | This week vs your goal, a suggested next routine, your routines (with the muscles they work), starter routines, history |
| **Progress** | Workouts / streak / calories / weight at a glance, training (workouts per week, muscle focus, personal bests), nutrition this week, calorie / macro / weight charts, training and logging achievements |
| **Settings** | A summary of what you've tracked, daily goals (with the goal calculator), tracking preferences, workout cues, appearance, data & backup |

## Guided workouts

Pick a routine (six starters are built in: full body, upper, lower, HIIT,
core, mobility) or build your own from ~37 exercises plus any you add. Then the
player walks you through it:

- **Get ready** countdown, then one set at a time: exercise, set *n of m*,
  big −/+ controls for reps and weight, and form tips.
- **Rest timer** after every set with −15s / +15s / skip and an *Up next*
  card. Timed exercises (planks, HIIT) count down on their own.
- **Circuits** run one set of each exercise per round.
- **Progression**: targets come from your last session. Hit every rep and the
  weight goes up one step (5 lb / 2.5 kg); bodyweight moves get one more rep,
  timed moves 5 more seconds. *Last time* numbers show under each set.
- **Cues**: 3-2-1 beeps, a voice coach that announces each exercise, and
  vibration (each can be turned off in Settings). The screen stays awake.
- **Change the plan mid-workout**: jump to any set, redo one, skip or restore
  an exercise, add sets or exercises, pause.
- Minimize the player and it keeps running in a bar above the tabs; reload the
  page and it picks up where you left off.
- **Summary**: time, sets, volume, new personal records, how it felt (1–5) and
  notes. Saved workouts appear in History and on the Today tab.

The logic lives in `src/lib/workout.js` (pure functions: building a session,
moving between phases, progression, records, weekly stats) and
`src/lib/exercises.js` (catalog and starter routines). Timers are stored as
end times, so they stay accurate when the tab is in the background.

**Log food** (and the + on each meal) opens one sheet: pick the meal, tap a
recent food to re-add it, enter a new food, or copy a previous day.

Colors are semantic tokens (`bg`, `surface`, `ink`, `muted`, `line`, `brand`…)
defined as CSS variables in `src/index.css`, so dark mode is one set of values
rather than `dark:` variants on every element.

```
```

`localStorage` is the single source of truth: the store loads from it on start
and persists the full state blob on every change. The data key is
`calorie-tracker:v1`.

## Brand

Tally is dark-first and built to be screenshotted. The rules, so new screens
stay on-brand:

- **Name and mark**: four strokes and a volt slash (`src/components/Brand.jsx`).
  Counts that matter (workouts this week) are drawn as tally marks.
- **Color**: near-black (bone in light mode) as the dominant neutral, one volt
  accent (`accent`) for the primary action and progress, and one hue per data
  metric (`protein`, `carbs`, `fat`, `water`). Tags, settings and icons stay
  monochrome. Tokens live in `src/index.css`.
- **Type**: Big Shoulders Display in caps for titles and every big number
  (`.num`), Instrument Sans for body copy, and Instrument Serif italic only for
  the coach's voice (`.voice`).
- **Voice**: a dry, encouraging coach, one line at a time (`src/lib/voice.js`).
- **Share card**: "Share my week" draws a 1080×1920 story image
  (`src/lib/shareCard.js`).
