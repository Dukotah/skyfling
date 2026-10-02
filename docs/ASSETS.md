# Assets to download (all CC0 unless noted — verify the license page before use and record it in public/CREDITS.txt)

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
