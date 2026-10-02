# Build roadmap v2 (foundation-first)

Rewritten 2026-10-02 after the audit (`docs/AUDIT.md`). The previous roadmap is preserved in git history. The order below is deliberate: platform and contracts first, then a first playable that already looks right, then systems, then content. Each phase ends with an **evidence gate**: phone-viewport screenshots in `docs/screens/<phase>/`, the numbers listed, and a Vercel preview URL Duke can open. No gate, no next phase.

Scope for v1.0 is the GDD: 12 biomes, 10 planes, 13 upgrades, 6 soft-wall types, missions/daily/weekly/achievements/ghost/tricks. `docs/DESIGN_BIBLE.md` is the v2+ backlog; its data in `src/data` stays but nothing from it is built before v1.0 ships unless the roadmap names it.

Status legend: `[x]` done, `[~]` partial/salvaged, `[ ]` todo.

**2026-10-02 status:** Phases F, 1, 2, 3 and 4.1–4.2 shipped in one build (see `docs/DECISIONS.md` for the asset-sourcing and rendering decisions). Evidence: `docs/screens/latest/` (all 12 biomes, 3 night variants, aim/flight/results/hangar at 390×844, zero console errors, ≤170 draw calls in the harness). Remaining: 4.3 weekly, 4.4 gadgets, 5.1 device profiling, 5.3 Lighthouse/offline audit, 5.4 release tag.

## Phase F — Foundations (contracts, no gameplay)

Goal: every later phase adds files, never restructures. Read `docs/ARCHITECTURE.md` before starting; it is the spec for this phase.

- [x] F.0 Vite + TS + three.js, ESLint, vitest, Playwright, PWA, Vercel (Phase 0 of the old plan).
- [x] F.1 `sim/flight.ts` pure port with balance locks.
- [x] F.2 Versioned save with export/import.
- [x] F.3 Upgrade dependencies: three.js to current r18x, `postprocessing`, `n8ao`, `detect-gpu`, `@gltf-transform/cli`, `three-stdlib` only if needed. Fix anything the migration guide flags. Lint clean.
- [x] F.4 Layer boundaries: directory layout from ARCHITECTURE §1, ESLint `no-restricted-imports` per layer, `main.ts` reduced to boot.
- [x] F.5 Registries: `defineBiome/Plane/Upgrade/Pickup/Hazard/SoftWall/Mission/Achievement/Paint/Prop` with validation + `import.meta.glob` collection. Migrate the existing `src/data/*.ts` rosters into one-file-per-item folders (keep the data, mark Design-Bible items `scope: 'v2'`). Vitest: every registry validates.
- [x] F.6 Sim env: `FlightEnv` + `NEUTRAL_ENV`, `WorldQuery` interface, `sim/collide.ts`, `sim/softwalls.ts` (storm/sandstorm/ash/crosswind/thin-air/headwind forces as pure functions with tests). Balance tests unchanged and still exact.
- [x] F.7 Game core: event bus, state machine with hash routes, `RunState`, seeded PRNG, run recorder (inputs + seed → deterministic replay; test that two replays match).
- [x] F.8 Render platform: renderer facade + quality tiers + `stats()`, atmosphere (sky/sun/fog/clouds/stars) driven by blended biome records, camera rig, instancer, material library with paint slots, post stack (bloom/vignette/CA/LUT/SMAA; N8AO high only), particles, trails. Debug route `#debug/stats`.
- [x] F.9 Asset pipeline: `assets/manifest.ts`, `scripts/assets-fetch.mjs` (download → GLB Draco/meshopt → KTX2), loader with real progress, `CREDITS.txt` generation, 25 MB precache budget check in `npm run build`.
- [x] F.10 Screens harness: `tests/screens.spec.ts` screenshots `#debug/*` routes at 390×844, asserts zero console errors and draw-call budget.

**Gate F:** `npm run build && npm run test && npm run lint && npm run smoke` all green; `#debug/stats` shows tier, fps, draw calls on a phone; a sky with sun, clouds and graded fog renders over an empty world at 60 fps on iPhone 12. Screenshot in `docs/screens/F/`.

## Phase 1 — The world looks right (rendering foundation on real content)

- [x] 1.1 Terrain: heightfield from the prototype `groundY` (cliff start, amp/rough/basin) extended per ARCHITECTURE §6; chunk streaming in a worker; vertex colours + triplanar detail (grass/rock/sand/snow/ash from ambientCG via KTX2); shore sand, slope rock, height snow.
- [x] 1.2 Water (`Water` addon, reflection on medium/high) and lava (emissive noise + bloom).
- [x] 1.3 Props: Kenney/Quaternius packs through the instancer with LOD; Green Meadow (windmills, farms, trees, hot-air balloons), Red Canyon (mesas, arches), Blue Coast (lighthouse, pier, sailboats) fully dressed.
- [x] 1.4 Atmosphere per biome for those three (sun angle, turbidity, fog, cloud cover, palette) with the 14% transition blend; night variant of Meadow.
- [x] 1.5 Hero plane: Paper Dart (modelled) and Kite Biplane (pack) loaded via manifest with paint slots, canopy material, prop disc, contrails, shadow.
- [x] 1.6 Free-fly debug route `#debug/fly?biome=` and the screens harness capturing all three biomes day + one night.

