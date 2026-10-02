# Skyfling build prompts v2 — run in order

Written 2026-10-02 by Fable after auditing the Opus build (`docs/AUDIT.md`). These replace `CLAUDE_CODE_PROMPTS.md`. Each prompt is self-contained: paste one into a fresh Claude Code session on the repo, let it run to its gate, open the Vercel preview on your phone, then paste the next. Suggested model: Fable or Opus with extended thinking; one phase per session so the context stays sharp.

The repo's `CLAUDE.md` is read automatically. Every prompt below starts with the same preamble so a session never skips the contracts.

---

## Preamble (the top of every prompt)

```
Read, in this order, before touching code: CLAUDE.md, docs/ARCHITECTURE.md, docs/ROADMAP.md, docs/ART.md (especially "Quality bar"), docs/GDD.md, docs/AUDIT.md. Then skim legacy/skyfling-v5-prototype.html for the functions the roadmap item names.

Rules for this session:
- Work only on the roadmap items named below, in order. Tick them in docs/ROADMAP.md as you finish.
- Obey docs/ARCHITECTURE.md exactly: layer import direction, one-file-per-item registries, FlightEnv/WorldQuery as the only bridge from world to physics, the event bus, seeded randomness. If an item cannot be done inside those contracts, change the contract first and log it in docs/DECISIONS.md.
- Do not ask Duke questions. Make the call, note it in docs/DECISIONS.md with today's date.
- Graphics are the top priority. Nothing is "done" if a screenshot of it would fail the Quality bar in docs/ART.md.
- The balance tests in src/sim/flight.test.ts must stay exact (292 / 2661 / 8157). Never loosen them.
- Commit after every completed item with a message that names it. Push to the branch you were given (or main if none). Vercel deploys from main.
- Definition of done for the session: `npm run lint`, `npm run test`, `npm run build`, `npm run smoke` all pass; the gate's screenshots are in docs/screens/<phase>/ at 390×844 and linked from the roadmap; a short status at the end lists what shipped, what was deferred and why, and the preview URL.
- Evidence over claims: run the thing, screenshot it, read the numbers from renderer.stats(). Report failures as failures.
```

---

## Prompt F — Foundations (Phase F)

