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

- **Fast food entry** — quick-add bar, per-serving nutrition that auto-scales
  by number of servings, and a live total preview.
- **Reusable food library** — every food you add is saved; re-add it later from
  a searchable list instead of re-typing.
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
  components/     # reusable UI (sheets, food form, library, cards, Icon set)
  pages/          # DailyView (Today), Foods, Trends (Progress), Settings
  App.jsx         # shell: bottom tabs + center "+" log button and logging sheets
  index.css       # design tokens (light/dark CSS variables) + shared classes
```

## App layout

| Tab | What lives there |
| --- | --- |
| **Today** | Date, calories left + macros, the four meals (tap an item to edit or delete), water, weight, daily note |
| **Foods** | Saved-food library: search, favorites, sort, edit, one-tap add to a meal |
| **＋ (center)** | Log food from anywhere: pick a meal, re-add a recent food, enter a new food, pick from My Foods, or copy a previous day |
| **Progress** | Streak, weekly summary, calorie / macro / weight charts, achievements |
| **Settings** | Daily goals (with the goal calculator), tracking preferences, appearance, data & backup |

Colors are semantic tokens (`bg`, `surface`, `ink`, `muted`, `line`, `brand`…)
defined as CSS variables in `src/index.css`, so dark mode is one set of values
rather than `dark:` variants on every element.

```
```

`localStorage` is the single source of truth: the store loads from it on start
and persists the full state blob on every change. The data key is
`calorie-tracker:v1`.
