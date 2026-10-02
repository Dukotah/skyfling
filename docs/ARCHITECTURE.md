# Architecture contracts

These are the rules that make "add a biome / plane / pickup / upgrade" a one-file change instead of a rewrite. They are binding for every session. If a task cannot be done inside these contracts, change the contract first (and log it in `DECISIONS.md`), then do the task.

## 1. Layers and the import direction

```
data  →  sim  →  world  →  render  →  ui  →  game  →  main
```

A module may import from any layer to its **left**, never to its right. `data` and `sim` import nothing from three.js or the DOM. `world` may use three.js math types only (`Vector3`, `MathUtils`), never scene objects. `render` never reads DOM or save state. `ui` never touches three.js. `game` is the only layer that knows about everything. `main.ts` is boot only (under 80 lines: create renderer, load assets, start the state machine, wire resize/visibility).

Enforced with ESLint `no-restricted-imports` per directory (added in the foundation phase). A violation fails `npm run lint`.

```
src/
  data/        content registries (pure data + registration helpers)
  sim/         flight physics, collision math, soft-wall forces (pure, vitest)
  world/       seeded generation: terrain heightfield, biome sequencing, spawners, chunk streaming (pure where possible)
  render/      three.js: renderer facade, quality tiers, atmosphere, terrain mesh, instancer, materials, post stack, particles, trails, camera rig
  ui/          DOM screens: boot, hangar, aim, hud, results, pause, settings, modals (one module per screen)
  game/        state machine, RunState, event bus, run recorder/ghost, missions/achievements runtime, economy
  assets/      typed manifest, loader with progress, KTX2/Draco/meshopt setup
  audio/       WebAudio: synth engine (exists), sample SFX, music beds with crossfade
  save/        versioned save (exists), migrations/, adapters to sim UpgradeLevels
  debug/       hash-route debug scenes, perf HUD, screenshot harness hooks
  main.ts      boot only
```

## 2. Content registries (the "add, don't rebuild" mechanism)

Every content type is a folder of one-file definitions, auto-collected with `import.meta.glob('./biomes/*.ts', { eager: true })`. Adding content = adding a file. Removing content = deleting a file. Nothing else changes.

```ts
// src/data/biomes/03-blue-coast.ts
export default defineBiome({
  id: 'blue-coast', order: 3, name: 'Blue Coast',
  terrain: { amplitude: 14, roughness: 0.3, basin: 0.6, water: true, waterLevel: -26 },
  atmosphere: { sunElevation: 35, sunAzimuth: -40, turbidity: 4, zenith: '#7fb6ea', horizon: '#eaf4ff', fog: '#cfe3f5', fogDensity: 0.0011, cloudCover: 0.4 },
  palette: { ground: ['#6fb36a', '#a7c86a'], rock: '#8b8f88', shore: '#e8d9a8' },
  props: [{ kind: 'lighthouse', density: 0.02, placement: 'shore' }, { kind: 'sailboat', density: 0.05, placement: 'water' }],
  hazards: [{ kind: 'seagull-flock', rate: 0.6 }],
  pickupBias: { fuel: 2.0, thermal: 0.5 },
  softWalls: ['storm-front'],
  music: 'coast',
})
```

Registries (each with `defineX()` that validates at module load and returns the frozen record):

| Registry | Folder | Consumed by |
|---|---|---|
| biomes | `data/biomes/` | world (terrain, spawners), render (atmosphere, palette), audio (music) |
| planes | `data/planes/` | render (model id, material slots, fx), game (evolve thresholds, trait hooks) |
| upgrades | `data/upgrades/` | game (economy), save, sim via `derivePlaneStats` |
| pickups | `data/pickups/` | world (spawn tables), sim (collision radius, effect), render (mesh id), game (events) |
| hazards | `data/hazards/` | same as pickups |
| softWalls | `data/softwalls/` | sim (`SoftWallForce`), world (placement), render (visual id), game (break events) |
| missions | `data/missions/` | game (mission engine; each file is a mission *type* with `progress(event)` and `describe(target)`) |
| achievements | `data/achievements/` | game (condition on the event stream) |
| paints | `data/paints/` | render material library |
| props | `data/props/` | assets (model path), render instancer |

Rule: a registry record holds **ids and numbers**, never three.js objects or DOM. The render layer maps ids to meshes via the asset manifest.

## 3. Sim contracts

