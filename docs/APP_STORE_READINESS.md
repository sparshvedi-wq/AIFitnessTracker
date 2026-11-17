# Tally — App Store readiness and legal/policy audit

Audit date: 10 November 2026 · Branch `claude/ink-design` @ `5043836` · Scope: `src/` (Ink app), `expo/` (native launcher), `server/` + `api/` (the hosted service the app calls).

> **This is not legal advice.** It is an engineering audit against published store policies and a plain-language summary of laws that commonly apply to fitness apps. Laws differ by country and state, several of the rules below are new or in litigation, and some sources were read in summary form (noted where it matters). Before launch, have a privacy lawyer review the privacy policy, the teen (13–17) flows and the OpenAI data flow.

Status key: **PASS** = evidence in the code meets the item · **FAIL** = missing or contradicts the rule · **PARTIAL** = some of it is there · **UNKNOWN** = cannot be decided from the repo (store-console setting, legal judgement or build output) · **N/A** = does not apply to this app as built.

---

## 1. What the app actually is (facts the checklist depends on)

| Fact | Evidence |
|---|---|
| The store binary is a thin native shell around a **WebView that loads the whole UI from a remote HTTPS URL** (`EXPO_PUBLIC_INK_URL`, set to `https://aifitnesstracker-production.up.railway.app` for preview and production builds). Without internet the app shows only "We couldn't reach Tally". | `expo/App.tsx:183-205`, `expo/eas.json:4-5`, `expo/app.config.js:2-5` |
| Native features the shell adds: on-device key-value storage (SQLite), camera/photo picker, local notifications for timers, haptics, speech, keep-awake, share sheet, backup file export/import. | `expo/App.tsx:7-16`, `expo/App.tsx:79-120`, `expo/src/device-service.ts:85-158` |
| **No accounts, no sign-in, no analytics SDK, no ads, no tracking, no in-app purchases or subscriptions.** | No auth, analytics, ad or IAP code in `src/` or `expo/` (searched for `fetch(`, `login`, `account`, `purchase`, `subscri`, analytics SDKs); `expo/package.json:10-30` contains no such SDK |
| Training data (workouts, routines, bodyweight, goal, experience, age group, gender, first name, pain/soreness areas, sport schedule) is stored **only on the device**: `localStorage` in the browser, SQLite KV store in the native app. | `src/lib/storage.js:69-72`, `src/lib/storage.js:128`, `expo/App.tsx:82-84`, `expo/src/device-service.ts:89-95` |
| Photo check-in previews are stored on the device (IndexedDB in the browser, native KV store in the app), last 20 kept. | `src/lib/photo-store.js:1-60`, `expo/src/device-service.ts:96-110` |
| **Data that leaves the device** (all to the app's own server, which forwards to **OpenAI**): | |
| · Photo quality check — one body photo, angle, self-reported age band. | `src/components/training/PhotoCheckins.jsx:156-165`, `server/src/app.ts:121-154`, `server/src/photo/analyze.ts:14-35` |
| · Photo review — three body photos (front/side/back), goal text, focus preferences, age band. | `src/components/training/PhotoCheckins.jsx:290-320`, `server/src/app.ts:155-200`, `server/src/photo/analyze.ts:38-106` |
| · Activity interpretation — free-text activity description. | `src/components/training/TrainingEvents.jsx:109-123`, `server/src/activity.ts:12-20` |
| · "Ask or adjust" language help — typed sentence, date, time zone, place names, exercise names, random per-device ID. **Off by default** (needs `VITE_ASSIST_AI=on` at build and `ASSIST_AI_ENABLED=true` on the server; neither is set in `Dockerfile`/`eas.json`). | `src/lib/assistant/remote.js:12-29`, `src/lib/assistant/remote.js:84-98`, `server/src/app.ts:50-56` |
| Server does not log requests and does not persist photos; OpenAI calls use `store: false`. **But OpenAI keeps API inputs in abuse-monitoring logs for up to 30 days by default** unless the organisation is approved for Zero Data Retention ([OpenAI: your data](https://developers.openai.com/api/docs/guides/your-data)). | `server/src/app.ts:44-45`, `server/src/photo/analyze.ts:18,44`, `server/src/activity.ts:15` |
| Teen (13–17) safeguards: weight-loss goal hidden and coerced to "General fitness"; physique options limited; guardian-permission checkbox before AI photo review, enforced again on the server; teens cannot apply photo-derived focus; AI prompt has teen and anti-body-shaming rules. | `src/components/training/TrainingProfile.jsx:377,448-453`, `src/lib/planner.js:105`, `src/lib/physique-preferences.js:24`, `src/components/training/PhotoCheckins.jsx:636-645,794`, `server/src/photo/schema.ts:24-26`, `server/src/photo/analyze.ts:47-56` |
| Age question offers only **"13-17" and "18+"**, with **"18+" preselected by default**; there is no under-13 answer and the question can be passed without changing it. | `src/components/training/TrainingProfile.jsx:441-457`, `src/lib/planner.js:41`, `src/components/training/TrainingProfile.jsx:326-332` |

---

## 2. Checklist and status

### A. Apple App Store — App Store Connect metadata and submission

| # | Requirement | Status | Evidence / notes |
|---|---|---|---|
| A1 | **Privacy policy URL** in App Store Connect and an easily reachable link **inside the app** ([Guideline 5.1.1(i)](https://developer.apple.com/app-store/review/guidelines/#5.1.1)). | **FAIL** | No privacy policy exists in the repo (`public/` has only `tally.svg`, `onboarding/`, `exercise-guides/`), and no in-app link. The only privacy text is a collapsed note in the photo flow (`src/components/training/PhotoCheckins.jsx:650-656`) and "Stored on this device" under Your data (`src/pages/You.jsx:332-334`). |
| A2 | **Support URL** (required App Store Connect field) and contact details. | **FAIL / UNKNOWN** | No support page or contact address in the repo or app. |
| A3 | **App Privacy ("nutrition label")** answered accurately ([App privacy details](https://developer.apple.com/app-store/app-privacy-details/)). Data is "collected" if you **or your third-party partners** can access it longer than needed to service the request; OpenAI's 30-day log retention means the transient-processing exemption most likely does **not** apply. | **UNKNOWN (console)** — expected answers below | Likely declarations: **Photos or Videos** (photo check-ins), **Other User Content** (goal text, activity description, typed assistant text if enabled), possibly **Health & Fitness → Fitness** (goal/focus sent with photos), **Device ID** only if the assistant is enabled (`src/lib/assistant/remote.js:18-29`). Purpose: App Functionality. Linked to user: likely *No* (no account/IDs sent with photos) — confirm with counsel. Tracking: *No*. Optional-feature exemption applies only if **all** of Apple's criteria are met; do not rely on it. |
| A4 | **Age rating questionnaire** (new 4+/9+/13+/16+/18+ system; answers were mandatory from 31 Jan 2026) ([Apple news](https://developer.apple.com/news/?id=ks775ehf), [age-rating definitions](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions)). | **UNKNOWN (console)** | Answer "Health or wellness topics" = yes (training, bodyweight). The app is designed for 13+, so **set the rating to at least 13+** even if the questionnaire computes 9+, so it is not presented to under-13s. Do **not** enter the Kids category. |
| A5 | Accurate metadata, real screenshots, specific review notes ([2.3](https://developer.apple.com/app-store/review/guidelines/#2.3)); no placeholder content ([2.1](https://developer.apple.com/app-store/review/guidelines/#2.1)). | **UNKNOWN / PARTIAL** | Dev-only tools are gated behind `import.meta.env.DEV` (`src/pages/You.jsx:276`, `src/components/training/PhotoCheckins.jsx:697`). Review notes must explain the AI photo review, that the server must be up, and how to try it without real body photos. App display name is `Tally · Ink` (`expo/app.json:3`) — decide the store name and check it is available/not confusingly similar to existing "Tally" apps. |
| A6 | **App icon** (1024 px, no alpha) and launch screen. | **FAIL** | `expo/app.json` has no `icon`, `splash` or `ios.icon`; `expo/` has no `assets/` folder, so builds would use Expo's default icon. |
| A7 | Bundle ID registered and unique. | **PARTIAL** | Defaults to `com.tallyfitness.app` (`expo/app.config.js:6-10`); confirm it is registered under the publishing team. |
| A8 | Build with **Xcode 26 / iOS 26 SDK** (required since 28 Apr 2026) and target iOS 13+ ([upcoming requirements](https://developer.apple.com/news/upcoming-requirements/)). | **UNKNOWN (likely PASS)** | Expo SDK 58 (`expo/package.json:12`) with EAS cloud builds should meet this; confirm on the first EAS production build. |
| A9 | **Privacy manifest** (`PrivacyInfo.xcprivacy`) with required-reason APIs for app + SDK code (required since 1 May 2024) ([privacy manifest docs](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files)). | **UNKNOWN** | No `ios.privacyManifests` in `expo/app.json`. Expo modules ship their own manifests; inspect the generated `PrivacyInfo.xcprivacy` after `eas build` / `expo prebuild` and fix any App Store Connect warning (e.g. UserDefaults, file timestamp). |
| A10 | **Export compliance** — declare encryption use. HTTPS-only apps normally qualify for the exemption ([overview of export compliance](https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance)). | **FAIL (minor)** | Not set; add `ios.config.usesNonExemptEncryption: false` in `expo/app.json` (after confirming the app uses only OS-provided HTTPS) to avoid the per-build prompt. |
| A11 | **EU trader status** (Digital Services Act) declared in App Store Connect; traders' address/phone/email shown publicly in the EU. | **UNKNOWN (console)** | Needed to distribute in the EU at all. Decide individual vs. organisation enrolment first: an individual account shows your personal name as the seller. |
| A12 | Accessibility Nutrition Labels. | **UNKNOWN (optional)** | Voluntary today. Lint includes `eslint-plugin-jsx-a11y` (`package.json:30`); VoiceOver/Dynamic Type inside the WebView has not been verified on a device. |

### B. Apple App Review Guidelines — design and functionality

| # | Requirement | Status | Evidence / notes |
|---|---|---|---|
| B1 | **Minimum functionality / not a repackaged website** ([4.2, 4.2.2](https://developer.apple.com/app-store/review/guidelines/#4.2)). | **RISK (PARTIAL)** | The binary loads the full UI from a public website (`expo/App.tsx:183-205`). Native integrations (camera picker, notifications, haptics, speech, keep-awake, file export) help, but reviewers often reject apps that are "the same as the website". The same app is publicly reachable in a browser at the Railway URL. |
| B2 | **No downloaded code that changes features** without review ([2.5.2](https://developer.apple.com/app-store/review/guidelines/#2.5.2)). | **RISK** | All app logic is JavaScript fetched at launch, so features change on every web deploy without App Review. Web content in WKWebView is common and often accepted, but this is a judgement call by the reviewer. Bundling the built `dist/` into the binary (WebView loading local files) and versioning it with the app would remove both B1 and B2 risks and make the app work offline. |
| B3 | Uses WebKit for web content ([2.5.6](https://developer.apple.com/app-store/review/guidelines/#2.5.6)). | **PASS** | `react-native-webview` uses WKWebView on iOS (`expo/App.tsx:6`). Navigation is restricted to the app origin (`expo/App.tsx:187-188`). |
| B4 | **App works for the reviewer** — back end running, no crashes, stable network ([2.1](https://developer.apple.com/app-store/review/guidelines/#2.1)). | **UNKNOWN** | Requires the Railway server and a funded `OPENAI_API_KEY` during review (`server/src/app.ts:69-72`). With no network the app is unusable (`expo/App.tsx:183`). |
| B5 | **Medical/health accuracy and "check with a doctor" reminder** ([1.4.1](https://developer.apple.com/app-store/review/guidelines/#1.4.1)). | **FAIL** | No health/medical disclaimer or "consult a doctor before starting exercise" text anywhere in `src/` (searched `doctor`, `medical`, `disclaimer`, `consult`). The app prescribes loads and recovery, asks about pain (`src/components/training/SessionSetup.jsx:291,551`) and makes AI body observations. The per-review "Reading limitations" list exists (`src/components/training/PhotoCheckins.jsx:887-895`) but is not a general disclaimer. |
| B6 | Physical-harm risk ([1.4](https://developer.apple.com/app-store/review/guidelines/#1.4)) — no encouragement of dangerous activity. | **PASS (judgement)** | Conservative AI prompts (`server/src/photo/analyze.ts:47-89`, `server/src/activity.ts:16`); teen weight-loss goal removed (`src/components/training/TrainingProfile.jsx:377`, `src/lib/planner.js:105`). |
| B7 | AI-generated content / user-generated content controls ([1.2](https://developer.apple.com/app-store/review/guidelines/#1.2)). | **PARTIAL** | No user-to-user content, so most of 1.2 does not apply. AI output is constrained by schema (`server/src/photo/schema.ts`). There is no in-app way to report a bad AI review (also a Google requirement, see G5). |
| B8 | In-app purchase for digital features ([3.1.1](https://developer.apple.com/app-store/review/guidelines/#3.1.1)). | **N/A** | No paid features. If AI reviews are later paywalled, IAP is required. |
| B9 | Notification permission requested in context, app works without it ([4.5.4](https://developer.apple.com/app-store/review/guidelines/#4.5.4), 5.1.1(iv)). | **PASS** | Asked only when a timer cue is scheduled; failure returns `null` (`expo/App.tsx:29-37,94-100`). |

### C. Privacy and data (Apple 5.1 and Google User Data policy)

| # | Requirement | Status | Evidence / notes |
|---|---|---|---|
| C1 | **Permission purpose strings** are present and explain the use ([5.1.1(ii)](https://developer.apple.com/app-store/review/guidelines/#5.1.1)). | **PARTIAL** | Camera and Photos strings set; microphone disabled (`expo/app.json:24`). They do not say photos may be sent for AI review; consider "…Photos stay on this device unless you choose an AI review." |
| C2 | **Explicit, informed consent before sending personal data to third-party AI** ([5.1.2(i)](https://developer.apple.com/app-store/review/guidelines/#5.1.2), Nov 2025 update — [TechCrunch](https://techcrunch.com/2025/11/13/apples-new-app-review-guidelines-clamp-down-on-apps-sharing-personal-data-with-third-party-ai)). | **PARTIAL** | Good: unchecked opt-in checkbox naming OpenAI before any photo upload (`src/components/training/PhotoCheckins.jsx:622-634`), required by the server too (`server/src/photo/schema.ts:14`); activity text has its own OpenAI opt-in (`src/components/training/TrainingEvents.jsx:363-372`); "Use photos without AI" alternative (`src/components/training/PhotoCheckins.jsx:678`). Gaps: (1) what is sent (goal text, focus, age band) and **OpenAI's up-to-30-day retention** are not disclosed — the copy "our server does not save your photos" (`PhotoCheckins.jsx:654-655`) is true but incomplete; (2) the disclosure is inside a collapsed `<details>` (`PhotoCheckins.jsx:650`); (3) no link to the privacy policy; (4) the "Ask or adjust" assistant sends typed text to OpenAI with **no disclosure or consent** if it is ever enabled (`src/lib/assistant/remote.js:84-98`; no OpenAI copy in `src/components/AskAdjust.jsx`). |
| C3 | **Data minimisation** ([5.1.1(iii)](https://developer.apple.com/app-store/review/guidelines/#5.1.1)). | **PASS** | Photos are resized, EXIF dropped (`expo/App.tsx:136-148`); assistant payload limited to 200 chars and names (`src/lib/assistant/remote.js:88-96`); gender is never sent off device. Uses system photo picker. |
| C4 | Alternatives when consent is declined ([5.1.1(iv)](https://developer.apple.com/app-store/review/guidelines/#5.1.1)). | **PASS** | Photos can be saved without AI (`PhotoCheckins.jsx:678`); activity impact can be set manually (`server/src/app.ts:95-99` messages; manual muscle choice in `TrainingEvents.jsx`). |
| C5 | **Account deletion in app** ([5.1.1(v)](https://developer.apple.com/app-store/review/guidelines/#5.1.1), [Apple support](https://developer.apple.com/support/offering-account-deletion-in-your-app/)); Google account-deletion URL. | **N/A** | No accounts. Becomes mandatory the day accounts or cloud sync are added. |
| C6 | **User can delete their data** (good practice; needed for GDPR/state-law rights and for Google's Data safety deletion answer). | **PARTIAL** | "Erase all data" with confirmation (`src/pages/You.jsx:327-330,388-398`) resets state, clears the photo draft and deletes stored previews (`src/store/AppContext.jsx:150-151,179-186`). Gaps: the **legacy save key `calorie-tracker:v1` is read but never deleted** (`expo/src/protocol.js:5`, `src/lib/storage.js:70-71`, `expo/src/device-service.ts:91`), so data from older builds survives "Deletes everything"; `tally:assist-client`, `tally:theme`, `tally:seen-marks` in `localStorage` are not cleared (`src/lib/assistant/remote.js:10`, `src/App.jsx:61`, `src/components/HomeOverview.jsx:49`). Data already sent to OpenAI cannot be deleted from the app (retention ≤ 30 days). |
| C7 | User can export/access their data. | **PASS** | JSON export/restore (`src/pages/You.jsx:313-326`, `expo/App.tsx:102-118`). Backups exclude photos (`src/pages/You.jsx:333`), which is disclosed. |
| C8 | Data encrypted in transit. | **PASS (build-enforced)** | EAS builds refuse non-HTTPS URLs (`expo/app.config.js:3-5`); API calls are same-origin relative paths over that HTTPS origin. |
| C9 | Health/fitness data not used for ads or data mining; disclosed ([5.1.3](https://developer.apple.com/app-store/review/guidelines/#5.1.3)). | **PASS** (disclosure FAIL via A1) | No ads/analytics. HealthKit not used (no references in `src/` or `expo/`). |
| C10 | No tracking / ATT prompt needed. | **PASS** | No tracking SDKs or cross-app identifiers. |

### D. Minors (the app supports 13–17)

| # | Requirement | Status | Evidence / notes |
|---|---|---|---|
| D1 | **Not directed to under-13s; don't knowingly collect from them** (US [COPPA](https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa); amended rule enforceable since 22 Apr 2026 — [Hunton](https://www.hunton.com/privacy-and-cybersecurity-law-blog/coppa-rule-amendment-compliance-deadline-approaches)). | **PARTIAL** | Content is not child-directed. But the age screen is **not neutral**: "18+" is preselected (`src/lib/planner.js:41`) and there is no "Under 13" choice (`src/components/training/TrainingProfile.jsx:443`). FTC guidance favours a neutral age screen that lets a child state their real age, with under-13 blocked from features that collect data (the AI uploads). Pair with a 13+ store rating (A4). |
| D2 | **Parental consent for teen AI photo processing** — store/OpenAI expectations and some laws. | **PARTIAL** | Self-attested guardian checkbox (`PhotoCheckins.jsx:636-645`), enforced server-side (`server/src/photo/schema.ts:24-26`). Self-attestation is weak evidence of consent. Note OpenAI's [Under-18 API guidance](https://developers.openai.com/api/docs/guides/safety-checks/under-18-api-guidance): safeguards required for under-18s, and **personal data of children below the applicable age of digital consent (up to 16 in some EU countries) must not be processed without Zero Data Retention**. ZDR is not enabled (server only sets `store:false`). |
| D3 | **State "app store accountability" laws** (Texas SB 2420; similar Utah/Louisiana laws): developers use the store's age-range signal and respect parental consent/revocation ([Apple: next steps for Texas](https://developer.apple.com/news/?id=2ezb6jhj), [MacRumors on iOS 26.2 APIs](https://www.macrumors.com/2025/11/04/ios-26-2-texas-age-verification-law/)). | **UNKNOWN / FAIL** | No use of Apple's **Declared Age Range** API or Google's Play Age Signals API. Because the UI is a WebView, this needs a native module plus a bridge method. Enforcement status has moved through the courts in 2026 — get counsel's view on whether to integrate before launch. |
| D4 | **UK Children's Code / EU GDPR Art. 8** (services likely to be used by under-18s: high-privacy defaults, DPIA; parental consent below the national digital-consent age, 13–16). | **UNKNOWN (legal)** | Defaults are already private (local storage, AI off until opted in). A written DPIA and age-appropriate privacy notice are not in the repo. |
| D5 | Age-appropriate content for teens. | **PASS** | See section 1 teen safeguards; prompt bans dieting/weight-loss encouragement for teens (`server/src/photo/analyze.ts:47-53`). |

### E. Privacy laws (general)

| # | Requirement | Status | Evidence / notes |
|---|---|---|---|
| E1 | **CalOPPA** — any commercial app collecting personally identifiable information from California residents must post a privacy policy. CCPA/CPRA obligations apply only above revenue/volume thresholds. | **FAIL** (same fix as A1) | No policy. CCPA thresholds likely not met by an indie launch — confirm. |
| E2 | **Washington My Health My Data Act** (and Nevada/Connecticut equivalents) — fitness/body data can be "consumer health data"; requires a separate **Consumer Health Data Privacy Policy** linked in the app and store page, consent before collection/sharing, deletion rights ([Jones Day](https://www.jonesday.com/en/insights/2023/04/my-health-my-data-washington-enacts-first-state-comprehensive-health-privacy-law)). | **FAIL / UNKNOWN (legal)** | Body photos, goals and pain/soreness inputs could qualify once sent off device (photos, goal text). The opt-in checkbox is a start; the separate policy is missing. |
| E3 | **EU/UK GDPR** — lawful basis (consent for AI review), transparency (privacy notice naming controller and OpenAI as processor, international transfer to the US), DPA with OpenAI, data-subject rights, possibly Art. 9 explicit consent if body photos/bodyweight are treated as health data. | **PARTIAL / UNKNOWN (legal)** | Consent UI exists; controller identity, legal basis, transfer mechanism and retention are not documented. Sign OpenAI's DPA (available for API customers). |
| E4 | Security of the AI endpoints. | **RISK (not a store rule)** | The API has no authentication; only per-IP rate limits and an Origin check that is skipped when no `Origin` header is sent (`server/src/app.ts:73-92`). Anyone can spend the OpenAI budget. Not a submission blocker, but relevant to the "reasonable security" duties in COPPA's amended rule and GDPR Art. 32. |

### F. Health, fitness and AI disclaimers (both stores)

| # | Requirement | Status | Evidence / notes |
|---|---|---|---|
| F1 | "Not a medical device / does not diagnose, treat, cure or prevent…" plus "consult a healthcare professional" (Google Health apps policy, Apple 1.4.1). | **FAIL** | Not present (see B5). Add to onboarding, the photo-review intro and Settings/About. |
| F2 | AI review framed as non-diagnostic with uncertainty. | **PASS** | Prompt forbids diagnoses/measurements (`server/src/photo/analyze.ts:62-68`); limitations shown (`PhotoCheckins.jsx:887-895`); copy avoids certainty upgrades (`src/lib/photo-review.js:1-28`). |
| F3 | Terms of Use / EULA. | **UNKNOWN** | Not required if you use Apple's standard EULA; a custom Terms page is recommended for AI-output and health-risk limitations. None exists. |

### G. Google Play differences

| # | Requirement | Status | Evidence / notes |
|---|---|---|---|
| G1 | **Privacy policy required for every app**, linked in Play Console and in-app, with contact details, retention and deletion policy ([User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311)). | **FAIL** | Same as A1. |
| G2 | **Data safety form** ([Data safety](https://support.google.com/googleplay/android-developer/answer/10787469)) — ephemeral processing is still declared (just hidden from the listing); declare encryption in transit and the deletion mechanism. | **UNKNOWN (console)** | Same data as A3. Note third-party AI is explicitly covered by Google's user-data rules. |
| G3 | **Health apps declaration** on the App content page; non-medical disclaimer ([Health apps](https://support.google.com/googleplay/android-developer/answer/16679511)). | **FAIL / UNKNOWN** | Declaration is a console task; disclaimer is missing (F1). |
| G4 | **Target audience & content** — declaring 13–17 is fine; including under-13 brings the Families policy ([Families](https://support.google.com/googleplay/android-developer/answer/9893335)). | **UNKNOWN (console)** | Declare 13+ only; must be consistent with the app's age handling (D1). |
| G5 | **AI-generated content** — in-app way to report offensive AI output without leaving the app ([AI-generated content](https://support.google.com/googleplay/android-developer/answer/13985936)). | **FAIL** | No report/flag control on AI photo reviews or activity interpretations. |
| G6 | **Target API level 36 (Android 16)** for new apps and updates since 31 Aug 2026 ([target API](https://support.google.com/googleplay/android-developer/answer/11926878)). | **UNKNOWN (likely PASS)** | Determined by Expo SDK 58 defaults; check the built manifest. |
| G7 | **Closed test: 12 testers for 14 consecutive days** for personal developer accounts created after 13 Nov 2023 ([testing requirement](https://support.google.com/googleplay/android-developer/answer/14151465)). | **UNKNOWN** | Plan two-plus weeks before production access. |
| G8 | **Photo/Video permissions policy** — use the system photo picker rather than broad `READ_MEDIA_IMAGES` for occasional photo selection; `SCHEDULE_EXACT_ALARM`/`USE_EXACT_ALARM` are restricted. | **UNKNOWN** | Check the merged `AndroidManifest.xml` from `expo prebuild`/EAS; block unneeded permissions via `android.blockedPermissions` in `expo/app.json`. |
| G9 | Account deletion URL. | **N/A** | No accounts. |

---

## 3. Prioritised to-do list before submission

### P0 — submission blockers (will be rejected or legally exposed without these)

1. **Write and host a privacy policy** (plus a Washington-style Consumer Health Data section) at a public non-PDF URL; link it in App Store Connect, Play Console, the onboarding flow, the photo-review consent, and a "Privacy" row under *You → Your data*. It must cover: what stays on device; what is sent (photos, goal, focus, age band, activity text) and why; OpenAI as processor, US transfer, **≤30-day OpenAI retention**; no ads/tracking; teens and guardian permission; how to delete (Erase all data) and export; contact address; controller identity. (A1, A2, E1–E3, G1)
2. **Add a health disclaimer**: "Tally is not a medical device and does not diagnose, treat, cure or prevent any condition. Check with a doctor before starting a new exercise programme, and stop if you feel pain." Show it in onboarding (with acknowledgement) and keep it in Settings/About and the photo-review intro. (B5, F1, G3)
3. **Make the AI consent fully informed**: move the "what is sent / OpenAI keeps it up to 30 days / our server does not save it" text out of the collapsed `<details>` and next to the consent checkbox, link the privacy policy, and list the goal/age band being sent. If "Ask or adjust" language help will ship enabled, add the same disclosure and opt-in first. (C2)
4. **Fix the age screen**: no preselected age, add "Under 13" that is blocked from the AI features (or from the app), and set the store age rating to 13+. Decide with counsel whether teen AI photo review should stay at launch — if it does, apply for **OpenAI Zero Data Retention** (required by OpenAI for users under the local digital-consent age) and get legal sign-off on guardian consent. (D1, D2, A4)
5. **App icon and launch screen** in `expo/app.json`. (A6)
6. **Fill the console declarations accurately**: App Privacy label, age rating questionnaire, EU trader status, export compliance (`usesNonExemptEncryption: false`), Google Data safety, Health apps declaration, Target audience (13+). (A3, A4, A10, A11, G2–G4)

### P1 — high rejection risk, do before submitting

7. **Reduce the "website in a wrapper" risk**: bundle the Vite `dist/` into the native app (load local files in the WebView, keep only `/api/*` remote), so the binary is self-contained, works offline for logging, and changes go through review. If you keep the remote URL, write review notes that list the native features. (B1, B2, B4)
8. **Add a "Report this review" control** on AI photo reviews and activity interpretations (Google requires it; helps Apple 1.2). (G5, B7)
9. **Make "Erase all data" erase everything**: also remove `calorie-tracker:v1`, `tally:assist-client`, `tally:seen-marks` (and optionally theme) in both browser and native stores. (C6)
10. **Review instructions**: keep the Railway server and OpenAI key funded during review; provide fictional sample photos or describe the demo path in review notes. (B4, A5)
11. Sharpen the camera/photos purpose strings to mention optional AI review. (C1)

### P2 — before or soon after launch

12. Decide whether to integrate Apple **Declared Age Range** / Google **Play Age Signals** for Texas/Utah/Louisiana-type laws (native module + bridge). (D3)
13. Protect the AI endpoints (app attestation or signed requests, per-device quotas) to control cost and meet "reasonable security" duties. (E4)
14. Sign OpenAI's DPA; write a short DPIA for the photo review (UK Children's Code / GDPR). (D4, E3)
15. Optional Terms of Use page covering AI-output limitations and assumption of exercise risk. (F3)
16. Verify the generated iOS privacy manifest, the Android merged manifest permissions, iOS 26 SDK / API 36 targets on the first EAS production build; run a 14-day Google closed test with 12 testers. (A8, A9, G6–G8)
17. On-device accessibility pass (VoiceOver/TalkBack, Dynamic Type in the WebView); optionally publish Accessibility Nutrition Labels. (A12)

---

## 4. What already passes (keep it)

- No accounts, ads, analytics, tracking, or IAP — which removes the account-deletion, ATT, Kids-category and IAP requirements.
- Local-first storage with export/restore and an Erase action.
- Opt-in, unchecked, OpenAI-named consent before every AI upload, enforced on the server; non-AI alternative available.
- Data minimisation: resized photos, EXIF stripped, gender never sent, assistant payload capped.
- Server keeps no logs and no photos; OpenAI calls use `store: false`.
- Teen safeguards in UI, server schema and model prompts.
- HTTPS enforced for store builds; WebView limited to the app's own origin.

## 5. Sources

Apple
- App Review Guidelines — https://developer.apple.com/app-store/review/guidelines/ (sections 1.2, 1.4.1, 2.1, 2.3, 2.5.2, 2.5.6, 3.1.1, 4.2, 4.5.4, 5.1.1–5.1.4). Sections from 4.2 onward were read via a summary of the page; check the exact wording.
- Updated App Review Guidelines (5.1.2(i) third-party AI, Nov 2025) — https://developer.apple.com/news?id=ey6d8onl; coverage: https://techcrunch.com/2025/11/13/apples-new-app-review-guidelines-clamp-down-on-apps-sharing-personal-data-with-third-party-ai
- App privacy details — https://developer.apple.com/app-store/app-privacy-details/
- Offering account deletion — https://developer.apple.com/support/offering-account-deletion-in-your-app/
- Privacy manifest files — https://developer.apple.com/documentation/bundleresources/privacy-manifest-files
- Age ratings values and definitions — https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions; updated age ratings news — https://developer.apple.com/news/?id=ks775ehf
- Upcoming requirements (Xcode 26 / iOS 26 SDK) — https://developer.apple.com/news/upcoming-requirements/
- Export compliance overview — https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance
- Texas age-assurance changes — https://developer.apple.com/news/?id=2ezb6jhj; https://www.macrumors.com/2025/11/04/ios-26-2-texas-age-verification-law/

Google Play
- Data safety — https://support.google.com/googleplay/android-developer/answer/10787469
- Health apps policy — https://support.google.com/googleplay/android-developer/answer/16679511
- Families policy — https://support.google.com/googleplay/android-developer/answer/9893335
- AI-generated content — https://support.google.com/googleplay/android-developer/answer/13985936
- Target API level — https://support.google.com/googleplay/android-developer/answer/11926878
- New personal account testing requirement — https://support.google.com/googleplay/android-developer/answer/14151465
- User Data policy — https://support.google.com/googleplay/android-developer/answer/10144311

Law and third-party AI
- FTC COPPA Rule — https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa; amended-rule compliance date — https://www.hunton.com/privacy-and-cybersecurity-law-blog/coppa-rule-amendment-compliance-deadline-approaches
- Washington My Health My Data Act summary — https://www.jonesday.com/en/insights/2023/04/my-health-my-data-washington-enacts-first-state-comprehensive-health-privacy-law
- OpenAI API data retention — https://developers.openai.com/api/docs/guides/your-data
- OpenAI Under-18 API guidance — https://developers.openai.com/api/docs/guides/safety-checks/under-18-api-guidance
- OpenAI usage policies — https://openai.com/policies/usage-policies/

*Not legal advice. Store policies change often; re-check each linked page in the week you submit.*