```
<preamble>

Execute Phase F of docs/ROADMAP.md (items F.3 to F.10). This phase builds the platform the game runs on; there is no gameplay in it, and that is intentional.

Order and specifics:
F.3 Dependencies: upgrade three to the current r18x and @types/three to match; add postprocessing, n8ao, detect-gpu, globals, @gltf-transform/cli (dev). Read the three.js migration guide for every release between r169 and the new version and fix what it flags (addon import paths are `three/addons/...`). Build, test, lint green before the next item.
F.4 Layer boundaries: create the folders from ARCHITECTURE §1. Add an ESLint config block per layer using no-restricted-imports so data/sim cannot import three or anything DOM, world cannot import render/ui/game, render cannot import ui/game, ui cannot import three. Reduce src/main.ts to boot only (<80 lines) by moving the demo scene into src/debug/demo-scene.ts behind the hash route #debug/demo so nothing is lost while the real scene is built.
F.5 Registries: implement defineBiome/definePlane/defineUpgrade/definePickup/defineHazard/defineSoftWall/defineMission/defineAchievement/definePaint/defineProp in src/data/registry.ts with runtime validation (ids unique, numbers finite, referenced ids exist) and import.meta.glob collection. Split the three big rosters in src/data into one file per item under src/data/<type>/NN-id.ts, preserving every field. Mark the Design-Bible-only items (planes P1–P4, biomes 13–16) with scope: 'v2'. Vitest: every registry validates; every v1 plane has a model id; every biome references only registered props/hazards/soft walls.
F.6 Sim env: add FlightEnv and NEUTRAL_ENV to src/sim/flight.ts and thread env through simStep (ground/surface/slope/wind/liftScale/dragAdd/thermalLift). With NEUTRAL_ENV the balance tests must still produce 292 / 2661 / 8157 exactly. Add src/sim/softwalls.ts (pure force functions for storm front, sandstorm, ash cloud, crosswind corridor, thin air, headwind gate per GDD §5; boost cuts soft-wall drag by 70%) and src/sim/collide.ts (sphere vs capsule, spatial hash), each with tests. Define the WorldQuery interface in src/world/query.ts.
F.7 Game core: src/game/events.ts typed emitter with the GameEvents map from ARCHITECTURE §4; src/game/machine.ts state machine (boot/hangar/aim/fly/results/paused/evolve) with hash routes; src/game/run.ts RunState; src/world/rng.ts mulberry32 seeded PRNG; src/game/recorder.ts records {seed, inputs} and replays deterministically (test: two replays of the same recording produce identical FlightState sequences).
F.8 Render platform: src/render/renderer.ts facade (WebGLRenderer, sRGB, ACES, quality tier from detect-gpu + DPR + a 3 s fps probe, ?quality= override, DPR cap 1.5/1.25/1.0, stats()); src/render/atmosphere.ts (Sky, sun light with a shadow frustum that follows a target, hemisphere light, FogExp2, two cloud sprite layers using procedurally painted cloud sprites until the CC0 atlas lands, stars + moon for night, HDRI env via PMREM on medium/high and RoomEnvironment on low), driven by a blended Atmosphere record; src/render/camera.ts chase rig (speed FOV 60→82, bank roll, boost punch, shake, crash orbit, landing dolly, aim orbit); src/render/instancer.ts; src/render/materials.ts paint-slot library; src/render/post.ts (postprocessing EffectComposer: RenderPass + one EffectPass with BloomEffect threshold 0.85 strength 0.35, VignetteEffect, ChromaticAberrationEffect, LUT3DEffect with an identity LUT, SMAAEffect; N8AO before it on high only); src/render/particles.ts sprite pool 300 + GPU Points; src/render/trails.ts ribbon. Debug route #debug/stats overlays fps, ms, draw calls, tris, tier.
F.9 Asset pipeline: src/assets/manifest.ts typed as in ARCHITECTURE §8; scripts/assets-fetch.mjs that downloads the packs in docs/ASSETS.md (verify each license page, skip and log any that moved), converts to GLB with gltf-transform (draco or meshopt, dedup, prune, resize textures to ≤1024), compresses textures to KTX2 (toktx or gltf-transform's ktx), writes public/models|textures|hdr|audio, and generates public/CREDITS.txt from the manifest. Loader (src/assets/loader.ts) with byte-accurate progress feeding the boot bar. scripts/check-budget.mjs fails the build if precache exceeds 25 MB. Wire KTX2Loader/DRACOLoader/MeshoptDecoder in the GLTF loader with transcoder files in public/.
F.10 Screens harness: tests/screens.spec.ts (Playwright, iPhone 12 WebKit profile) that visits #debug/stats and #debug/sky, screenshots to docs/screens/F/, asserts zero console errors and reads renderer.stats() from window.__skyfling.stats() to assert ≤150 draw calls.

Gate F evidence: a sky with a sun disc, graded horizon haze matching the fog, two cloud layers and stars at night rendering over an empty ground disc at 60 fps on the high tier; #debug/stats readable on a phone. Screenshots in docs/screens/F/ and linked from the roadmap. Finish with the status report.
```

---

## Prompt 1 — The world looks right (Phase 1)

