# Assets — what is actually used (2026-10-02)

Fetched and converted by `npm run assets` (`scripts/assets-fetch.mjs`, manifest in `scripts/assets.manifest.mjs`) into `public/models|textures|hdr|fonts`. The script generates `src/assets/manifest.generated.ts` (typed ids, sizes, bounds, node names) and `public/CREDITS.txt`. Only CC0, CC-BY, MIT or Apache-2.0 sources. The original site list below is kept for reference; the curated sites are blocked from the build container, so everything comes from the same authors' GitHub mirrors.

| Role | Source (GitHub) | License |
|---|---|---|
| Meadow / alpine / jungle / tundra props (trees, rocks, mountains, hills, clouds, windmill, watermill, homes, church, castle, towers, well, tavern, lumbermill, mine, grain, bridge, tent, flags, water plants) | KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0 | CC0 |
| Neon City buildings A–H, water tower, streetlight, cars, bush | KayKit-Game-Assets/KayKit-City-Builder-Bits-1.0 | CC0 |
| Stratosphere / Thunder Plateau (landers, solar panels, wind turbines, base modules, structures, rocks, drill) | KayKit-Game-Assets/KayKit-Space-Base-Bits-1.0 | CC0 |
| Dead trees, autumn pines, lantern, arch, crypt, pillar, shrine | KayKit-Game-Assets/KayKit-Halloween-Bits-1.0 | CC0 |
| Coin, cloud, flag, small buildings, garage, trees, fountain | KenneyNL/Starter-Kit-3D-Platformer, KenneyNL/Starter-Kit-City-Builder | MIT |
| Boats, ships, pirate tower, rock/stone formations, palms, trees, houses, library, ferris wheel, wind turbine, stone bridge, chest, present, crate, cactus, barn | pmndrs/market-assets (Kenney, creativetrio, saravieira, Saltedsea) | CC0 |
| Grass001 and Rock020 PBR sets | pmndrs/market-assets (ambientCG) | CC0 |
| Puddle Jumper plane (tier 2), hot-air balloon, patrol drone | CesiumGS/cesium sample models | Apache-2.0 |
| Hornet plane (tier 3) | BabylonJS/Assets aerobatic_plane.glb | CC-BY 4.0 |
| Birds (stork, flamingo, parrot) | mrdoob/three.js examples (mirada) | CC-BY 3.0 |
| Water normals, lens flare, lava tile, cloud noise, sprites | mrdoob/three.js examples | MIT |
| HDRIs venice_sunset, moonless_golf | mrdoob/three.js examples (Poly Haven) | CC0 |
| Fonts Bungee, Rubik | Google Fonts | OFL 1.1 |

Generated in code (no download): terrain detail sets for sand/snow/ash, cloud sprites, soft sprite, moon, the Paper Dart and the procedural plane tiers 1 and 4–9, all pickups except coin/balloon/crate/chest, all landmarks marked `proc:` (pyramid, obelisk, lighthouse, pier, ice spike, volcano, billboard, blimp, sky isle, temple, lightning rod, satellite, canyon arch), all audio.

To add a pack later: add an entry to `scripts/assets.manifest.mjs`, run `npm run assets`, reference the id from a registry file.

---

## Original wish list (for reference)


Claude Code: download these with `curl` into `public/`, convert to glTF/GLB if needed (`gltf-transform`), and build `src/assets/manifest.ts` listing every file with its role. If a named pack has moved or been renamed, find the equivalent from the same author and note it in docs/DECISIONS.md.

## Models
| Role | Pack | Author / URL | Notes |
|---|---|---|---|
| Planes (tiers 1–8) | Ultimate Low-Poly Planes / "Planes" pack | Quaternius — https://quaternius.com | Several stylized planes incl. biplane, Cessna-like, fighter, jet. CC0. Re-color via material slots. |
| Spaceplane (tiers 8–9) | Ultimate Space Kit | Quaternius | pick two ship silhouettes |
| Paper Dart (tier 0) | model it: 3 triangles, 1 fold crease | — | keep from prototype |
| Nature (trees, rocks, bushes, pines, cactus, palms) | Nature Kit + Nature Pack extended | Kenney — https://kenney.nl/assets/nature-kit | CC0, hundreds of pieces |
| Stylized nature alt | Ultimate Stylized Nature Pack | Quaternius | use for Jungle + Alpine variety |
| City (towers, billboards, lamps) | City Kit (Suburban / Commercial) + Modular Buildings | Kenney | neon-ify with emissive window textures |
| Castle/temple ruins (Jungle) | Castle Kit | Kenney | temples, arches |
| Pyramids, dunes props | model simple; obelisks from Castle Kit | — | |
| Lighthouse, pier, boats | Pirate Kit / Watercraft Pack | Kenney | |
| Windmill, farm | Survival Kit / Nature Kit farm pieces | Kenney | |
| Birds | KayKit Animals or Quaternius Animated Animals (bird/eagle) | Kay Lousberg (CC0) / Quaternius | animated flap |
| Balloons, blimp | Space Kit balloon-ish shapes or model (sphere + basket) | — | |
| Satellites (Stratosphere) | Space Kit | Kenney | |

## Textures
| Role | Source |
|---|---|
| Terrain detail (grass, rock, sand, snow, ash) | ambientCG (CC0) — https://ambientcg.com — Grass004, Rock030, Ground037, Snow003, Lava004 (1k, JPG, albedo + normal) |
| Water normals | three.js examples `textures/waternormals.jpg` (MIT) |
| Cloud sprite atlas | CC0 cloud PNGs (e.g. OpenGameArt "cloud sprites" by Kenney/others) — or paint 4 blobs in-app as a fallback |
| HDRI (lighting) | Poly Haven (CC0) — https://polyhaven.com — `kloofendal_48d_partly_cloudy_puresky` 1k and `moonless_golf` 1k for night |
| Lens flare | three.js examples `textures/lensflare/*.png` |
| UI icons | Kenney Game Icons (CC0) |

## Audio
| Role | Source |
|---|---|
| SFX (coins, pops, whoosh, impacts, UI) | Kenney Audio packs: Impact Sounds, Interface Sounds, Casino (coins), Sci-Fi (boost) — CC0 |
| Music beds (one per biome mood, 6 loops) | Kevin MacLeod (CC-BY, credit) or Kenney Music Jingles; keep loops ≤40 s, OGG + M4A |
| Engine/prop loop | synthesize in WebAudio (sawtooth + lowpass, from prototype) |

## Fonts
Bungee (display), Rubik (body) — Google Fonts, self-host the WOFF2 in `public/fonts`.
