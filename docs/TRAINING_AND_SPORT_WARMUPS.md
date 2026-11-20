# Training on your terms

Implemented in the active Ink application, not in the preserved legacy app.

## Trying the feature

1. Open **You → Training preferences**. Pick a main goal, experience, sports and whether sport or your original goal matters more. Home equipment is saved separately from the fully equipped gym. Existing Ink history is kept.
2. Open **Train → Warm up for sport**, near the top. Choose from 15 sports and 5, 10, 15 or 20 minutes. Your onboarding sports come first. The last **saved** sport warmup ranks first next time.
3. Choose sport/time, then see a concise overview. **View exercises** opens the four stages: build warmth, move through range, activate/control and sport rehearsal. Tap a drill for written instructions. **Session options** contains the low-impact setting.
4. Tap **Prepare workout**, then **Start session** when ready. Each timed drill needs its own Start tap, including after a rest. A five-minute option is abbreviated preparation, not a promise that five minutes is enough for every person or event.
5. **Home → Plan my session** opens **Your training** in three steps: time, a brief recovery check, then an overview. Defaults are remembered. Location, intensity and sport timing are in **Session options**. Soreness and pain each have a separate selection screen. The player shows the current exercise; **Edit set**, beside the set counter, edits reps/weight. The blue **Exercise guide** button opens technique cues, muscles and common mistakes. The workout menu contains the full plan, exercise details, skips, advanced controls, stats and finish/discard actions.
6. **Home → Your starting photos / Photo check-in**, or **You → Photo check-ins**, opens front/side/back capture or camera roll. A local save without AI is available. AI review explicitly requires ownership, consent and age permissions. Only confirm optional focus areas you actually want to train toward.

## Planner inputs and limits

- A deterministic planner runs locally; adjusting a session makes no paid model call.
- Goal, experience, sport priority, home equipment, session duration, energy, chosen intensity, upcoming sport, recent completed volume, prior effort and skip reasons affect exercise/volume selection.
- Normal suggestions preserve varied movement patterns. They reduce work for low energy, very hard recent sessions or upcoming sport. Recently trained areas and reported pain/soreness are excluded; sometimes the right suggestion is a recovery day.
- Time estimates include 3 minutes for easy preparation, transitions, prescribed rest and both sides of unilateral exercises. They are planning estimates, not workout deadlines. The app does not shorten rest to force a fit.
- Photo suggestions affect priority only after explicit adult confirmation and expire after 42 days. Images cannot establish strength, recovery, injury, body composition or overtraining. Teen recommendations use goals, sport and performance feedback rather than correcting appearance.
- Side-to-side work starts with the less capable side and matches the other. Optional one-rep emphasis is restricted to the specifically confirmed, pain-free movement comparison, the final set, alternate dates and a current comparison. No automatic unilateral volume imbalance is prescribed from photos alone.
- Pain/soreness skip flags exclude affected movement groups for two days. Repeated equipment/dislike skips lower exercise priority. Only time-related omissions can receive later priority, for seven days and at most once; no make-up sets or accumulating training debt.
- Logged reps/weights still depend on honest self-report. Session length earns no extra reward. Background interruptions pause immediately; five quiet foreground minutes trigger a pause. Elapsed time is tucked in options and shown after the session, not as a live deadline.

## Photo service

Install: `npm run setup:photos`. Start separately: `npm run dev:photos`.
`npm run dev:phone` starts the photo service along with Vite and Expo when starting a fresh phone session. Vite proxies `/api` to the new repo's loopback-only service on port 3010, so a phone needs only the existing Vite/Expo LAN connection. The old backend on port 3000 is not used by Ink.

Server-only configuration is in `server/.env` (Git ignored); `server/.env.example` has placeholders. The existing locally configured OpenAI key/model settings were copied into this new service without exposing them to the frontend. Quality checks retain `gpt-6-luna`; the combined visual review retains `gpt-6.1-sol`, subject to any existing server overrides and account access. Nothing generates images.

The API validates ownership/consent, age permissions, image encoding/size, distinct views and output schema. It strips image metadata and does not write uploads to disk or log request bodies. Responses use `store: false`; this does not mean the provider has no retention obligations or policies. Photo quality may require retakes; model failure never silently produces a successful review.

Small previews of the most recent 20 check-ins and review text are saved on the current device. Older review metadata remains; preview images are omitted from exported backups. Removing a check-in clears its linked training focus. No account sync, automatic sharing or old-app photo migration was added. Native picker conversion cache files created by this flow are removed after conversion. Browser and Expo remain separate local stores.

This remains local development, including unencrypted HTTP on your Wi-Fi. A production release needs HTTPS, real authentication and per-user abuse/billing controls before exposing the photo service beyond loopback.

## Verification

- Root `npm test`: native bridge and planner/session tests, including all 15 sports × 4 durations and goal/location/time combinations.
- `npm --prefix server test`: route injection with fake analyzers and synthetic color images; no paid AI calls or real person uploads.
- `npm run build`, `npm run typecheck`, `npm run lint`, plus `npm --prefix server run typecheck`.
- Browser interaction checks use an isolated localhost origin with a fictional profile. Expo bundling does not establish physical-iPhone camera, permission or background behavior; verify those on the phone.

## Sources informing the structure

These are original, general preparation routines informed by the progression below; they are not certified sport-specific injury-prevention protocols or individualized medical plans.

- [Johns Hopkins Medicine: soccer warmups](https://www.hopkinsmedicine.org/health/expert-qa/soccer-warmups-to-prepare-for-your-game) — dynamic movements and preparation for running/changing direction.
- [USTA: dynamic warmup and flexibility](https://www.usta.com/en/home/improve/tips-and-instruction/national/dynamic-warm-up-and-flexibility-training.html) — pre-practice/competition movement preparation.
- [FIBA WABC coaching manual, level 2](https://assets.fiba.basketball/image/upload/documents-corporate-wabc-coaching-manual-level-2-eng.pdf) — general movement, dynamic range and sport-specific progression.
- [AAOS: safe exercise](https://www.orthoinfo.org/staying-healthy/safe-exercise/) — gradual preparation, recovery and not exercising through pain.
- [OpenAI: images and vision](https://developers.openai.com/api/docs/guides/images-vision) — image inputs and visual-model limitations.
- [Expo SDK 57 ImagePicker](https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/) and [ImageManipulator](https://docs.expo.dev/versions/v57.0.0/sdk/imagemanipulator/) — native picker and conversion APIs included in Expo Go.