```
<preamble>

Execute Phase 1 of docs/ROADMAP.md (items 1.1 to 1.6). This phase exists because graphics are the top priority: three biomes must look better than the prototype and pass every line of the Quality bar before any gameplay is wired.

1.1 Terrain. Port groundY (cliff start, amp/rough/basin per biome, basin channel) from legacy/skyfling-v5-prototype.html into src/world/terrain.ts as a pure heightAt(x,z) that blends the two biomes across the last 14% of each 1,200 m segment, extended with ridged noise for canyon mesas and alpine valleys. Chunk builder (150×900 m strips, 6 ahead 2 behind) runs in src/world/terrain.worker.ts and posts transferable position/normal/color/weight buffers. Material: MeshStandardMaterial with an onBeforeCompile hook that blends grass/rock/sand/snow/ash KTX2 albedo+normal triplanarly by slope and height weights, with a distance fade so tiling never shows. Shore sand below waterLevel+2, snow above the biome's snowLine, rock where slope >0.55.
1.2 Water via three/addons Water with waternormals.jpg, reflection on medium/high, animated vertex plane on low; lava as an emissive animated noise ShaderMaterial that blooms.
1.3 Props. Through the instancer and the prop registry: Green Meadow (Kenney Nature Kit trees/bushes/rocks, windmill, farmhouse, hot-air balloons as sphere+basket), Red Canyon (mesas from the heightfield plus Kenney rock arches you can fly through), Blue Coast (Kenney pirate/watercraft lighthouse, pier, sailboats on water). Poisson placement on the heightfield, never on water unless the prop says so, LOD drop past 400 m, shadows near the camera only.
1.4 Atmosphere records for those three biomes in their registry files (sun elevation/azimuth, turbidity, zenith/horizon/fog colours, fog density, cloud cover, per-biome LUT); blend across transitions; night variant of Green Meadow (stars, moon, cool fog, emissive farmhouse windows).
1.5 Hero plane. Model the Paper Dart (two folded slabs, crease edge, paper material, ~120 tris) and load the Kite Biplane from the Quaternius planes pack through the manifest; apply paint slots by material name; canopy MeshPhysicalMaterial with clearcoat; prop disc spun by speed; twin ribbon contrails that fade; shadow caster; interpolation between sim states. Delete src/render/plane.ts primitives (keep the BuildSpec fallback path from src/data/planes as the fallback only).
1.6 Free-fly route #debug/fly?biome=<id>&night=1 with a slow forward dolly through the biome, and extend tests/screens.spec.ts to capture all three biomes day plus Meadow night into docs/screens/1/, asserting ≤150 draw calls and no console errors.

Gate 1 evidence: four screenshots that pass every line of the Quality bar (sun disc, graded haze with no seam, parallax clouds, terrain relief and colour variation, detail texture, reflective water, recognisable landmark, plane with contrails and shadow, bloom only on emissives). Add docs/screens/1/compare.png with our frame beside a reference frame of a comparable moment. Read fps from #debug/stats on the high tier and report it. Finish with the status report.
```

---

## Prompt 2 — First playable that feels like Epic Plane Evolution (Phase 2)

```
<preamble>

Execute Phase 2 of docs/ROADMAP.md (items 2.1 to 2.7). The target feel: Epic Plane Evolution. One thumb, hold to lift, release to glide, a slingshot that rewards timing, glowing rings and coins that pull you along, a storm wall you cannot yet pass, an upgrade that gets you through it next time.

2.1 Controls in src/ui/controls.ts emitting FlightInput: default "Glide" scheme (hold anywhere = pitch input ramps 0→+1 over 0.25 s; release = ramps to −0.35 over 0.4 s then hands to auto-trim; horizontal drag while holding = bank ±1 over 160 px, smoothed 9/s), BOOST button bottom-right with a nitro ring (separate pointer capture so two thumbs work), pause top-right. "Pilot" scheme (floating joystick from the prototype moveJoy) behind a settings flag. Keyboard mirror for desktop. touch-action none on the canvas; safe-area insets.
2.2 Aim screen: port aimParams/release/launch from the prototype into src/game/aim.ts + src/ui/aim.ts: drag down to pull the slingshot (the plane visibly pulls back on an elastic), sideways to aim yaw, dotted trajectory preview from a short pure sim rollout, power bar with the moving gold zone (center 0.8+0.14·sin(2.1t), half-width 0.055), perfect/good grading with streak via gradeLaunch. Perfect = 0.35 s slow-mo, gold flash, PERFECT callout, chime.
2.3 Pickups + hazards as registry files with a mesh id each, spawned per chunk from biome tables and the run PRNG (coins in line/arc/sine/3×3, boost rings +14 speed +nitro, fuel cans, thermals as rising sprite columns inside a translucent cylinder, balloons that bounce, shield orbs, ×2 stars 9 s, nitro crates, coin fountains, golden ring chains ×3 for 10 s, birds that slow you, cables). Collision through sim/collide.ts; magnet radius pulls coins; every pickup emits an event and a sparkle.
2.4 Soft walls: storm fronts at 500/1150/2050/3200/4700/6600/9000/12000 m through sim/softwalls.ts and FlightEnv; visual = dense dark sprite wall with rain Points, lightning emissive flashes, a HUD warning chip 200 m out; "STORM BROKEN" banner + bonus on the first break of each. Headwind gate as three concentric rings (mint/butter/coral) with +30/+55/+90% and nitro refill on the centre.
2.5 Feel: camera rig modes (chase, boost punch + speed lines, crash orbit, landing dolly); shake, flash, shockwave on crash; confetti on clean landing; callouts (PERFECT, NEW BEST, STORM BROKEN, SHIELD!, ×2); count-up results. Every juice item is an event-bus subscriber in src/render/juice.ts or src/ui/callouts.ts, never called directly.
2.6 Close the loop: results card (distance, coins, +X past best, FLY AGAIN, HANGAR) and a minimal hangar (upgrade rows with cost 30·1.62^L, buy, evolve progress bar) using save/ via adapters. State machine drives hangar → aim → fly → results.
2.7 Audio: synth engine tied to throttle and speed (exists), Kenney SFX via the manifest for coin/ring/whoosh/impact/ui/perfect, one Meadow music bed with ducking on crash.

Gate 2 evidence: an autopilot Playwright run (#debug/autopilot) that launches, flies and reaches the results card with zero console errors; a stock plane lands in 250–350 m; the first upgrade is affordable after flight 1; the 500 m storm visibly stops a stock plane and a uniformLevels(4) plane with boost breaks it. Screenshots of aim, mid-flight with pickups, storm wall, crash, results and hangar in docs/screens/2/ passing the Quality bar, plus compare.png. Finish with the status report.
```

