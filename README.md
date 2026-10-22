# 🍎 Calorie Tracker

A simple, fully-local calorie & macro tracker. No backend, no login, no AI —
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
| **Today** | Date, calories left + macros, **Log food** button, the four meals (tap an item to edit or delete), water, weight, daily note |
| **Progress** | Streak, weekly summary, calorie / macro / weight charts, achievements |
| **Settings** | Daily goals (with the goal calculator), tracking preferences, appearance, data & backup |

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
