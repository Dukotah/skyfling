/**
 * Biome data — pure data module, no three.js import.
 * Source of truth: docs/DESIGN_BIBLE.md §2 + docs/GDD.md §4-5.
 * Colors as hex strings. All 16 biomes (12 base + 4 new worlds).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TerrainParams {
  /** Heightfield amplitude in metres (peak deviation from mean). */
  amplitude: number;
  /** 0 = butter-smooth, 1 = maximally jagged. */
  roughness: number;
  /**
   * Basin factor: 0 = no valley floor constraint, 1 = strong flat-valley
   * channel carved along the flight path.
   */
  basin: number;
}

export interface LandmarkSpec {
  /** Short identifier used for instanced-mesh prefab key. */
  id: string;
  /** Human-readable label. */
  label: string;
  /** Coin reward for threading/flying the landmark (0 = no direct reward). */
  coinReward: number;
  /** Special bonus description if any. */
  bonus?: string;
}

export interface HazardSpec {
  /** Short identifier. */
  id: string;
  /** Human-readable label. */
  label: string;
  /** Hit effect on the player. */
  effect: string;
  /** Visual/audio telegraph window in seconds (0 = immediate). */
  telegraphSeconds: number;
}

export type PickupBias =
  | 'thermals'
  | 'balloons'
  | 'rings'
  | 'fuel'
  | 'shields'
  | 'nitro'
  | 'stars'
  | 'coins'
  | 'boost-rings'
  | 'shield-orbs'
  | 'mixed';

export type SoftWallType =
  | 'storm-front'
  | 'sandstorm'
  | 'ash-cloud'
  | 'crosswind-corridor'
  | 'thin-air'
  | 'none';

export interface Biome {
  // ---- Identity ----
  /** Canonical numeric id (1-based, matches GDD §4 table order; 13-16 = new worlds). */
  id: number;
  /** Display name. */
  name: string;
  /** World ordering for run sequencing (same as id for now). */
  order: number;

  // ---- Atmosphere / palette ----
  /** Sky zenith hex color. */
  skyColor: string;
  /** Fog color hex (matches FogExp2). */
  fogColor: string;
  /** Dominant ground/terrain tint hex. */
  groundColor: string;
  /** Water/ocean tint hex (null if no water surface in this biome). */
  waterColor: string | null;
  /** Preetham sun elevation in radians (0 = horizon, π/2 = zenith). */
  sunElevation: number;

  // ---- Terrain generation ----
  terrain: TerrainParams;

  // ---- Signature landmark ----
  landmark: LandmarkSpec;

  // ---- Primary hazard ----
  hazard: HazardSpec;

  // ---- Pickup bias ----
  pickupBias: PickupBias;

  // ---- Soft wall ----
  softWall: SoftWallType;

  // ---- Dynamic element ----
  /** Short description of the runtime-animated/scripted element. */
  dynamicElement: string;

  // ---- Variants ----
  /** True if a night variant exists (weekly challenge rotation). */
  hasNightVariant: boolean;

