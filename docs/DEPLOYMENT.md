# Hosting and iOS distribution

The shared UI remains in `src/`. The hosting/build targets use the same UI:

- **Vercel:** Vite builds static `dist/`; `api/[...path].ts` runs the existing Fastify photo/activity routes as a Node function. No development server or Expo process runs on Vercel.
- **Docker:** Nginx serves the same production UI and proxies `/api/` to a private Node container. Only port 8080 is published.
- **iOS:** `expo/` builds the native launcher with camera, photo selection, SQLite, haptics, timers and sharing. It loads your stable HTTPS hosted URL rather than your computer. Internet is required to load the UI and use AI; this is not an offline-bundled native UI.

## Existing Railway service

The user supplied `https://aifitnesstracker-production.up.railway.app`. The root `Dockerfile` and `railway.json` provide a **single container** with the built UI and API on the same port, suitable for this service. The Docker Compose variant below uses separate web/API containers.

In Railway, connect this repository and `claude/ink-design`, use the repository root, remove any old custom start command, and use the root Dockerfile. Set `OPENAI_API_KEY` as a Railway service variable (and optionally the two photo model variables). Railway's injected `PORT` is respected. Configure the public domain's target port to match the running service and verify `/api/health` plus the homepage after deployment. No data from an existing Railway database/service is migrated or deleted by these files.

Once this domain serves the verified Tally Ink UI, use `EXPO_PUBLIC_INK_URL=https://aifitnesstracker-production.up.railway.app` in the Expo environments instead of a Vercel URL. A public domain alone does not provide access to change the Railway project, connect GitHub, or read its deployment status.

The preview and production build profiles already set this public Railway URL. At preparation time the existing domain returned HTTP 200 with title **Calorie Tracker**, not the selected Tally build. Deploy and verify the new host before creating mobile distribution builds. If you move hosting to Vercel, update both profile URLs first.

For a single local container instead of Compose: `docker build -t tally .`, then `docker run --rm -p 8080:8080 --env-file server/.env tally`. The API key is injected at runtime, not built into the image.

## Vercel

1. Import `sparshvedi-wq/AIFitnessTracker` into your Vercel account. Select `claude/ink-design` for the version prepared here and use the repository root, not `expo/` or `server/`.
2. `vercel.json` configures installation, Vite output, Node API duration and SPA routing. Select Node 24 in project settings. Set `OPENAI_API_KEY` in Vercel's server environment; optionally set `OPENAI_PHOTO_MODEL` and `OPENAI_PHOTO_QUALITY_MODEL` as in `server/.env.example`.
3. Deploy a preview, verify `/api/health`, navigate the UI and run a consented real photo review. Then assign a stable production domain. Never put provider secrets in `VITE_*` or `EXPO_PUBLIC_*` variables.
4. Set the same stable production URL for the Expo build below. Changing a native build's public environment value requires a new native build.

New photo selections retain 1536px / JPEG .82 when they fit. Oversized selections reduce JPEG quality, then dimensions, until each data URL is at most 1.2 million characters. Three views fit below the 4.5 MB Vercel function payload limit. A request guard rejects oversized older drafts before upload; replace their photos. The quality/accuracy impact of additional compression has not been evaluated.

The handler supports both platform-parsed JSON and a raw Node request stream. It caches a Fastify instance within each function instance and disables synthetic fixture requests in production. Existing rate/concurrency limits are **per instance**, not a global usage budget. The app currently has no production user authentication or shared AI quota store. Add authenticated, durable per-user usage enforcement before opening paid AI endpoints to a public launch. Origin checks alone do not provide authentication.

## Docker

Install Docker Desktop (not currently installed on the audited computer). Copy `server/.env.example` to `server/.env` if needed and add the server key locally. From the repository root:

```powershell
docker compose up --build -d
docker compose ps
```

Open `http://localhost:8080`, or your PC's LAN address on port 8080. Verify `http://localhost:8080/api/health`. Containers do not contain `.env` files; Compose injects the local runtime environment. Photos are processed in memory; app data stays in each browser/device's existing local store. Container restarts do not migrate or combine user data. For remote use, terminate HTTPS at a reverse proxy/load balancer and configure your domain; local HTTP is not an App Store production endpoint.

Vercel uses the function deployment above, **not these Docker images**. The container stack is an alternative runnable deployment, not a container launched inside the Vercel function.

## TestFlight and App Store

From `expo/`, use the Expo account that will own this app:

```powershell
npx.cmd eas-cli login
npx.cmd eas-cli init
```

The EAS **preview** and **production** profiles set `EXPO_PUBLIC_INK_URL` to your Railway domain. If changing hosts, replace it in both profiles (or consistently configure the EAS environments). `app.config.js` rejects EAS builds without HTTPS. The default bundle ID is `com.sparshvedi.tally`; set `TALLY_APP_IDENTIFIER` to your chosen unique ID before registering the app, and keep it fixed afterward. EAS initialization supplies the real project ID; this repository does not invent one.

```powershell
npx.cmd eas-cli build --platform ios --profile preview
npx.cmd eas-cli build --platform ios --profile production
npx.cmd eas-cli submit --platform ios --profile production
```

Preview is internal distribution and requires registered test devices. A production build uploaded through EAS Submit is available for processing in App Store Connect/TestFlight; it does not automatically publish to the App Store. An Apple Developer membership, signing credentials, a matching App Store Connect app record, privacy/support URLs, correct privacy disclosures, icons/screenshots and App Review are still required. Review the current Apple requirements for minimum functionality and remotely delivered WebView content; approval is not guaranteed by a successful build. The nine previously audited functional issues also remain outstanding.

## Verification boundaries

Automated verification covers the production web build, app/server tests, serverless handler HTTP routing/body limits and Expo configuration/typechecking. Actual Vercel deployment, Linux Docker builds, signed iOS builds and physical-device/TestFlight testing require their respective services and are not established by those local checks.

Official references: [Vercel function limits](https://vercel.com/docs/functions/limitations), [Fastify serverless guidance](https://fastify.dev/docs/latest/Guides/Serverless/), [EAS configuration](https://docs.expo.dev/eas/json/), [iOS submission](https://docs.expo.dev/submit/ios/), [Apple review guidelines](https://developer.apple.com/app-store/review/guidelines/).
