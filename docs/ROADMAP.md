# Build roadmap (in order; one commit per item; push after each phase)

## Phase 0 — Scaffold (session 1)
0.1 Vite + TS + three.js, ESLint, vitest, Playwright smoke test (390×844 touch). `npm run dev|build|test|smoke`.
0.2 PWA: manifest, icons (generate 180/192/512 from an SVG plane), service worker precaching `dist/`.
0.3 `vercel.json` (SPA, long cache for hashed assets). First deploy. **Checkpoint: Duke opens the URL on his phone and sees a spinning plane over a sky.**

## Phase 1 — Rendering foundation (session 1–2)
1.1 Renderer, sRGB/ACES, HDRI env, Sky addon with sun/moon, stars, lens flare, quality tiers.
1.2 Terrain chunk streaming with vertex colors + triplanar detail; heightfield from the prototype `groundY` incl. cliff start, biome amp/rough/basin blending.
1.3 Water addon + lava; shore sand, snow caps.
1.4 Post stack (bloom, SSAO, vignette, LUT) with Low/Med/High.
1.5 Asset pipeline: download per docs/ASSETS.md, manifest, GLTF loader with a loading screen (progress bar), instancing helper.
**Checkpoint: fly-through of Meadow and Coast looks better than the prototype on a phone at 60 fps.**

## Phase 2 — Gameplay port (session 2)
2.1 Port `sim/` from legacy (simStep, groundCheck, launch, perfect zone) with vitest balance locks.
2.2 Controls: slingshot aim + trajectory dots, floating joystick, boost button, pause, keyboard.
2.3 Pickups + hazards from §8 with instanced meshes; collision; magnet.
2.4 Storm fronts + the five other soft walls (§5) with visuals and HUD warning chip.
2.5 Plane tiers 0–9 from the packs, evolve logic, paint slots, prop/afterburner/contrails.
2.6 Camera system, feel checklist §12 (callouts, shake, flashes, slow-mo, confetti, haptics).
**Checkpoint: full loop playable start→results with 3 biomes.**

## Phase 3 — Systems (session 3)
3.1 Save (versioned, migrations, export/import code), upgrades ×13, hangar UI with tabs (Upgrades / Planes / Paint / Gadgets / Missions).
3.2 Missions engine (all types), daily chest, achievements (30), titles.
3.3 Ghost of best flight; combo + near-miss; tricks (barrel roll, loop); landing bullseye.
3.4 Results card: count-up, mission list, storm banners, "+X past best", share image (canvas → PNG → Web Share API).
**Checkpoint: Duke can play 20 minutes without running out of things to do.**

## Phase 4 — World (session 3–4)
4.1 All 12 biomes with landmarks, hazards and pickup bias; night variants.
4.2 Audio: SFX set, per-biome music beds with crossfade, engine loop tied to throttle.
4.3 Weekly challenge map (seeded) with modifiers; local leaderboard.
4.4 Gadgets + prestige.
**Checkpoint: every biome screenshotted on phone; each has a "wow" landmark.**

## Phase 5 — Polish & perf (session 4)
5.1 Profile on iPhone X-class and 12-class; hit budgets; LOD; texture compression (KTX2).
5.2 Tutorial first-flight overlay (3 cards max), settings (sound, music, invert, quality, haptics, left-handed).
5.3 Accessibility: large text option, reduced motion.
5.4 Final: lighthouse PWA audit, offline test, cold-start under 3 s on LTE.

Definition of done for v1.0: 12 biomes · 10 planes · 13 upgrades · 6 soft-wall types · missions/daily/weekly/achievements/ghost/tricks · 60 fps on iPhone 12 · installs offline.
