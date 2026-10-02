# Skyfling — Claude Code project brief

Skyfling is an ad-free, free-to-play 3D slingshot-plane game for iPhone Safari (installed as a PWA from the home screen, no Apple developer account). The reference is **Epic Plane Evolution** (Voodoo / MWM, iOS): pull back a slingshot, one thumb holds to lift and releases to glide, fly through glowing rings, collect coins, upgrade, watch the plane evolve. We are building something that looks and plays at or above that bar, with more maps, more "soft wall" obstacles, more planes and more upgrades.

The owner (Duke) plays on an iPhone and reviews builds on a Vercel URL. He does not want clarifying questions on creative decisions. Make the call, ship it, note what you decided in `docs/DECISIONS.md`.

## Read first, in this order
1. `docs/ARCHITECTURE.md` — the contracts. Binding. Layer import direction, one-file-per-item content registries, `FlightEnv`/`WorldQuery` as the only bridge from world to physics, typed event bus, seeded run recorder, evidence gates.
2. `docs/ROADMAP.md` — foundation-first build order with a gate per phase. Work the next unticked item.
3. `docs/ART.md` — art direction, rendering stack and the **Quality bar**. Graphics are the top priority; a screenshot that fails the bar fails the gate.
4. `docs/GDD.md` — game design and the balance numbers.
5. `docs/AUDIT.md` — what exists, what is salvaged, what is replaced, platform facts (iOS Safari).
6. `docs/ASSETS.md` — CC0/CC-BY packs to download and where from.
7. `prompts/FABLE_BUILD_PROMPTS.md` — the session prompts that execute the roadmap.

`docs/DESIGN_BIBLE.md` is the v2+ backlog; nothing in it is built before v1.0 unless the roadmap names it. `legacy/skyfling-v5-prototype.html` is the working single-file prototype: **port its physics, balance, missions, upgrades, ghost, combo and storm-front logic**; do not port its hand-drawn geometry or its CSS.

## Non-negotiables
- No ads, no IAP, no accounts, no server. Everything is local (localStorage + IndexedDB save with export/import as a code).
- Must run at a solid 60 fps on an iPhone 12 and 30+ on an iPhone X in Safari. Performance budget is a feature: ≤150 draw calls in flight, ≤400k triangles, ≤25 MB precached. WebGL2 baseline (`WebGLRenderer`); WebGPU is a later optional tier.
- Installs as a PWA (manifest, service worker precaching all assets, fullscreen, portrait-first with landscape support).
- Single `npm run dev` / `npm run build`. Vite + TypeScript + three.js. No React for the game loop. UI is DOM/CSS over the canvas.
- Default control scheme is one-thumb hold-to-climb / release-to-glide (GDD §3 "Glide"); the floating joystick is the optional "Pilot" scheme. Both emit the same `FlightInput`.
- `src/sim/flight.test.ts` balance locks (292 / 2661 / 8157 m) stay exact. Change them only together with the GDD numbers and a DECISIONS entry.
- Haptics are a no-op on iOS Safari; every haptic beat also has a visual and audio beat.

## Repo layout (target; see ARCHITECTURE §1 for the import rules)
```
src/
  main.ts            boot only (<80 lines)
  data/              content registries, one file per item (biomes/ planes/ upgrades/ pickups/ hazards/ softwalls/ missions/ achievements/ paints/ props/)
  sim/               flight physics, soft-wall forces, collision (pure, vitest, balance-locked)
  world/             seeded terrain, biome sequencing, chunk streaming (worker), spawners, WorldQuery
  render/            renderer facade + quality tiers, atmosphere, terrain, water, instancer, materials, plane, post, particles, trails, camera, juice
  ui/                DOM screens, one module per screen (boot, hangar, aim, hud, results, pause, settings, controls, callouts)
  game/              state machine, RunState, events, recorder/ghost, missions/achievements runtime, economy
  assets/            typed manifest, loader with progress, KTX2/Draco/meshopt
  audio/             synth engine, sample SFX, music beds
  save/              versioned save, migrations/, adapters, store (localStorage + IndexedDB)
  debug/             hash-route debug scenes, perf HUD, autopilot
public/
  models/ textures/ hdr/ audio/ fonts/   (downloaded CC0/CC-BY assets via scripts/assets-fetch.mjs; CREDITS.txt generated)
docs/                ARCHITECTURE, ROADMAP, ART, GDD, AUDIT, ASSETS, DECISIONS, DESIGN_BIBLE (v2 backlog), screens/<phase>/
prompts/             FABLE_BUILD_PROMPTS (current), CLAUDE_CODE_PROMPTS (superseded)
scripts/             gen-icons, assets-fetch, check-budget
legacy/              prototype to port from
```

## Working agreements
- Commit after every completed roadmap item with a message that names the item. Push to the branch you were given (`main` if none); Vercel auto-deploys from `main`.
- Keep `docs/DECISIONS.md` as a dated log of choices you made that the spec left open.
- Adding content never touches the engine: a biome, plane, pickup, hazard, soft wall, upgrade, mission or achievement is one new file in its registry folder (plus manifest entries for its assets). If it needs an engine change, change the contract in ARCHITECTURE first and log it.
- Every system in `src/sim` and `src/world` has a vitest test. Randomness goes through the run's seeded PRNG so replays and ghosts are exact.
- Asset license: CC0 or CC-BY only. Record every pack and its license in `docs/ASSETS.md`; `public/CREDITS.txt` is generated from the manifest.
- Prefer instanced meshes and merged geometry for scenery.
- A phase is done only when `npm run lint && npm run test && npm run build && npm run smoke` pass, the gate screenshots are in `docs/screens/<phase>/` at 390×844 with zero console errors and the draw-call budget read from `renderer.stats()`, and the roadmap is ticked. Evidence over claims; report failures as failures.
