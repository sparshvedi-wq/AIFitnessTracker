# Active application

The user selected this repository's `claude/ink-design` version as the main app on October 25, 2026.
On November 3, 2026, the user compared the separate FRAME app and explicitly selected Tally Ink again. This is the main project for both coding assistants; do not switch to `AIFitnessTracker/mobile`.

- Make future design and feature edits here: `N:\Workspaces\AIFitnessTracker-ink-design`.
- `src/` contains the actual Tally Ink app shared by browser and Expo Go. Preserve the selected Ink design unless the user requests a change.
- `expo/` is the Expo Go launcher and native device adapter for this same app; do not build a second, divergent UI.
- `N:\Workspaces\AIFitnessTracker` is the preserved legacy Expo app. Do not edit or run that version for normal app work.
- Start phone development with `npm run dev:phone`. It serves the Ink app on port 5182 and Expo Go on port 8081 over LAN.
- Do not migrate, delete, or upload old app data automatically. Browser and Expo Go have separate local stores; existing Ink JSON backup/restore is the explicit transfer path.
- Before changing Expo/React Native APIs, check the installed Expo major and its matching official docs. Install native dependencies with the Expo CLI in `expo/` so Expo Go versions match.
- Verify changes with `npm run build`, `npm test`, `npm run typecheck` and `npm run lint` as applicable. Do not claim physical-device verification from bundling alone.
