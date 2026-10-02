# Audit of the current build (2026-10-02, Fable)

Question asked: do we rebuild, or is there something to salvage? Short answer: **salvage the base, build the game on top of it. Do not rebuild.** The tooling, physics port, save system and content data are sound. The rendering, world, UI and game layers were never built, so there is nothing there to tear down; the one file that pretends to be the game (`src/main.ts`) is a demo stub and gets replaced, not refactored.

## What exists

| Area | Files | Lines | Verdict |
|---|---|---|---|
| Tooling | `vite.config.ts`, `vercel.json`, `playwright.config.ts`, `eslint.config.js`, `tsconfig.json`, `scripts/gen-icons.mjs` | ~150 | **Keep.** Vite + TS strict, PWA plugin with precache, Vercel SPA rewrites + immutable asset caching, Playwright on the WebKit iPhone 12 profile. Only fault: 3 lint errors in the icon script (node globals), fixed in this commit. |
| Flight physics | `src/sim/flight.ts`, `src/sim/flight.test.ts` | 674 | **Keep as-is.** Faithful pure port of the prototype `simStep`/`groundCheck`/`launch`, no three.js, no DOM, balance locked at 292 m / 2661 m / 8157 m with monotonicity checks. This is the single most valuable artefact in the repo. |
| Save | `src/save/save.ts`, `src/save/save.test.ts` | 905 | **Keep.** Versioned (v3) with migrations, export/import code, 17 tests. Field names (`fuelTank`, `lucky`) differ from `sim` (`fuel`, `luck`); a tiny adapter resolves it. |
| Audio | `src/audio/engine.ts`, `src/audio/sfx.ts` | 712 | **Keep as fallback.** Synthesised engine loop and SFX, iOS-gesture-safe. Sample-based SFX from the Kenney packs layer on top later; the synth engine stays for the throttle-tied prop/jet loop. |
| Content data | `src/data/planes.ts`, `biomes.ts`, `progression.ts` | 2957 | **Keep, re-scope.** Typed rosters for 14 planes, 16 biomes, 13 upgrades, missions, achievements, titles. It is pure data with no engine behind it. It encodes the Design Bible's expanded scope; v1 ships the GDD's 12 biomes / 10 planes and the rest stays in the data as a v2 backlog. The plane `BuildSpec` (primitive-assembled silhouettes) becomes the **fallback** model path; real GLTF models are the primary path (see Graphics). |
| Boot / demo | `src/main.ts`, `src/render/plane.ts`, `index.html`, `src/style.css` | 924 | **Replace.** A single-file demo: flat 4000×7000 m plane, a box for the cliff, 340 instanced cones, a primitive plane, a line trail, three DOM overlays. No state machine, no world, no biomes, no pickups, no hangar. Reused only as a reference for the DOM HUD layout and the camera/fixed-step pattern, both of which move into proper modules. |
| Docs | `docs/GDD.md`, `ART.md`, `ASSETS.md`, `DESIGN_BIBLE.md`, `ROADMAP.md`, `DECISIONS.md`, `prompts/CLAUDE_CODE_PROMPTS.md` | ~450 | **Keep GDD/ART/ASSETS; roadmap and prompts rewritten** (foundation-first, see `ROADMAP.md`, `ARCHITECTURE.md`, `prompts/FABLE_BUILD_PROMPTS.md`). The Design Bible is relabelled as the v2+ backlog. |

Missing entirely (the `CLAUDE.md` layout promised them): `src/game/`, `src/world/`, `src/render/` (beyond the primitive plane), `src/assets/`, `src/ui/`, and every downloaded asset under `public/models|textures|hdr|audio`. No `CREDITS.txt`.

## How it looks today

Headless run at 390×844 (screenshots were taken during the audit; no console errors):

- Aim screen: gradient sky, a flat green plane, the primitive plane in the lower-right corner, a power bar.
- In flight: gradient sky over a flat two-tone ground. No terrain relief, no scenery in view, no visible plane, no clouds, no sun, no shadows that read. The distance counter climbs, so the loop runs, but there is nothing to look at.

Measured against the reference (Epic Plane Evolution) and the ART.md bar this is a 1/10 on graphics. That is not a failure of the code that exists; it is that Phase 1 of the old roadmap (rendering foundation) was skipped and Phase 2 started on a stub scene.

## Why the old roadmap would have led to rebuilds

1. **Content before contracts.** The old plan added biomes, pickups and planes as features inside the game loop. Each new one would have grown `main.ts`. The new plan defines registries first (one file per biome/plane/pickup/hazard/soft wall), so adding content never touches the engine.
2. **No world query boundary.** The sim needs ground height, surface type, wind and biome at a point. Without a `WorldQuery` interface, terrain, water, lava and storm fronts would each have been wired directly into the physics step and into the renderer, twice.
3. **No event bus.** Missions, achievements, audio, haptics, callouts and the results card all react to the same moments (coin, ring, storm broken, landed). Direct calls between them is the classic path to a rewrite at Phase 3.
4. **Rendering as a feature, not a platform.** Quality tiers, instancing pool, material library with paint slots, atmosphere blending and the post stack must exist before the first biome is built, or every biome gets built twice (once ugly, once pretty).
5. **No evidence gate.** Nothing forced a phone screenshot before moving on, which is how a flat green plane got labelled "first playable".

## Platform facts that shape the foundation

- **Install path:** Safari → Share → Add to Home Screen. No Apple developer account, no TestFlight, no App Store. On iOS 26 every added site opens as a web app by default; on iOS 16/17 the existing manifest + `apple-mobile-web-app-capable` meta handles it. Already in place.
- **Graphics API:** WebGL2 is the baseline (iOS 15+; the iPhone X stops at iOS 16). WebGPU only arrives with iOS 26, so it is an optional future tier, never a requirement. We stay on `WebGLRenderer` and keep the renderer behind a facade so a WebGPU backend can be slotted in later.
- **Storage:** installed home-screen apps are exempt from Safari's 7-day script-storage cap, but storage can still be evicted under disk pressure. Keep the export/import code visible in the hangar, call `navigator.storage.persist()` once, and store the save in both `localStorage` and IndexedDB.
- **Haptics:** `navigator.vibrate` is not implemented in iOS Safari. Haptics are a no-op on iPhone; every "haptic" moment must also have a visual and audio beat.
- **Audio:** WebAudio needs a user gesture; the audio modules already handle this. Music must be AAC (`.m4a`) for Safari; OGG as the secondary source.
- **Performance:** antialiasing via MSAA at DPR 2 is the first thing that kills frame rate on an iPhone. Cap DPR at 1.5 on the high tier, 1.0 on low, and resolve AA in the post stack (SMAA) rather than the framebuffer. Shadows: one cascaded or fitted 1024² map that follows the plane, PCF not PCFSoft on low/medium.

## Decision

Proceed on the existing repo. Sequence: foundations (architecture contracts + rendering platform + asset pipeline) → first playable that already looks right → systems → world content → polish. Details in `docs/ROADMAP.md`; the prompts that execute it are in `prompts/FABLE_BUILD_PROMPTS.md`.