**Gate 1:** three biomes screenshotted on a phone look better than the prototype and pass the Quality Bar checklist in `docs/ART.md`; ≤150 draw calls, 60 fps iPhone 12, 30+ iPhone X. Duke confirms on his phone.

## Phase 2 — First playable that feels like the reference

- [x] 2.1 Controls: **one-thumb primary** (hold = climb, release = glide/dive; horizontal drag while holding = bank) per GDD §3, boost button bottom-right with nitro ring, pause. "Pilot" scheme (floating joystick) as a settings option. Keyboard for desktop testing.
- [x] 2.2 Aim screen: slingshot pull with drag, dotted trajectory, moving gold zone, perfect/good grading with streak, slow-mo + gold flash on perfect.
- [x] 2.3 Pickups + hazards from GDD §8 through the registries: coins (4 patterns), boost rings, fuel cans, thermals, balloons, shield orbs, ×2 stars, nitro crates, coin fountains, golden ring chains, birds, cables. Magnet. Collision in `sim/collide.ts`.
- [x] 2.4 Soft walls: storm fronts at the GDD distances with the dense sprite wall + lightning flashes + rain; headwind gate (3-ring bull's-eye). The other four land with their biomes in Phase 4.
- [x] 2.5 Camera feel + juice: FOV punch, shake, boost speed lines, crash shockwave + flash + cinematic orbit, landing dolly, confetti, callouts (PERFECT, NEW BEST, STORM BROKEN, SHIELD!), count-up results.
- [x] 2.6 Results card + minimal hangar (upgrade list with costs, buy, evolve threshold bar) so the loop closes: hangar → aim → fly → results → hangar. Coins persist.
- [x] 2.7 Audio: synth engine tied to throttle (exists), Kenney SFX via the manifest, one music bed with ducking.

**Gate 2:** a stranger can play 10 flights without instructions; stock flight lands 250–350 m; first upgrade affordable after flight 1; storm #1 at 500 m is a visible wall that stops a stock plane and yields to a Lv 12–16 plane with boost. Screenshots of aim, flight, storm, crash, results in `docs/screens/2/`.

## Phase 3 — Systems

- [x] 3.1 All 13 upgrades with the GDD cost curve; hangar tabs (Upgrades / Planes / Paint / Gadgets / Missions); export/import code screen; settings.
- [x] 3.2 Plane tiers 0–9 from the packs with evolve thresholds, evolve ceremony (hangar lights, confetti, new engine sound), 12 paints.
- [x] 3.3 Missions engine (all GDD §9 types as registry files), daily chest with streak, 30 achievements, titles.
- [x] 3.4 Ghost of best flight from the run recorder; combo + near-miss; tricks (barrel roll, loop); landing bullseye.
- [x] 3.5 Results card complete: count-up, mission payouts, storm banners, "+X past best", share image (canvas → PNG → Web Share).

**Gate 3:** 20-minute session with no dead ends; economy sanity checks from GDD §11 pass as vitest; evolve ceremony screenshotted.

## Phase 4 — World

- [x] 4.1 Remaining nine biomes, each as one registry file + its props/hazards/landmark, screenshotted day and (for 3, 8) night. Sandstorm, ash cloud, crosswind corridor, thin air soft walls with their biomes.
- [x] 4.2 Music beds per biome mood with crossfade at transitions; full SFX set.
- [ ] 4.3 (deferred to next session) Weekly challenge map (seeded, modifiers) + local leaderboard.
- [~] 4.4 Prestige (Re-fold) shipped; gadgets deferred to next session.

**Gate 4:** every biome in `docs/screens/4/` with its landmark visible; all under budget.

## Phase 5 — Polish, performance, release

- [ ] 5.1 Profile on iPhone X and 12 class (Vercel preview + Safari Web Inspector timeline); LOD tuning, texture budget, worker timing; tier auto-select verified.
- [x] 5.2 Tutorial (3 cards), settings (sound, music, invert, quality, control scheme, left-handed, large text, reduced motion).
- [ ] 5.3 Lighthouse PWA audit green, offline cold start, cold start under 3 s on LTE, `navigator.storage.persist()`.
- [ ] 5.4 Tag v1.0.0, `docs/RELEASE_NOTES.md`.

## After v1.0

Work the Design Bible's Tier A → E in order, one item per session, each as registry files + at most one new system. Candidates that need no new system and can slot in any time: Terrain Graze, Bull's-Eye Gating (already the headwind gate), Altitude Banking, Photo Mode, Daily Seeded Gauntlet.