---

## Prompt 3 — Systems (Phase 3)

```
<preamble>

Execute Phase 3 of docs/ROADMAP.md (items 3.1 to 3.5). Port the prototype's missions (genMission/ensureMissions/missionsTick), chest (openChest, streak), ghost (setupGhost/updateGhost), combo and near-miss (collide) and hangar/paint (renderHangar/renderPaint/applySkin) into the registries and event bus; do not port its DOM or geometry.

3.1 All 13 upgrades as registry files (the four new ones: thermal wings, storm plating, trick kit, coin radar, with their effects in sim via stats/FlightEnv); hangar tabs Upgrades / Planes / Paint / Gadgets / Missions in src/ui/hangar/*.ts; settings screen; export/import code screen with copy and paste.
3.2 Plane tiers 0–9 from the packs via the manifest with evolve thresholds from the registry; evolve ceremony state (hangar lights down, spotlight, model morph/dissolve, confetti, new engine sound); 12 paints via the material library.
3.3 Missions engine: each mission type is a registry file exposing init(difficulty, best) → target, progress(event, state) and describe(); 3 active, auto-replace, reward (30+0.09·best+12·lvl)·k. Daily chest with ×1.25/day streak to 2.5×. 30 achievements as registry files over the event stream; titles in the hangar.
3.4 Ghost from the run recorder: translucent plane replaying the best run's inputs on the same seed, lead/trail readout. Combo + near-miss detection in sim/collide.ts; tricks (barrel roll from a full-circle input or snap in Glide scheme, loop through vertical) with invulnerability windows; landing bullseye rings at the predicted landing point.
3.5 Results card complete: count-up, mission payouts, storm banners, "+X past best", share image (offscreen canvas → PNG → navigator.share with a file fallback to download).

Gate 3 evidence: vitest for GDD §11 economy sanity (first upgrade on flight 1, first evolve by flight 8–10, storm #1 breakable at total Lv 12–16 with boost, no upgrade <3% distance alone at Lv 5); 20 synthetic flights through the missions engine complete at least 6 missions; evolve ceremony and all hangar tabs screenshotted in docs/screens/3/. Finish with the status report.
```

---

## Prompt 4 — World (Phase 4)

