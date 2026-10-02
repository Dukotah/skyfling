// Source-of-truth for every downloaded asset. `npm run assets` reads this,
// fetches/converts into public/, and generates src/assets/manifest.generated.ts
// and public/CREDITS.txt. Only CC0 / CC-BY / MIT / Apache-2.0 sources.
//
// Why these sources: the curated sites (kenney.nl, quaternius.com, ambientcg.com,
// polyhaven.com, itch.io) are unreachable from the build container's network
// policy, but GitHub raw/clone is. Every pack below is the same authors' work
// mirrored on GitHub (KayKit's and Kenney's own repos, pmndrs' CC0 market,
// three.js' Poly Haven HDRIs and example textures, Cesium's sample models,
// Babylon's CC-BY asset repo).

const RAW = 'https://raw.githubusercontent.com'

export const REPOS = {
  kaykitHex: {
    url: 'https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0',
    sparse: ['addons/kaykit_medieval_hexagon_pack/Assets/gltf', 'addons/kaykit_medieval_hexagon_pack/Textures'],
    root: 'addons/kaykit_medieval_hexagon_pack/Assets/gltf',
    license: 'CC0-1.0', author: 'Kay Lousberg (KayKit) — Medieval Hexagon Pack', link: 'https://kaylousberg.itch.io/kaykit-medieval-hexagon',
  },
  kaykitCity: {
    url: 'https://github.com/KayKit-Game-Assets/KayKit-City-Builder-Bits-1.0',
    sparse: ['addons/kaykit_city_builder_bits/Assets/gltf', 'addons/kaykit_city_builder_bits/Textures'],
    root: 'addons/kaykit_city_builder_bits/Assets/gltf',
    license: 'CC0-1.0', author: 'Kay Lousberg (KayKit) — City Builder Bits', link: 'https://kaylousberg.itch.io/city-builder-bits',
  },
  kaykitSpace: {
    url: 'https://github.com/KayKit-Game-Assets/KayKit-Space-Base-Bits-1.0',
    sparse: ['addons/kaykit_space_base_bits/Assets/gltf', 'addons/kaykit_space_base_bits/Textures'],
    root: 'addons/kaykit_space_base_bits/Assets/gltf',
    license: 'CC0-1.0', author: 'Kay Lousberg (KayKit) — Space Base Bits', link: 'https://kaylousberg.itch.io/space-base-bits',
  },
  kaykitHalloween: {
    url: 'https://github.com/KayKit-Game-Assets/KayKit-Halloween-Bits-1.0',
    sparse: ['addons/kaykit_halloween_bits/Assets/gltf', 'addons/kaykit_halloween_bits/Textures'],
    root: 'addons/kaykit_halloween_bits/Assets/gltf',
    license: 'CC0-1.0', author: 'Kay Lousberg (KayKit) — Halloween Bits', link: 'https://kaylousberg.itch.io/halloween-bits',
  },
  kenneyCity: {
    url: 'https://github.com/KenneyNL/Starter-Kit-City-Builder', sparse: ['models'], root: 'models',
    license: 'MIT', author: 'Kenney — Starter Kit City Builder', link: 'https://kenney.nl',
  },
  kenneyPlatformer: {
    url: 'https://github.com/KenneyNL/Starter-Kit-3D-Platformer', sparse: ['models'], root: 'models',
    license: 'MIT', author: 'Kenney — Starter Kit 3D Platformer', link: 'https://kenney.nl',
  },
  market: {
    url: 'https://github.com/pmndrs/market-assets', sparse: [], root: 'files', dynamicSparse: true,
    license: 'CC0-1.0', author: 'pmndrs market (CC0 models by Kenney, creativetrio, saravieira and others)', link: 'https://market.pmnd.rs',
  },
}

