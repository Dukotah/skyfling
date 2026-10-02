# Skyfling — Claude Code project brief

Skyfling is an ad-free, free-to-play 3D slingshot-plane game for iPhone Safari (installed as a PWA from the home screen). The reference is **Epic Plane Evolution** (Voodoo / MWM, iOS). We are building something that looks and plays at or above that bar, with more maps, more "soft wall" obstacles, more planes and more upgrades.

The owner (Duke) plays on an iPhone and reviews builds on a Vercel URL. He does not want clarifying questions on creative decisions. Make the call, ship it, note what you decided in `docs/DECISIONS.md`.

## Non-negotiables
- No ads, no IAP, no accounts, no server. Everything is local (localStorage save with export/import as a code).
- Must run at a solid 60 fps on an iPhone 12 and 30+ on an iPhone X in Safari. Performance budget is a feature. Profile on real device via Vercel preview URL.
- Installs as a PWA (manifest, service worker precaching all assets, fullscreen, portrait-first with landscape support).
- Single `npm run dev` / `npm run build`. Vite + TypeScript + three.js. No React for the game loop. UI is DOM/CSS over the canvas (fast, crisp, accessible).
- Read `docs/GDD.md` (game design), `docs/ART.md` (art direction + rendering stack), `docs/ASSETS.md` (what to download and where from), `docs/ROADMAP.md` (build order). These are the spec. `legacy/skyfling-v5-prototype.html` is the working single-file prototype: **port its physics, balance, missions, upgrades, ghost, combo and storm-front logic**; do not port its hand-drawn geometry or its CSS.

## Repo layout
```
src/
  main.ts            boot, loop, resize, visibility pause
  game/              state machine (hangar → aim → fly → results), run state
  sim/               flight physics (pure functions, unit-tested with vitest)
  world/             biomes, terrain generator, chunk streaming, pickup spawning, storm fronts
  render/            renderer setup, post stack, sky, water, lighting, particles, trails
  assets/            GLTF/texture loader + manifest, instancing helpers
  ui/                DOM HUD, hangar, results, modals (vanilla TS, one module per screen)
  audio/             WebAudio SFX + music bed per biome
  save/              versioned save, migrations, export/import
public/
  models/ textures/ hdr/ audio/   (downloaded CC0 assets, see docs/ASSETS.md)
docs/                GDD, ART, ASSETS, ROADMAP, DECISIONS
legacy/              prototype to port from
```

## Working agreements
- Commit after every completed roadmap item with a message that names the item. Push to `main`; Vercel auto-deploys.
- Keep `docs/DECISIONS.md` as a dated log of choices you made that the spec left open.
- Every system in `src/sim` must have a vitest test that locks balance numbers (stock flight 250–350 m, maxed 7–9 km, see `legacy/balance-sim.js`).
- Asset license: CC0 or CC-BY only. Record every pack and its license in `docs/ASSETS.md` and `public/CREDITS.txt`.
- Prefer instanced meshes and merged geometry for scenery. Target: under 150 draw calls in flight.
- Before marking a phase done, run `npm run build` and test the preview on a phone-sized viewport (Playwright, 390×844, touch) with zero console errors.
