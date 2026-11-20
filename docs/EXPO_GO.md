# Ink is the active app

Selected October 25, 2026. All subsequent app edits belong in
`N:\Workspaces\AIFitnessTracker-ink-design` on `claude/ink-design`.

`N:\Workspaces\AIFitnessTracker` remains the preserved legacy implementation.
Its files and stored data were not migrated or deleted. Its Expo process was
stopped so the same LAN port, 8081, can now launch Ink.

## Run

From the active repository:

```powershell
npm.cmd install
npm.cmd run setup:phone
npm.cmd run dev:phone
```

The setup helper installs the pinned Expo dependencies using the Windows/system
certificate store. No SSL checks are disabled. `dev:phone` starts the Ink Vite
server if needed, or uses its running instance, then starts Expo over LAN.

- Browser app: port **5182**.
- Expo Go launcher: port **8081**, name **Tally · Ink**, slug **tally-ink**.
- The launcher uses **Expo SDK 58** (upgraded October 27, 2026). Use the
  matching SDK 58 version of Expo Go on your phone.
- Scan the new Expo QR code on the same Wi-Fi. Fully reopen Expo Go if it still
  displays a cached FRAME screen.
- The native launcher derives the Vite host from the Expo manifest; there is no
  fixed Wi-Fi IP in the app source. `expo/.env` can optionally override it with
  `EXPO_PUBLIC_INK_URL` for a future published deployment.

## One UI, native device adapters

The existing React/Vite `src/` screens render inside Expo Go's bundled
`react-native-webview`. Layout, typography, routines, scoring, progression and
workout behavior remain in the Ink source. Future UI edits should not be
duplicated into `expo/App.tsx`.

The phone adapter supplies:

- SQLite-backed local state, hydrated **before** rendering the app. Changing the
  computer's Wi-Fi IP does not create a new native training store.
- Ordered, acknowledged writes and a visible Retry save notice on failures.
- Native voice cues, haptics and workout screen-awake behavior.
- Native JSON backup sharing and document picking. Imported data still uses the
  existing confirmation before replacing state.
- Native workout-summary sharing. No recipient or external service is selected
  automatically.
- Safe-area padding, loading, connection retry and content-process recovery.

Only the configured Ink origin can issue native requests. Message methods and
payloads are bounded and validated. Snapshots/backups are limited to 8 million
characters. Corrupt native data prevents startup rather than silently overwriting
the saved copy with an empty state.

WebAudio sound cues remain the existing web implementation. iOS mute/volume and
device haptic settings still apply. Hardware voice, file sheets and keyboard
behavior need a physical-device pass; successful bundling does not verify these.

## Data boundaries

Browser saves are still tied to their browser origin. Expo Go uses its own
on-device SQLite store. Neither automatically syncs to other devices, the PC, or
the old FRAME app. Export/restore is the explicit transfer path for compatible Ink
JSON backups. Uninstalling Expo Go/clearing its app data can remove the native
store; keep exports for data you want to retain.

This launcher does not add the old app's AI photo analysis, accounts or groups to
the GitHub branch. It runs the selected branch's existing feature set.

Both development servers must remain reachable for a full cold launch. A
standalone offline release would need a separate packaging/deployment pass.

## Phone-sized preview in Edge

Open `http://localhost:5182/` in Edge on this computer. Press **F12**, then
**Ctrl+Shift+M** to enable device emulation. Choose a phone preset or set a
responsive size such as **390 × 844**. This previews the shared app interface;
native camera, sharing and haptics still need testing in Expo Go on a phone.

## Checks

SDK 58 upgrade verification (October 27, 2026): Expo 58.0.20, React Native
0.88.0, React 19.3.0 and WebView 14.0.1 with Expo-aligned dependencies.
`expo install --check` passes and Expo Doctor passes all 20 checks. Both iOS
and Android launch bundles return HTTP 200 from the LAN manifest, which reports
`exposdk:58.0.0`. Build, 68 tests and native type checking pass. Edge was opened
at 390 × 844. Physical phone testing is still required.

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

Tests exercise origin/method authorization, bridge response handling, ordered
storage, failure/retry, corrupt-data protection and explicit backup import. Native
SDK packages are checked with the installed Expo SDK's dependency checker.

The actual iOS and Android launch assets from Expo's manifests were compiled,
and the normal browser UI was checked after adding the adapter. This was not a
physical iPhone/Android interaction test. No backup was sent to another person,
no paid API was called, and no real training data was imported or reset.