export const RAW_BASES = {
  three: { base: `${RAW}/mrdoob/three.js/dev/examples/`, license: 'MIT', author: 'three.js authors (examples)', link: 'https://threejs.org' },
  threeBirds: { base: `${RAW}/mrdoob/three.js/dev/examples/models/gltf/`, license: 'CC-BY-3.0', author: 'mirada (from "ROME", via three.js examples)', link: 'https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf' },
  threeHdr: { base: `${RAW}/mrdoob/three.js/dev/examples/textures/equirectangular/`, license: 'CC0-1.0', author: 'Poly Haven (via three.js examples)', link: 'https://polyhaven.com' },
  cesium: { base: `${RAW}/CesiumGS/cesium/main/Apps/SampleData/models/`, license: 'Apache-2.0', author: 'Cesium GS sample models', link: 'https://github.com/CesiumGS/cesium' },
  babylon: { base: `${RAW}/BabylonJS/Assets/master/meshes/`, license: 'CC-BY-4.0', author: 'Babylon.js Assets', link: 'https://github.com/BabylonJS/Assets' },
}

/** Model jobs. `path` is relative to the repo root (or RAW base). Options:
 *  simplify: target ratio (0..1) of triangles to keep; tex: max texture size; metalRough: convert spec-gloss. */
