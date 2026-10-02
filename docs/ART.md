# Art direction & rendering stack

## Look
Stylized low-poly with *high-end lighting*. Think "Epic Plane Evolution meets Alto's Odyssey": chunky readable shapes, saturated-but-tasteful palette per biome, soft shadows, bloom on emissives, fog that paints distance. Nothing should look like default-grey three.js.

Palette anchors: coral `#ff6b4a`, butter `#ffd23f`, mint `#5fd3b5`, navy `#1f2a44`, paper `#f3ecdf`. Each biome overrides sky/ground/fog; UI keeps the anchor palette.

## Rendering stack (three.js r16x, ES modules via Vite)
- `WebGLRenderer` sRGB output, ACES filmic tone mapping, exposure ~1.05, `shadowMap` PCFSoft.
- Materials: `MeshStandardMaterial` for everything lit; environment from an HDRI (`RGBELoader` + `PMREMGenerator`) so metals and canopies read. Flat-shaded models from the packs keep their faceted charm.
- **Post stack** (`EffectComposer`): RenderPass → UnrealBloomPass (threshold 0.85, strength 0.35, radius 0.6) → SSAO (GTAO/N8AO, low cost settings, disable on low-tier devices) → vignette + subtle chromatic aberration + color LUT as a final ShaderPass. Provide a quality setting (Low/Med/High) auto-chosen by `devicePixelRatio`, GPU tier (`detect-gpu`), and a 3-second fps probe.
- **Sky**: `three/examples/jsm/objects/Sky` (Preetham) driven by sun elevation per biome, plus stars `Points` and a moon sprite at night. Sun lens flare (`Lensflare` addon).
- **Water**: `three/examples/jsm/objects/Water` with the stock `waternormals.jpg`, reflection enabled on Med/High, flat animated plane on Low. Lava = emissive animated noise texture + bloom.
- **Clouds**: billboarded sprite atlases (CC0 cloud PNGs) in two layers (distant, near) + the storm fronts as dense dark sprite walls with lightning emissive flashes.
- **Terrain**: chunked heightfield 900×160 m, 90×16 segs, vertex-colored + a blended triplanar detail (grass/rock/sand/snow textures from the packs) in a custom `onBeforeCompile` hook. Slope-based rock blending, height-based snow, shore sand.
- **Scenery**: `InstancedMesh` per prop type per chunk from the GLTF packs; ~40–80 instances per chunk; LOD by distance (drop small props past 400 m).
- **Plane**: GLTF models, cast shadows, canopy material with transmission/clearcoat, prop blur disc, afterburner cone with animated noise, twin ribbon contrails (shader-based, fade by age), boost speed-lines overlay.
- **Particles**: one sprite pool (300) + GPU points for rain/snow/ash. Coin halo sprites, ring glow, thermals as rising sprite columns with a transparent cylinder.
- **Camera**: chase cam with speed-scaled FOV (60→82), bank-following roll, boost punch, shake, cinematic crash orbit and landing dolly.
- **UI**: DOM. Fonts Bungee + Rubik. Glass chips, pills, count-up numbers, the HUD layout from the prototype (distance + best bar + mission tracker left; coins/speed/chips right; fuel bottom-left; boost ring bottom-right).

## Performance budget
- ≤150 draw calls in flight, ≤400k triangles on screen, textures ≤2048² and KTX2/Basis-compressed where possible.
- Low tier: no SSAO, no water reflection, bloom half-res, DPR 1. High tier: DPR up to 2.
- Keep the whole precached asset set under 25 MB so the PWA installs quickly.