```
<preamble>

Execute Phase 4 of docs/ROADMAP.md (items 4.1 to 4.4). Each biome is one registry file plus its props/hazards; nothing in the engine changes. If a biome needs an engine change, stop, write the contract change in docs/DECISIONS.md, make it minimal, then continue.

4.1 Golden Dunes (pyramids, oasis, sandstorm soft wall), Alpine Forest (chalets, ski-lift cables as hazards, shield bias), White Tundra (ice spikes, frozen lake slide, aurora at night), Ash Volcano (lava pools, geyser updrafts, ash cloud soft wall), Neon City (Kenney city kit with emissive window textures, billboards, blimps, rooftop rings, wind between towers), Sky Isles (floating islands with rings, waterfalls), Jungle Ruins (Kenney castle kit temples, vine arches, toucan flocks), Thunder Plateau (lightning rods, wind farm, crosswind corridor, telegraphed lightning strikes), Stratosphere (thin air above 400 m, satellites, aurora, horizon curve via a camera far-plane trick). Night variants for Meadow, Coast, Neon City.
4.2 Music beds per biome mood (CC-BY credited or CC0, ≤40 s loops, m4a + ogg) with crossfade over the transition band; complete the SFX set.
4.3 Weekly challenge: seed = floor(Date.now()/604800000) XOR salt, one modifier (no fuel / double gravity / night / coin rush), local best per week, shareable image.
4.4 Gadgets (parachute, rocket pod, coin radar+, lucky coin, glider wing; equip 2) and prestige "Re-fold" (reset for +10% coins, prestige paint, max 5).

Gate 4 evidence: every biome day (and the three nights) in docs/screens/4/ with its landmark visible and ≤150 draw calls; music crossfade audible in a recorded run; status report.
```

---

## Prompt 5 — Polish, performance, release (Phase 5)

```
<preamble>

Execute Phase 5 of docs/ROADMAP.md (items 5.1 to 5.4).

5.1 Profile: Playwright trace at 390×844 on the low and high tiers through every biome via #debug/fly; read renderer.stats() per biome and fix anything over budget (LOD distances, instance counts, texture sizes, worker timing, shadow frustum). Verify tier auto-select picks low on a DPR-3 low-GPU profile and high on a desktop profile.
5.2 Tutorial: three cards on first launch (pull & time it, hold to lift, boost through storms). Settings: sound, music, invert, quality, control scheme, left-handed, large text, reduced motion (disables shake/flash/CA).
5.3 PWA: Lighthouse PWA audit green, offline cold start test in Playwright with the network offline after the first load, cold start under 3 s on a simulated LTE profile, navigator.storage.persist() after the first run, IndexedDB mirror of the save.
5.4 Tag v1.0.0, write docs/RELEASE_NOTES.md, update README install steps with screenshots.

Gate 5 evidence: Lighthouse report in docs/screens/5/, the perf table (biome × tier × fps/ms/draw calls), offline test passing. Status report.
```

---

## Iteration prompts (after v1.0)

- **Play-test fix:** `<preamble> Duke's play-test note: "<paste>". Diagnose against docs/GDD.md and the balance tests. Propose three fixes with their expected effect on the 292/2661/8157 locks and on the feel, implement the best one without changing the locks unless the GDD numbers change too (then update GDD, tests and DECISIONS together), screenshot, push.`
- **Add a biome:** `<preamble> Add the biome "<name>" (mood, landmark, hazard, pickup bias: <...>) as one registry file plus props/hazards files. No engine changes. Screenshot day and night into docs/screens/biomes/. Push.`
- **Add a plane:** `<preamble> Add plane tier between <X> and <Y> using <pack model>. Registry file, manifest entry, paint slots by material name, evolve thresholds respaced evenly, ceremony. Screenshot in the hangar. Push.`
- **Graphics pass:** `<preamble> Graphics-only session. Take the six gate screenshots (aim, flight, storm, crash, results, hangar) and the twelve biome shots, grade each against every line of the Quality bar in docs/ART.md, list the failures, fix them in order of visibility, re-shoot, and put before/after pairs in docs/screens/graphics-pass-<date>/. Keep draw calls ≤150 and fps on budget. Push.`
- **Design Bible item:** `<preamble> Build "<item>" from docs/DESIGN_BIBLE.md as registry files plus at most one new system. If it needs more than one new system, write the plan into docs/DECISIONS.md and stop. Otherwise screenshot and push.`