export const MODELS = [
  // --- Aircraft & flyers ---
  { id: 'plane-cesium-air', raw: 'cesium', path: 'CesiumAir/Cesium_Air.glb', tex: 1024 },
  { id: 'plane-aerobatic', raw: 'babylon', path: 'aerobatic_plane.glb', tex: 1024, metalRough: true, credit: 'aerobatic_plane by Babylon.js (CC-BY 4.0)' },
  { id: 'balloon', raw: 'cesium', path: 'CesiumBalloon/CesiumBalloon.glb', tex: 512 },
  { id: 'drone', raw: 'cesium', path: 'CesiumDrone/CesiumDrone.glb', tex: 512 },
  { id: 'bird-flamingo', raw: 'threeBirds', path: 'Flamingo.glb' },
  { id: 'bird-parrot', raw: 'threeBirds', path: 'Parrot.glb' },
  { id: 'bird-stork', raw: 'threeBirds', path: 'Stork.glb' },

  // --- Kenney (MIT) ---
  { id: 'coin', repo: 'kenneyPlatformer', path: 'coin.glb' },
  { id: 'cloud', repo: 'kenneyPlatformer', path: 'cloud.glb' },
  { id: 'flag', repo: 'kenneyPlatformer', path: 'flag.glb' },
  { id: 'kn-building-a', repo: 'kenneyCity', path: 'building-small-a.glb' },
  { id: 'kn-building-b', repo: 'kenneyCity', path: 'building-small-b.glb' },
  { id: 'kn-building-c', repo: 'kenneyCity', path: 'building-small-c.glb' },
  { id: 'kn-building-d', repo: 'kenneyCity', path: 'building-small-d.glb' },
  { id: 'kn-garage', repo: 'kenneyCity', path: 'building-garage.glb' },
  { id: 'kn-trees', repo: 'kenneyCity', path: 'grass-trees.glb' },
  { id: 'kn-trees-tall', repo: 'kenneyCity', path: 'grass-trees-tall.glb' },
  { id: 'kn-fountain', repo: 'kenneyCity', path: 'pavement-fountain.glb' },

  // --- KayKit Medieval Hexagon (CC0) — meadow / alpine / jungle / tundra props ---
  { id: 'windmill', repo: 'kaykitHex', path: 'buildings/red/building_windmill_red.gltf' },
  { id: 'watermill', repo: 'kaykitHex', path: 'buildings/red/building_watermill_red.gltf' },
  { id: 'home-a', repo: 'kaykitHex', path: 'buildings/red/building_home_A_red.gltf' },
  { id: 'home-b', repo: 'kaykitHex', path: 'buildings/red/building_home_B_red.gltf' },
  { id: 'church', repo: 'kaykitHex', path: 'buildings/red/building_church_red.gltf' },
  { id: 'castle', repo: 'kaykitHex', path: 'buildings/red/building_castle_red.gltf' },
  { id: 'tower-a', repo: 'kaykitHex', path: 'buildings/red/building_tower_A_red.gltf' },
  { id: 'well', repo: 'kaykitHex', path: 'buildings/red/building_well_red.gltf' },
  { id: 'tavern', repo: 'kaykitHex', path: 'buildings/red/building_tavern_red.gltf' },
  { id: 'lumbermill', repo: 'kaykitHex', path: 'buildings/red/building_lumbermill_red.gltf' },
  { id: 'mine', repo: 'kaykitHex', path: 'buildings/red/building_mine_red.gltf' },
  { id: 'grain', repo: 'kaykitHex', path: 'buildings/neutral/building_grain.gltf' },
  { id: 'tree-a', repo: 'kaykitHex', path: 'decoration/nature/tree_single_A.gltf' },
  { id: 'tree-b', repo: 'kaykitHex', path: 'decoration/nature/tree_single_B.gltf' },
  { id: 'trees-a-l', repo: 'kaykitHex', path: 'decoration/nature/trees_A_large.gltf' },
  { id: 'trees-a-m', repo: 'kaykitHex', path: 'decoration/nature/trees_A_medium.gltf' },
  { id: 'trees-b-l', repo: 'kaykitHex', path: 'decoration/nature/trees_B_large.gltf' },
  { id: 'trees-b-m', repo: 'kaykitHex', path: 'decoration/nature/trees_B_medium.gltf' },
  { id: 'rock-a', repo: 'kaykitHex', path: 'decoration/nature/rock_single_A.gltf' },
  { id: 'rock-b', repo: 'kaykitHex', path: 'decoration/nature/rock_single_B.gltf' },
  { id: 'rock-c', repo: 'kaykitHex', path: 'decoration/nature/rock_single_C.gltf' },
  { id: 'rock-d', repo: 'kaykitHex', path: 'decoration/nature/rock_single_D.gltf' },
  { id: 'rock-e', repo: 'kaykitHex', path: 'decoration/nature/rock_single_E.gltf' },
  { id: 'mountain-a', repo: 'kaykitHex', path: 'decoration/nature/mountain_A.gltf' },
  { id: 'mountain-b', repo: 'kaykitHex', path: 'decoration/nature/mountain_B.gltf' },
  { id: 'mountain-c', repo: 'kaykitHex', path: 'decoration/nature/mountain_C.gltf' },
  { id: 'mountain-a-trees', repo: 'kaykitHex', path: 'decoration/nature/mountain_A_grass_trees.gltf' },
  { id: 'hills-a-trees', repo: 'kaykitHex', path: 'decoration/nature/hills_A_trees.gltf' },
  { id: 'cloud-big', repo: 'kaykitHex', path: 'decoration/nature/cloud_big.gltf' },
  { id: 'cloud-small', repo: 'kaykitHex', path: 'decoration/nature/cloud_small.gltf' },
  { id: 'tent', repo: 'kaykitHex', path: 'decoration/props/tent.gltf' },
  { id: 'flag-red', repo: 'kaykitHex', path: 'decoration/props/flag_red.gltf' },
  { id: 'bridge-a', repo: 'kaykitHex', path: 'buildings/neutral/building_bridge_A.gltf' },
  { id: 'waterplant', repo: 'kaykitHex', path: 'decoration/nature/waterplant_A.gltf' },

  // --- KayKit City Builder Bits (CC0) — Neon City ---
  { id: 'city-a', repo: 'kaykitCity', path: 'building_A_withoutBase.gltf' },
  { id: 'city-b', repo: 'kaykitCity', path: 'building_B_withoutBase.gltf' },
  { id: 'city-c', repo: 'kaykitCity', path: 'building_C_withoutBase.gltf' },
  { id: 'city-d', repo: 'kaykitCity', path: 'building_D_withoutBase.gltf' },
  { id: 'city-e', repo: 'kaykitCity', path: 'building_E_withoutBase.gltf' },
  { id: 'city-f', repo: 'kaykitCity', path: 'building_F_withoutBase.gltf' },
  { id: 'city-g', repo: 'kaykitCity', path: 'building_G_withoutBase.gltf' },
  { id: 'city-h', repo: 'kaykitCity', path: 'building_H_withoutBase.gltf' },
  { id: 'watertower', repo: 'kaykitCity', path: 'watertower.gltf' },
  { id: 'streetlight', repo: 'kaykitCity', path: 'streetlight.gltf' },
  { id: 'car-taxi', repo: 'kaykitCity', path: 'car_taxi.gltf' },
  { id: 'car-sedan', repo: 'kaykitCity', path: 'car_sedan.gltf' },
  { id: 'bush', repo: 'kaykitCity', path: 'bush.gltf' },

  // --- KayKit Space Base Bits (CC0) — Stratosphere / Thunder Plateau ---
  { id: 'lander-a', repo: 'kaykitSpace', path: 'lander_A.gltf' },
  { id: 'lander-b', repo: 'kaykitSpace', path: 'lander_B.gltf' },
  { id: 'solarpanel', repo: 'kaykitSpace', path: 'solarpanel.gltf' },
  { id: 'windturbine-tall', repo: 'kaykitSpace', path: 'windturbine_tall.gltf' },
  { id: 'windturbine-low', repo: 'kaykitSpace', path: 'windturbine_low.gltf' },
  { id: 'basemodule-a', repo: 'kaykitSpace', path: 'basemodule_A.gltf' },
  { id: 'basemodule-c', repo: 'kaykitSpace', path: 'basemodule_C.gltf' },
  { id: 'structure-tall', repo: 'kaykitSpace', path: 'structure_tall.gltf' },
  { id: 'space-rock-a', repo: 'kaykitSpace', path: 'rock_A.gltf' },
  { id: 'space-rocks-a', repo: 'kaykitSpace', path: 'rocks_A.gltf' },
  { id: 'drill', repo: 'kaykitSpace', path: 'drill_structure.gltf' },

  // --- KayKit Halloween Bits (CC0) — dead trees (Volcano), autumn pines (Alpine), ruins (Jungle) ---
  { id: 'tree-dead-l', repo: 'kaykitHalloween', path: 'tree_dead_large.gltf' },
  { id: 'tree-dead-m', repo: 'kaykitHalloween', path: 'tree_dead_medium.gltf' },
  { id: 'pine-orange-l', repo: 'kaykitHalloween', path: 'tree_pine_orange_large.gltf' },
  { id: 'pine-orange-m', repo: 'kaykitHalloween', path: 'tree_pine_orange_medium.gltf' },
  { id: 'pine-yellow-l', repo: 'kaykitHalloween', path: 'tree_pine_yellow_large.gltf' },
  { id: 'lantern', repo: 'kaykitHalloween', path: 'lantern_standing.gltf' },
  { id: 'arch', repo: 'kaykitHalloween', path: 'arch.gltf' },
  { id: 'crypt', repo: 'kaykitHalloween', path: 'crypt.gltf' },
  { id: 'pillar', repo: 'kaykitHalloween', path: 'pillar.gltf' },
  { id: 'shrine', repo: 'kaykitHalloween', path: 'shrine.gltf' },

  // --- pmndrs market (CC0; per-model creator recorded from info.json) ---
  { id: 'boat-small', repo: 'market', path: 'models/boat-small/model.gltf' },
  { id: 'boat-large', repo: 'market', path: 'models/boat-large/model.gltf' },
  { id: 'ship-light', repo: 'market', path: 'models/ship-light/model.gltf' },
  { id: 'ship-dark', repo: 'market', path: 'models/ship-dark/model.gltf' },
  { id: 'pirate-tower', repo: 'market', path: 'models/tower/model.gltf' },
  { id: 'rock-formation', repo: 'market', path: 'models/formation-rock/model.gltf' },
  { id: 'stone-formation', repo: 'market', path: 'models/formation-stone/model.gltf' },
  { id: 'rock-formation-l', repo: 'market', path: 'models/formation-large-rock/model.gltf' },
  { id: 'stone-formation-l', repo: 'market', path: 'models/formation-large-stone/model.gltf' },
  { id: 'palm-long', repo: 'market', path: 'models/palm-long/model.gltf' },
  { id: 'palm-short', repo: 'market', path: 'models/palm-short/model.gltf' },
  { id: 'palm-detailed-long', repo: 'market', path: 'models/palm-detailed-long/model.gltf' },
  { id: 'palm-detailed-short', repo: 'market', path: 'models/palm-detailed-short/model.gltf' },
  { id: 'tree-big', repo: 'market', path: 'models/tree-big/model.gltf' },
  { id: 'tree-small', repo: 'market', path: 'models/tree-small/model.gltf' },
  { id: 'tree-round', repo: 'market', path: 'models/low-poly-tree/model.gltf', simplify: 0.3 },
  { id: 'house-3', repo: 'market', path: 'models/house-3/model.gltf' },
  { id: 'house-5', repo: 'market', path: 'models/house-5/model.gltf' },
  { id: 'house-7', repo: 'market', path: 'models/house-7/model.gltf' },
  { id: 'library', repo: 'market', path: 'models/library-large/model.gltf' },
  { id: 'ferris-wheel', repo: 'market', path: 'models/ferris-wheel/model.gltf' },
  { id: 'wind-turbine', repo: 'market', path: 'models/wind-turbine/model.gltf' },
  { id: 'bridge-stone', repo: 'market', path: 'models/bridge-01/model.gltf' },
  { id: 'chest', repo: 'market', path: 'models/chest/model.gltf' },
  { id: 'present', repo: 'market', path: 'models/present/model.gltf' },
  { id: 'crate', repo: 'market', path: 'models/sci-fi-crate/model.gltf' },
  { id: 'cactus', repo: 'market', path: 'models/cactus/model.gltf', simplify: 0.04 },
  { id: 'barn', repo: 'market', path: 'models/barn/model.gltf', simplify: 0.08, tex: 1024 },
]

