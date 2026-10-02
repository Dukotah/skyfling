# Skyfling

Ad-free 3D slingshot-plane game for iPhone, shipped as an installable PWA (add to home screen → launches fullscreen, runs offline). No App Store, no accounts, no ads, no IAP.

Start with `docs/ARCHITECTURE.md` (binding contracts), then `docs/ROADMAP.md` (foundation-first build order with evidence gates), `docs/ART.md` (art direction + quality bar), `docs/GDD.md` (design + balance), `docs/AUDIT.md` (state of the codebase). Decisions in `docs/DECISIONS.md`; session prompts in `prompts/FABLE_BUILD_PROMPTS.md`. The working prototype to port physics from is `legacy/skyfling-v5-prototype.html`.

## Develop

```bash
npm install
npm run assets      # one-time: fetch + convert the CC0/CC-BY asset packs into public/ (see docs/ASSETS.md)
npm run gen:icons   # one-time: generate PWA icons into public/
npm run dev         # http://localhost:5173
```

Debug routes (hash): `#debug/stats` (aim screen + perf overlay), `#debug/fly?biome=blue-coast&night=1` (free-fly dolly through a biome), `#debug/autopilot` (scripted full run to the results card), `#debug/hangar`, `#debug/plane?plane=hornet&paint=racer` (plane viewer), `#debug/results?dist=1500`. Query flags: `?quality=low|medium|high`, `?dpr=0.5` (harness render scale).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check (`tsc --noEmit`) then production build to `dist/` |
| `npm run preview` | Serve the production build on :4173 |
| `npm run test` | Vitest unit tests (`src/**/*.test.ts`) — locks balance numbers |
| `npm run smoke` | Playwright smoke + screens suites on the iPhone-12 profile (builds + previews first); writes `docs/screens/latest/` |
| `npm run assets` | Fetch/convert all third-party assets and regenerate the manifest + CREDITS.txt |
| `npm run lint` | ESLint |
| `npm run gen:icons` | Regenerate PWA icons from the inline SVG mark |

## Deploy

Pushes to `main` auto-deploy on Vercel (framework: Vite, output `dist/`). Open the preview URL on your phone and **Share → Add to Home Screen** to install.

## Install on iPhone

1. Open the Vercel URL in Safari.
2. Tap the Share icon → **Add to Home Screen**.
3. Launch from the home-screen icon — it opens fullscreen like a native app and works offline.
