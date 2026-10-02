# Skyfling

Ad-free 3D slingshot-plane game for iPhone, shipped as an installable PWA (add to home screen → launches fullscreen, runs offline). No App Store, no accounts, no ads, no IAP.

Design spec lives in `docs/` (`GDD`, `ART`, `ASSETS`, `ROADMAP`), decisions in `docs/DECISIONS.md`, Claude Code prompts in `prompts/`. The working prototype to port physics from is `legacy/skyfling-v5-prototype.html`.

## Develop

```bash
npm install
npm run gen:icons   # one-time: generate PWA icons into public/
npm run dev         # http://localhost:5173
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check (`tsc --noEmit`) then production build to `dist/` |
| `npm run preview` | Serve the production build on :4173 |
| `npm run test` | Vitest unit tests (`src/**/*.test.ts`) — locks balance numbers |
| `npm run smoke` | Playwright smoke test on an iPhone-12 viewport (builds + previews first) |
| `npm run lint` | ESLint |
| `npm run gen:icons` | Regenerate PWA icons from the inline SVG mark |

## Deploy

Pushes to `main` auto-deploy on Vercel (framework: Vite, output `dist/`). Open the preview URL on your phone and **Share → Add to Home Screen** to install.

## Install on iPhone

1. Open the Vercel URL in Safari.
2. Tap the Share icon → **Add to Home Screen**.
3. Launch from the home-screen icon — it opens fullscreen like a native app and works offline.