/** PBR texture sets (ambientCG via pmndrs market, CC0). Each map is resized and saved as webp. */
export const MATERIALS = [
  { id: 'grass', repo: 'market', dir: 'materials/grass', maps: { color: 'Grass001_1K_Color.jpg', normal: 'Grass001_1K_Normal.jpg', rough: 'Grass001_1K_Roughness.jpg' }, size: 1024, credit: 'ambientCG Grass001 (CC0)' },
  { id: 'rock', repo: 'market', dir: 'materials/rock', maps: { color: 'Rock020_1K_Color.jpg', normal: 'Rock020_1K_Normal.jpg', rough: 'Rock020_1K_Roughness.jpg' }, size: 1024, credit: 'ambientCG Rock020 (CC0)' },
]

/** Single textures / sprites (three.js examples, MIT). */
export const TEXTURES = [
  { id: 'waternormals', raw: 'three', path: 'textures/waternormals.jpg', size: 512, format: 'jpg' },
  { id: 'lensflare0', raw: 'three', path: 'textures/lensflare/lensflare0.png', format: 'png' },
  { id: 'lensflare3', raw: 'three', path: 'textures/lensflare/lensflare3.png', format: 'png' },
  { id: 'cloud-noise', raw: 'three', path: 'textures/lava/cloud.png', size: 512, format: 'webp' },
  { id: 'lavatile', raw: 'three', path: 'textures/lava/lavatile.jpg', size: 512, format: 'webp' },
  { id: 'sprite-spark', raw: 'three', path: 'textures/sprites/spark1.png', format: 'png' },
  { id: 'sprite-disc', raw: 'three', path: 'textures/sprites/disc.png', format: 'png' },
  { id: 'sprite-circle', raw: 'three', path: 'textures/sprites/circle.png', format: 'png' },
  { id: 'sprite-snow', raw: 'three', path: 'textures/sprites/snowflake1.png', format: 'png' },
]

/** HDRIs (Poly Haven CC0, 1k). Hangar lighting and the two atmosphere extremes; biome lighting is PMREM'd from the sky. */
export const HDRIS = [
  { id: 'venice-sunset', raw: 'threeHdr', path: 'venice_sunset_1k.hdr', credit: 'Venice Sunset by Greg Zaal (Poly Haven, CC0)' },
  { id: 'moonless-golf', raw: 'threeHdr', path: 'moonless_golf_1k.hdr', credit: 'Moonless Golf by Greg Zaal (Poly Haven, CC0)' },
]

/** Fonts (Google Fonts, SIL OFL 1.1). Fetched via the CSS API, latin subset only. */
export const FONTS = [
  { family: 'Bungee', weights: [400], css: 'https://fonts.googleapis.com/css2?family=Bungee&display=swap' },
  { family: 'Rubik', weights: [400, 500, 700], css: 'https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;700&display=swap' },
]