- `simStep(state, dt, input, stats, env)` stays pure. The new `env: FlightEnv` carries what the world says about this point: `{ groundY, surface: 'ground'|'water'|'lava', slope, wind: {x,y,z}, liftScale, dragAdd, thermalLift }`. All soft walls, thermals, thin air and headwinds reach the physics only through `FlightEnv`. The balance tests pass `env = NEUTRAL_ENV` and stay byte-identical to the oracle.
- `WorldQuery` interface (implemented in `world/`, consumed by `game/` to build `FlightEnv` each step):
  ```ts
  interface WorldQuery {
    heightAt(x: number, z: number): number
    surfaceAt(x: number, z: number): 'ground' | 'water' | 'lava'
    slopeAt(x: number, z: number): number
    biomeAt(distance: number): BiomeSample   // { biome, next, blend 0..1 }
    windAt(p: Vec3, t: number): Vec3
    softWallsNear(p: Vec3): SoftWallHit[]   // drag/downforce/yaw push contributions
  }
  ```
- Fixed 60 Hz sim, variable-rate render with interpolation between the last two sim states. One accumulator, max 5 catch-up steps, pause on `visibilitychange`.
- `RunState` is plain data: `{ seed, flight: FlightState, coins, combo, pickups, missions progress, events[] }`. It is serialisable; the ghost and replays are `{ seed, inputs[] }` and reproduce a run exactly because every random draw goes through the run's seeded PRNG (`world/rng.ts`, mulberry32). No `Math.random()` outside `debug/` and the UI.
- Collision: spheres vs. plane capsule for pickups/hazards, in `sim/collide.ts`, pure, tested. Spatial hash per chunk.

## 4. Event bus

`game/events.ts` exports a typed emitter. Everything reactive subscribes; nothing calls across systems.

```ts
type GameEvents = {
  'run:start': { seed: number; plane: PlaneId }
  'launch': { power: number; grade: 'perfect'|'good'|'none'; streak: number }
  'pickup': { kind: PickupId; value: number; pos: Vec3 }
  'ring': { kind: 'boost'|'golden'|'gate'; perfect: boolean }
  'hazard': { kind: HazardId; shieldAbsorbed: boolean }
  'softwall:enter' | 'softwall:break' | 'softwall:fail': { kind: SoftWallId; index: number }
  'biome:enter': { biome: BiomeId; distance: number }
  'combo': { count: number; bonus: number }
  'trick': { kind: 'barrel'|'loop'; nearMiss: boolean }
  'land': { kind: 'land'|'splash'|'crash'|'bounce'; distance: number; bullseye: number }
  'run:end': RunSummary
  'coins': { total: number; delta: number }
  'upgrade': { id: UpgradeId; level: number }
  'evolve': { from: PlaneId; to: PlaneId }
  'mission:complete' | 'achievement': { id: string; reward: number }
}
```

Subscribers: missions engine, achievements, audio (SFX + music ducking), juice (`render/juice.ts`: shake, flash, slow-mo, confetti, callouts via `ui/callouts.ts`), HUD, results card, haptics (no-op on iOS, kept for Android), run recorder.

## 5. State machine

`game/machine.ts`: `boot → hangar → aim → fly → results → hangar`, plus `paused` overlay and `evolve` interstitial. Each state has `enter(ctx)`, `update(dt)`, `exit()`. Screens in `ui/` mount/unmount on these transitions. Hash routes map to states for debugging (`#aim`, `#results?dist=1200`).

## 6. World generation

- Terrain: heightfield function `heightAt(x,z)` composed from biome terrain params blended across the transition band (last 14% of a 1,200 m segment). Ported from the prototype `groundY` (cliff start, amp/rough/basin) and extended with ridged noise for canyon/alpine and a basin channel so the flight corridor is always flyable.
- Chunks: 150 m long × 900 m wide strips (6 ahead, 2 behind), each a `BufferGeometry` with vertex colours + slope/height weights for the triplanar shader, a water plane if the biome has water, and instanced prop placements chosen by the biome's prop table with Poisson disc sampling on the heightfield (never on water unless `placement: 'water'`). Generation runs in a Web Worker (`world/terrain.worker.ts`) and posts transferable buffers; the main thread only uploads.
- Spawners: pickups, hazards and soft walls are placed per chunk from the biome tables and the run's PRNG, in distance bands (coins in patterns from the prototype: line/arc/sine/grid; storm fronts at the fixed GDD distances).

## 7. Render platform

