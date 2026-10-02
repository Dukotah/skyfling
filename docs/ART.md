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

## Quality bar (added 2026-10-02; graphics are the top priority)

The target is "at or above Epic Plane Evolution on an iPhone screen": clean stylized low-poly shapes under high-end lighting. The current build is a flat gradient over a flat plane; nothing ships that looks like that again. Every phase gate screenshots are checked against this list. A screenshot that fails any line fails the gate.

**Sky and light**
- Visible sun disc with a soft halo; sun direction matches the shadow direction and the specular on the canopy.
- Sky has a zenith-to-horizon gradient from the Preetham model, not a flat colour; haze band at the horizon that matches the fog colour exactly (no visible seam where terrain meets sky).
- At least two cloud layers with parallax; clouds are lit (brighter on the sun side).
- Night variants: stars, moon with halo, cool fog, emissive windows/lamps bloom.

**Terrain**
- Relief reads from the chase camera: hills, cliffs, a valley corridor. Never a flat plane.
- Colour varies by height and slope (grass → rock on slopes, snow on peaks, sand at the shore) with a visible detail texture at close range and no tiling pattern at distance.
- Distance fade into fog that paints depth; far ridges silhouette against the sky.
- Water reflects the sky and the sun; shoreline is visible; lava glows and blooms.

**Scenery**
- Every biome has a landmark that is recognisable in a thumbnail (windmills, arches, lighthouse, pyramids, chalets, ice spikes, volcano, skyline, floating isles, temples, lightning rods, satellites).
- Props cast and receive shadows near the camera; density reads as a place, not a scatter of cones.
- Pickups glow (emissive + bloom) and are readable against any biome palette; rings have an inner glow and a particle sparkle.

**Plane**
- Real model with distinct silhouette per tier, paint slots applied, canopy with reflections, spinning prop disc or afterburner cone with animated noise.
- Twin contrails that fade with age; speed lines on boost; shadow on the ground under the plane.
- Bank and pitch animate smoothly (interpolated between sim steps), nose follows velocity.

**Post and motion**
- Bloom only on emissives (threshold ≥0.85), never a milky wash. Subtle vignette and chromatic aberration at the edges. Per-biome LUT.
- Speed-scaled FOV, boost punch, crash shake. 60 fps on iPhone 12 at the tier the device auto-selects; the "high" tier screenshots are the ones in `docs/screens/`.

**UI**
- Bungee/Rubik, glass chips, the coral/butter/mint/navy palette; readable in sunlight (white text always has a shadow or a chip behind it). Safe-area insets respected on notch phones.

**Reference checks per gate**: a side-by-side `docs/screens/<phase>/compare.png` of our frame next to a reference frame of the same moment (aim, mid-flight, storm, crash, results, hangar) is required from Phase 1 on.

### Stack changes from the original section
- three.js current r18x; `WebGLRenderer` (WebGL2) remains the backend because the iPhone X stops at iOS 16 (WebGPU needs iOS 26). The renderer sits behind a facade so a WebGPU tier can be added later.
- Post stack uses pmndrs `postprocessing` (one merged `EffectPass`) instead of the three.js `EffectComposer` chain; N8AO for ambient occlusion on the high tier only. Antialiasing via SMAA in the pass, MSAA off, DPR capped at 1.5 / 1.25 / 1.0 by tier.
- Textures KTX2 (UASTC normals, ETC1S albedo), models GLB with Draco or meshopt, all produced by `scripts/assets-fetch.mjs`.