  // ---- Build notes ----
  /** Implementation notes for the renderer/world team. */
  buildNotes: string;
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

export const BIOMES: Biome[] = [
  // ---- Biome 1 ----
  {
    id: 1,
    name: 'Green Meadow',
    order: 1,
    skyColor: '#a8d8ea',
    fogColor: '#c8e6c9',
    groundColor: '#5a8a3c',
    waterColor: null,
    sunElevation: 0.9,
    terrain: { amplitude: 22, roughness: 0.28, basin: 0.45 },
    landmark: {
      id: 'windmill',
      label: 'Windmill Farm',
      coinReward: 0,
      bonus: 'Thermals spawn at blade tips',
    },
    hazard: {
      id: 'birds',
      label: 'Bird Flock',
      effect: '-speed, scatter on hit',
      telegraphSeconds: 0,
    },
    pickupBias: 'thermals',
    softWall: 'storm-front',
    dynamicElement: 'Hot-air balloons drift on a slow sinusoidal path; pop = bounce + coins.',
    hasNightVariant: true,
    buildNotes:
      'Rolling FBM heightfield. Windmill props spin proportionally to player speed. ' +
      'Balloon mesh is a sphere + basket on a SplineCurve; pop triggers confetti sprites.',
  },

  // ---- Biome 2 ----
  {
    id: 2,
    name: 'Red Canyon',
    order: 2,
    skyColor: '#e8b86d',
    fogColor: '#d4714a',
    groundColor: '#c0392b',
    waterColor: null,
    sunElevation: 0.38,
    terrain: { amplitude: 55, roughness: 0.62, basin: 0.7 },
    landmark: {
      id: 'canyon-arch',
      label: 'Natural Arch',
      coinReward: 25,
      bonus: 'Thread arch for ring of coins',
    },
    hazard: {
      id: 'rockfall-burst',
      label: 'Rockfall Updraft Burst',
      effect: 'Unexpected vertical jolt ±20 m/s',
      telegraphSeconds: 0.6,
    },
    pickupBias: 'rings',
    softWall: 'storm-front',
    dynamicElement: 'Mesa shadow sweeps slowly across the valley floor as sun angle shifts over the segment.',
    hasNightVariant: false,
    buildNotes:
      'Deep basin (high basin factor). Mesa tops are flat-capped heightfield. ' +
      'Arch = torus-like tunnel mesh, InstancedMesh x4 per chunk. ' +
      'Rockfall = particle burst + upward impulse on proximity trigger.',
  },

  // ---- Biome 3 ----
  {
    id: 3,
    name: 'Blue Coast',
    order: 3,
    skyColor: '#5ba4cf',
    fogColor: '#a8d8f0',
    groundColor: '#e8d5b0',
    waterColor: '#1b7fc4',
    sunElevation: 0.72,
    terrain: { amplitude: 18, roughness: 0.2, basin: 0.35 },
    landmark: {
      id: 'lighthouse',
      label: 'Lighthouse',
      coinReward: 0,
      bonus: 'Beacon flash = brief ring spawn nearby',
    },
    hazard: {
      id: 'seagull-flock',
      label: 'Seagull Flock',
      effect: '-speed on hit',
      telegraphSeconds: 0,
    },
    pickupBias: 'fuel',
    softWall: 'storm-front',
    dynamicElement: 'Sailboats drift along sine-wave paths; pier extends into the water as a low-altitude gate.',
    hasNightVariant: true,
    buildNotes:
      'THREE.Water plane at Y=0 (reflection on Med+). Beach = sand vertex color blend at height<4 m. ' +
      'Lighthouse rotating Lensflare beacon on a 3 s cycle.',
  },

  // ---- Biome 4 ----
  {
    id: 4,
    name: 'Golden Dunes',
    order: 4,
    skyColor: '#f5c842',
    fogColor: '#e8a830',
    groundColor: '#c8922a',
    waterColor: '#3a8c6e',
    sunElevation: 0.55,
    terrain: { amplitude: 30, roughness: 0.18, basin: 0.25 },
    landmark: {
      id: 'pyramid',
      label: 'Pyramid Complex',
      coinReward: 0,
      bonus: 'Oasis thermal: strong updraft column at oasis centre',
    },
    hazard: {
      id: 'sandstorm',
      label: 'Sandstorm Band',
      effect: 'Horizontal push sideways + grit overlay',
      telegraphSeconds: 1.0,
    },
    pickupBias: 'thermals',
    softWall: 'sandstorm',
    dynamicElement: 'Sandstorm band advances toward the player; edge opacity ramps over 8 s before soft-wall engage.',
    hasNightVariant: false,
    buildNotes:
      'Smooth sine-layered dune heightfield. Pyramid = 4 triangular faces InstancedMesh. ' +
      'Oasis = low flat patch + THREE.Water pool 30 m radius + palm tree instances. ' +
      'Sandstorm = dense FogExp2 lerp + horizontal wind impulse + screen grit ShaderPass.',
  },

  // ---- Biome 5 ----
  {
    id: 5,
    name: 'Alpine Forest',
    order: 5,
    skyColor: '#7ec8e3',
    fogColor: '#b0cce0',
    groundColor: '#2d5a1b',
    waterColor: null,
    sunElevation: 0.65,
    terrain: { amplitude: 70, roughness: 0.58, basin: 0.55 },
    landmark: {
      id: 'ski-lift',
      label: 'Ski Lift',
      coinReward: 0,
      bonus: 'Cables are hazards; threading the cabin window = 30 coins',
    },
    hazard: {
      id: 'cables',
      label: 'Ski Lift Cables',
      effect: '-1 shield on hit',
      telegraphSeconds: 0,
    },
    pickupBias: 'shields',
    softWall: 'storm-front',
    dynamicElement: 'Ski-lift gondolas ride cable splines at variable spacing; speed tied to ambient wind uniform.',
    hasNightVariant: false,
    buildNotes:
      'Steep valley terrain. Pine trees = InstancedMesh billboards at distance, low-poly cones close. ' +
      'Chalet = box-stack props. Cable = CatmullRomCurve3 LineSegments; gondola = box on spline follower. ' +
      'Hit test = capsule vs. line segment.',
  },

  // ---- Biome 6 ----
  {
    id: 6,
    name: 'White Tundra',
    order: 6,
    skyColor: '#d0eaf8',
    fogColor: '#e8f4fc',
    groundColor: '#dde8f0',
    waterColor: '#8ab4cc',
    sunElevation: 0.22,
    terrain: { amplitude: 14, roughness: 0.12, basin: 0.15 },
    landmark: {
      id: 'frozen-lake',
      label: 'Frozen Lake',
      coinReward: 0,
      bonus: 'Splashdown = slide (safe, ×2 distance score for the slide)',
    },
    hazard: {
      id: 'ice-crystals',
      label: 'Ice Crystal Fields',
      effect: '-12% speed on hit',
      telegraphSeconds: 0,
    },
    pickupBias: 'stars',
    softWall: 'storm-front',
    dynamicElement: 'Aurora ripples across the night sky via vertex-shader ShaderMaterial on a wide quad.',
    hasNightVariant: true,
    buildNotes:
      'Near-flat heightfield; snow vertex blend at all heights. Ice crystals = InstancedMesh thin BoxGeometry shards, ' +
      'rotated randomly, emissive teal. Frozen lake = flat reflective PlaneGeometry (no wave). ' +
      'Aurora only on night variant: additive ShaderMaterial quad, sine-waved UVs.',
  },

  // ---- Biome 7 ----
  {
    id: 7,
    name: 'Ash Volcano',
    order: 7,
    skyColor: '#4a2c2a',
    fogColor: '#6b3d38',
    groundColor: '#2c2522',
    waterColor: '#cc2200',
    sunElevation: 0.18,
    terrain: { amplitude: 80, roughness: 0.75, basin: 0.6 },
    landmark: {
      id: 'lava-geyser',
      label: 'Lava Geyser',
      coinReward: 0,
      bonus: 'Ride the updraft column for +nitro top-up',
    },
    hazard: {
      id: 'lava-ash',
      label: 'Lava & Ash Cloud',
      effect: 'Lava = crash; ash cloud = fuel 2× drain',
      telegraphSeconds: 0.5,
    },
    pickupBias: 'nitro',
    softWall: 'ash-cloud',
    dynamicElement: 'Geyser erupts on 6 s cycle: extrude-animate cylinder mesh upward, emissive lava texture, updraft impulse at peak.',
    hasNightVariant: false,
    buildNotes:
      'Rugged FBM heightfield. Lava pools = emissive animated noise PlaneGeometry (UnrealBloom threshold 0.6). ' +
      'Smoke columns = rising sprite pool. Ash cloud soft wall = dense FogExp2 + fuel-drain zone. ' +
      'Water surface reused as lava with hot-color tint + emissive.',
  },

  // ---- Biome 8 ----
  {
    id: 8,
    name: 'Neon City',
    order: 8,
    skyColor: '#0d0d1a',
    fogColor: '#1a0a2e',
    groundColor: '#1a1a2e',
    waterColor: null,
    sunElevation: 0.05,
    terrain: { amplitude: 4, roughness: 0.05, basin: 0.05 },
    landmark: {
      id: 'skyscraper-ring',
      label: 'Rooftop Ring Gauntlet',
      coinReward: 60,
      bonus: 'Hit all 5 rooftop rings in sequence for ×3 coins 10 s',
    },
    hazard: {
      id: 'wind-between-towers',
      label: 'Tower Wind Channel',
      effect: 'Lateral push; fight with steering',
      telegraphSeconds: 0.8,
    },
    pickupBias: 'rings',
    softWall: 'storm-front',
    dynamicElement: 'Billboard panels cycle neon advertisements; blimp drifts a sine path above the skyline.',
    hasNightVariant: true,
    buildNotes:
      'Flat heightfield. Skyscrapers = InstancedMesh BoxGeometry (4 types, 1 draw call each). ' +
      'Emissive window texture on MeshStandardMaterial (emissiveMap atlas). ' +
      'Neon signs = additive SpriteMaterial. Wind channel = AABB zone triggers lateral impulse. ' +
      'Night variant is canonical; day variant dims emissives.',
  },

  // ---- Biome 9 ----
  {
    id: 9,
    name: 'Sky Isles',
    order: 9,
    skyColor: '#5b9bd5',
    fogColor: '#add8e6',
    groundColor: '#4caf50',
    waterColor: '#1e90ff',
    sunElevation: 0.78,
    terrain: { amplitude: 0, roughness: 0.0, basin: 0.0 },
    landmark: {
      id: 'floating-isle',
      label: 'Floating Isle Ring Gate',
      coinReward: 40,
      bonus: 'Waterfall from isle edge = thermal column below',
    },
    hazard: {
      id: 'gusts',
      label: 'Gust Pockets',
      effect: 'Random directional impulse ±15 m/s',
      telegraphSeconds: 0.3,
    },
    pickupBias: 'balloons',
    softWall: 'storm-front',
    dynamicElement: 'Floating isles bob on a slow vertical sine wave; waterfalls = downward particle streams.',
    hasNightVariant: false,
    buildNotes:
      'No ground heightfield; isles = extruded disc + grass top InstancedMesh, seeded positions in a 3D volume. ' +
      'Ocean floor far below rendered as low-res water plane. ' +
      'Gust = sphere-overlap trigger fires random impulse with 0.3 s warning flash.',
  },

  // ---- Biome 10 ----
  {
    id: 10,
    name: 'Jungle Ruins',
    order: 10,
    skyColor: '#2d5a1b',
    fogColor: '#3a6b2a',
    groundColor: '#1b3a10',
    waterColor: '#1a6644',
    sunElevation: 0.6,
    terrain: { amplitude: 35, roughness: 0.45, basin: 0.5 },
    landmark: {
      id: 'temple',
      label: 'Vine-Arch Temple',
      coinReward: 20,
      bonus: 'Thread the temple arch for coin arc',
    },
    hazard: {
      id: 'toucan-flock',
      label: 'Toucan Flock',
      effect: '-speed on hit',
      telegraphSeconds: 0,
    },
    pickupBias: 'coins',
    softWall: 'storm-front',
    dynamicElement: 'Vine arches grow over the run (progressive texture alpha blend on arch mesh, resets per segment).',
    hasNightVariant: false,
    buildNotes:
      'Dense canopy via layered billboard sheets. Temple = InstancedMesh stone blocks + vegetation overlay. ' +
      'Waterfalls = downward sprite stream + pool splash on landing. ' +
      'Toucan flock = boids on a spline, 8 low-poly birds InstancedMesh.',
  },

  // ---- Biome 11 ----
  {
    id: 11,
    name: 'Thunder Plateau',
    order: 11,
    skyColor: '#2b3a4a',
    fogColor: '#3c4e5e',
    groundColor: '#5a5a5a',
    waterColor: null,
    sunElevation: 0.1,
    terrain: { amplitude: 28, roughness: 0.32, basin: 0.3 },
    landmark: {
      id: 'lightning-rod',
      label: 'Lightning Rod Cluster',
      coinReward: 0,
      bonus: 'Fly between rods during strike = ×2 coins 5 s',
    },
    hazard: {
      id: 'lightning-crosswind',
      label: 'Persistent Crosswind & Lightning',
      effect: 'Crosswind = constant yaw push; lightning = −40% speed',
      telegraphSeconds: 1.0,
    },
    pickupBias: 'shields',
    softWall: 'crosswind-corridor',
    dynamicElement: 'Lightning strikes fire from overhead on a random 4–12 s cycle; strike zone flagged with a dim glow 1 s ahead.',
    hasNightVariant: false,
    buildNotes:
      'High mesa heightfield. Lightning = radial LineSegments, seeded per run (ghost-valid). ' +
      'Wind farm = InstancedMesh turbines with spinning blades. Crosswind soft wall triggers at 300 m mark.',
  },

  // ---- Biome 12 ----
  {
    id: 12,
    name: 'Stratosphere',
    order: 12,
    skyColor: '#0a0a1a',
    fogColor: '#0d1a2e',
    groundColor: '#d4e8f8',
    waterColor: null,
    sunElevation: 0.12,
    terrain: { amplitude: 6, roughness: 0.08, basin: 0.0 },
    landmark: {
      id: 'satellite',
      label: 'Orbital Satellite',
      coinReward: 0,
      bonus: 'Fly within 10 m = coin magnet burst 3 s',
    },
    hazard: {
      id: 'thin-air',
      label: 'Thin Air (above 400 m alt)',
      effect: 'Lift ×0.6; stall risk increases',
      telegraphSeconds: 0,
    },
    pickupBias: 'stars',
    softWall: 'thin-air',
    dynamicElement: 'Aurora Borealis curtain via additive ShaderMaterial quad; satellite drifts on a slow circular orbit path.',
    hasNightVariant: false,
    buildNotes:
      'Cloud tops as the "ground" — dense sprite cloud layer at Y=0 with thin terrain above. ' +
      'Stars = Points geometry, ~1000 pts. Earth curve visible at horizon via low-saturation haze. ' +
      'Starliner plane unlocks orbital skip here (0.9 s zero-g). ' +
      'Cloud Atoll secret: hold 8 s above ceiling → bonus biome (Sky Isles terrain reuse).',
  },

  // ---- Biome 13 (new world) ----
  {
    id: 13,
    name: 'Inside the Thunderhead',
    order: 13,
    skyColor: '#0c0610',
    fogColor: '#1a0d28',
    groundColor: '#1a1a2e',
    waterColor: null,
    sunElevation: 0.04,
    terrain: { amplitude: 10, roughness: 0.15, basin: 0.0 },
    landmark: {
      id: 'the-eye',
      label: 'The Eye (calm cylinder)',
      coinReward: 150,
      bonus: 'Thread the 120 m calm cylinder: 150 coins + boost reset',
    },
    hazard: {
      id: 'lightning-discharge',
      label: 'Charge Cell Lightning Discharge',
      effect: '8-ray discharge = −1 shield',
      telegraphSeconds: 0.8,
    },
    pickupBias: 'shield-orbs',
    softWall: 'none',
    dynamicElement: 'Updraft columns pulse on a 4 s cycle; pressure wave every 90 s slams altitude physics for 3 s.',
    hasNightVariant: false,
    buildNotes:
      'Near-black purple FogExp2 density 0.018. Two cloud-sprite layers (additive blending). ' +
      'Charge cells = icosahedron wireframe meshes, bloom threshold 0.6. ' +
      'Discharge = radial LineSegments fan. Vertical flight is primary axis — camera can pitch ±90°. ' +
      'The Eye: transparent cylinder mesh, bright blue interior lighting, calm-zone physics override.',
  },

  // ---- Biome 14 (new world) ----
  {
    id: 14,
    name: 'The Collapsing Sky-City',
    order: 14,
    skyColor: '#b07040',
    fogColor: '#c0886050',
    groundColor: '#888888',
    waterColor: null,
    sunElevation: 0.3,
    terrain: { amplitude: 5, roughness: 0.05, basin: 0.0 },
    landmark: {
      id: 'grand-spire',
      label: 'The Grand Spire (clocktower)',
      coinReward: 0,
      bonus: 'Topples at 900 m mark; thread all 5 debris rings = "Last Bell" (×3 coins, 15 s)',
    },
    hazard: {
      id: 'falling-masonry',
      label: 'Falling Masonry Debris',
      effect: '−1 shield on hit',
      telegraphSeconds: 0.5,
    },
    pickupBias: 'coins',
    softWall: 'none',
    dynamicElement: 'Ambient dust thickens over run; by 1 km visibility −30% (coin radar becomes essential). Spire topples at 900 m keyframe trigger.',
    hasNightVariant: false,
    buildNotes:
      'Buildings = InstancedMesh blocks (4 types, 1 draw call each). ' +
      'Debris = ~12 pre-computed bezier arcs (seeded → ghost-valid). ' +
      'Spire = keyframed pivot at the 900 m distance trigger. ' +
      'Dust = progressive FogExp2 density lerp over run time. Under 150 draw calls.',
  },

  // ---- Biome 15 (new world) ----
  {
    id: 15,
    name: 'The Sky-Creature Migration',
    order: 15,
    skyColor: '#1a2a4a',
    fogColor: '#2a3a5a',
    groundColor: '#3a5a7a',
    waterColor: '#1a3a5a',
    sunElevation: 0.25,
    terrain: { amplitude: 8, roughness: 0.1, basin: 0.0 },
    landmark: {
      id: 'alpha-whale',
      label: 'The Alpha Whale (450 m bioluminescent sky-whale)',
      coinReward: 200,
      bonus: 'Fly its full underside clean = "Shadow Run" (200 coins, full fuel + nitro)',
    },
    hazard: {
      id: 'whale-tail-slap',
      label: 'Whale Tail Slap',
      effect: '−1 shield; shadow telegraphs on terrain 2 s ahead',
      telegraphSeconds: 2.0,
    },
    pickupBias: 'boost-rings',
    softWall: 'none',
    dynamicElement: 'Migration heading curves 15° over 800 m, slowly closing entry lane (time pressure, no timer visible).',
    hasNightVariant: false,
    buildNotes:
      'Whales/mantas = InstancedMesh on CatmullRom paths with per-instance phase offset. ' +
      'Alpha whale = single 3× emissive mesh (bioluminescent underbelly). ' +
      '3 instanced draw calls total. Tail-slap shadow = projected DecalGeometry on terrain below. ' +
      'Boost rings spawn in creature wakes; coins scatter along their backs.',
  },

  // ---- Biome 16 (new world) ----
  {
    id: 16,
    name: 'Coral Cathedral — The Drowned City',
    order: 16,
    skyColor: '#003344',
    fogColor: '#004455',
    groundColor: '#00554466',
    waterColor: '#00bbdd',
    sunElevation: 0.35,
    terrain: { amplitude: 20, roughness: 0.3, basin: 0.4 },
    landmark: {
      id: 'cathedral-rose-window',
      label: 'Cathedral Rose Window',
      coinReward: 150,
      bonus: 'Fly the 12 m rose window: 150 coins; dome air-pocket = instant full fuel',
    },
    hazard: {
      id: 'eel-lunge',
      label: 'Eel Lunge (from windows)',
      effect: '−1 shield on hit',
      telegraphSeconds: 1.0,
    },
    pickupBias: 'shields',
    softWall: 'none',
    dynamicElement: 'Tidal surge every 40 s raises surface 12 m, submerging landmarks and opening new corridors.',
    hasNightVariant: false,
    buildNotes:
      'Reuse THREE.Water at Y=0; below-Y=0 = 3× drag + caustic overlay ShaderPass + teal FogExp2. ' +
      'Eel = repurposed geyser extrude mesh. Gothic arch street grid = InstancedMesh. ' +
      'Rose window = disc with stained-glass emissive texture atlas. ' +
      'Tidal surge = Y-animate water plane + re-trigger landmark spawners. ' +
      'Opt-in risk/reward zone: above-water is safe, below-water is high-risk/high-reward. ' +
      'Canonical home biome for the Sub-Wing plane (P4 unlock).',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Look up a biome by its canonical id (1–16). Returns undefined if not found. */
export function getBiomeById(id: number): Biome | undefined {
  return BIOMES.find((b) => b.id === id);
}

/** The 12 base biomes (GDD §4). */
export const BASE_BIOMES: Biome[] = BIOMES.filter((b) => b.id <= 12);

/** The 4 new worlds added in the Design Bible. */
export const NEW_WORLD_BIOMES: Biome[] = BIOMES.filter((b) => b.id >= 13);