- `render/renderer.ts` facade: owns `WebGLRenderer`, the `QualityTier` (`low|medium|high`, chosen by GPU tier + DPR + a 3 s probe; overridable via `?quality=`), resize, DPR cap (1.0 / 1.25 / 1.5), and exposes `stats()` (draw calls, triangles, frame ms) for the debug HUD and Playwright assertions.
- `render/atmosphere.ts`: Preetham `Sky` + sun `DirectionalLight` + hemisphere + `FogExp2` + two cloud sprite layers + stars/moon at night, all driven by a blended `Atmosphere` record from the two biomes at the current distance. Environment map: HDRI via PMREM on medium/high, `RoomEnvironment` on low. Lens flare on high.
- `render/terrain.ts`: chunk mesh builder + the triplanar/slope/height `onBeforeCompile` material (grass/rock/sand/snow/ash albedo+normal from ambientCG, KTX2). Water via `three/addons` `Water` on medium/high, animated vertex plane on low. Lava emissive + bloom.
- `render/instancer.ts`: one `InstancedMesh` per prop type per chunk from the GLTF packs; LOD by distance (drop small props past 400 m); frustum culling per chunk bounding box.
- `render/materials.ts`: material library with paint slots (`primary/secondary/accent/canopy/emissive`) applied by material name convention in the GLTFs; shared material instances across the plane roster.
- `render/plane.ts`: loads the plane GLTF by id from the manifest; falls back to the `BuildSpec` primitive assembler. Attaches prop disc, afterburner cone, twin ribbon contrails, speed-lines overlay, shadow caster. Interpolates between sim states.
- `render/post.ts`: pmndrs `postprocessing` `EffectComposer` with one merged `EffectPass` (Bloom, Vignette, ChromaticAberration, LUT3D, SMAA) + N8AO on high only. Low: bloom at half res, no AO. All toggles read from the quality tier.
- `render/particles.ts`: one sprite pool (300) + GPU `Points` for rain/snow/ash. `render/trails.ts`: ribbon geometry with age fade. `render/camera.ts`: chase rig with speed-scaled FOV, bank-following roll, boost punch, shake, crash orbit, landing dolly, aim-screen hero orbit.

Budgets (asserted in the debug stats test): ≤150 draw calls in flight, ≤400k triangles, frame ≤16.6 ms on iPhone 12 class, ≤33 ms on iPhone X class.

## 8. Assets

- `assets/manifest.ts` is typed: `{ id, url, kind: 'gltf'|'ktx2'|'hdr'|'audio'|'font', tier?: 'low'|'medium'|'high', license, source }`. Every entry's license is CC0 or CC-BY, and `public/CREDITS.txt` is generated from the manifest (`npm run assets:credits`).
- `scripts/assets-fetch.mjs` downloads packs listed in `docs/ASSETS.md`, converts to GLB with Draco/meshopt via `@gltf-transform/cli`, compresses textures to KTX2 (UASTC for normals, ETC1S for albedo), writes into `public/`. Re-runnable; idempotent.
- Loader shows the boot progress bar from real bytes. Total precached set ≤25 MB; `npm run build` fails if exceeded (`scripts/check-budget.mjs`).

## 9. UI

DOM over the canvas, vanilla TS, one module per screen with `mount(root, ctx)`, `update(dt)`, `unmount()`. CSS custom properties for the palette and safe-area insets (`env(safe-area-inset-*)`). Fonts Bungee + Rubik self-hosted. No framework. Pointer events only; `touch-action: none` on the canvas; the boost button and joystick are separate pointer captures so two thumbs work.

## 10. Save

Keep `save/save.ts` as the schema owner. Add `save/adapters.ts` (save upgrade keys ↔ sim `UpgradeLevels`), `save/migrations/vN.ts` one file per version, `save/store.ts` writing to `localStorage` and IndexedDB with the newest winning on load, and a single `navigator.storage.persist()` call after the first run.

## 11. Debug and evidence

- Hash routes: `#debug/fly?biome=blue-coast` free-fly camera through a biome, `#debug/biome=N` jump the run to a distance, `#debug/stats` overlay (fps, ms, draw calls, tris, tier), `#debug/evolve` play the ceremony, `#debug/results?dist=1234` render a results card.
- `tests/screens.spec.ts` (Playwright, 390×844, WebKit profile) screenshots every biome via the debug route into `docs/screens/` and asserts zero console errors and the draw-call budget from `renderer.stats()`.
- A phase is not done until its screenshots are in `docs/screens/` and linked from the roadmap checkpoint.

## 12. Testing

- vitest: `sim/*` (balance lock, soft-wall force math, collision), `world/*` (heightfield determinism by seed, chunk placement never on water, biome sequencing), `game/*` (economy sanity from GDD §11, missions progress on synthetic event streams, state machine transitions), `save/*` (exists), `data/*` (every registry validates; every plane model id exists in the manifest).
- Playwright: smoke (exists), screens, a scripted full run (`#debug/autopilot`) that ends on the results card with no errors.
