/**
 * Content definition helpers + types (ARCHITECTURE §2). Item files import
 * define* from here; the collections live in registry.ts (kept separate so the
 * eager glob import does not form a cycle with the item files).
 *
 * Pure data: no three.js, no DOM. Mesh ids reference the asset manifest; the
 * render layer maps them to GLBs or procedural builders.
 */

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export type Scope = 'v1' | 'v2'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`[registry] ${msg}`)
}

function finite(n: unknown, name: string): void {
  assert(typeof n === 'number' && Number.isFinite(n), `${name} must be a finite number, got ${String(n)}`)
}

function idOk(id: unknown, what: string): asserts id is string {
  assert(typeof id === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(id), `${what} id must be kebab-case, got ${String(id)}`)
}

// ---------------------------------------------------------------------------
// Props (scenery meshes placed by biomes)
// ---------------------------------------------------------------------------

export type Placement = 'ground' | 'water' | 'shore' | 'ridge' | 'air' | 'flat'

export interface PropDef {
  id: string
  /** Asset manifest model id, or `proc:<builder>` for a procedural builder. */
  model: string
  /** Target height in metres after scaling (models are normalised by their bounding box). */
  height: number
  /** Random scale jitter ±fraction. */
  jitter?: number
  /** Which spots are valid. */
  placement: Placement
  /** Random yaw? (false for things with a front, like houses facing the corridor). */
  randomYaw?: boolean
  /** Casts a shadow near the camera. */
  shadow?: boolean
  /** Draw distance in metres (small props drop out sooner). */
  lod: number
  /** Optional spinning node (windmill fan, turbine blades) with speed in rad/s. */
  spin?: { node: string; axis: 'x' | 'y' | 'z'; speed: number }
  /** Emissive tint for night variants (windows, lamps). */
  emissiveAtNight?: string
  /** Collision: hitting it ends the run (towers) or is ignored (trees). */
  solid?: boolean
  /** Sink into terrain by this fraction of height (hides floating bases on slopes). */
  sink?: number
}

export function defineProp(def: PropDef): Readonly<PropDef> {
  idOk(def.id, 'prop')
  assert(typeof def.model === 'string' && def.model.length > 0, `prop ${def.id} needs a model`)
  finite(def.height, `prop ${def.id}.height`)
  finite(def.lod, `prop ${def.id}.lod`)
  return Object.freeze({ randomYaw: true, shadow: true, jitter: 0.15, sink: 0.04, ...def })
}

// ---------------------------------------------------------------------------
// Biomes
// ---------------------------------------------------------------------------

export interface TerrainParams {
  /** Hill amplitude, metres. */
  amplitude: number
  /** 0 smooth … 1 jagged (adds ridged noise). */
  roughness: number
  /** 0 none … 1 strong flat valley carved along the corridor. */
  basin: number
  /** Water plane present. */
  water?: boolean
  /** Water surface Y (default −26). */
  waterLevel?: number
  /** Surface type of the water body. */
  waterKind?: 'water' | 'lava' | 'ice'
  /** Snow above this height (metres above local mean). */
  snowLine?: number
  /** Mesas: flat-topped plateaus (0..1 strength). */
  mesa?: number
  /** Floating islands band (Sky Isles). */
  isles?: boolean
  /** Floor offset: whole biome lower/higher. */
  floor?: number
}

export interface Atmosphere {
  /** Sun elevation in degrees above the horizon (negative = night). */
  sunElevation: number
  /** Sun azimuth in degrees. */
  sunAzimuth: number
  /** Preetham turbidity (2 clear … 10 hazy). */
  turbidity: number
  /** Preetham rayleigh (1 … 4). */
  rayleigh: number
  /** Mie coefficient and directional g. */
  mie: number
  mieG: number
  /** Fog colour hex and FogExp2 density. */
  fog: string
  fogDensity: number
  /** Sun light colour and intensity. */
  sunColor: string
  sunIntensity: number
  /** Hemisphere sky/ground colours and intensity. */
  hemiSky: string
  hemiGround: string
  hemiIntensity: number
  /** Cloud cover 0..1 and cloud tint. */
  cloudCover: number
  cloudTint: string
  /** Tone-mapping exposure for this biome. */
  exposure: number
  /** Night: stars + moon. */
  night?: boolean
  /** Aurora curtains (Tundra/Stratosphere nights). */
  aurora?: boolean
  /** Precipitation. */
  precipitation?: 'none' | 'rain' | 'snow' | 'ash' | 'sand'
  /** Post LUT tint (subtle grade): shadows / highlights hex. */
  gradeShadow?: string
  gradeHighlight?: string
}

export interface TerrainPalette {
  /** Low grass/ground, high grass/ground. */
  groundLow: string
  groundHigh: string
  rock: string
  shore: string
  snow?: string
  /** Detail texture set ids from the asset manifest. */
  detail: { ground: 'grass' | 'rock' | 'sand' | 'snow' | 'ash'; rock: 'rock' }
}

export interface PropSpawn {
  prop: string
  /** Instances per 100 m of corridor (before chunk jitter). */
  density: number
  /** Lateral band from the corridor centre, metres [min,max]. */
  band?: [number, number]
  /** Cluster size [min,max] (for forests). */
  cluster?: [number, number]
}

export interface HazardSpawn {
  hazard: string
  /** Spawns per 100 m. */
  rate: number
}

export interface PickupBias {
  [pickupId: string]: number
}

export interface BiomeDef {
  id: string
  name: string
  /** Order in the run (1-based). */
  order: number
  scope?: Scope
  terrain: TerrainParams
  atmosphere: Atmosphere
  /** Night variant; if present the weekly challenge can pick it. */
  night?: Partial<Atmosphere>
  palette: TerrainPalette
  props: PropSpawn[]
  /** Landmark props spawn once per segment at a fixed distance fraction. */
  landmarks: Array<{ prop: string; at: number; x?: number; scale?: number }>
  hazards: HazardSpawn[]
  pickupBias: PickupBias
  softWalls: string[]
  /** Music mood id. */
  music: string
  /** Short tagline shown on biome enter. */
  tagline: string
}

export function defineBiome(def: BiomeDef): Readonly<BiomeDef> {
  idOk(def.id, 'biome')
  finite(def.order, `biome ${def.id}.order`)
  finite(def.terrain.amplitude, `biome ${def.id}.terrain.amplitude`)
  finite(def.atmosphere.sunElevation, `biome ${def.id}.atmosphere.sunElevation`)
  finite(def.atmosphere.fogDensity, `biome ${def.id}.atmosphere.fogDensity`)
  assert(Array.isArray(def.props), `biome ${def.id}.props must be an array`)
  return Object.freeze({ scope: 'v1', ...def })
}

// ---------------------------------------------------------------------------
// Planes
// ---------------------------------------------------------------------------

export interface PlaneFx {
  prop?: { node?: string; radius: number; at: [number, number, number] }
  afterburner?: { at: Array<[number, number, number]>; radius: number }
  contrails: Array<[number, number, number]>
  canopy?: string
}

export interface PlaneDef {
  id: string
  tier: number
  name: string
  /** Total upgrade level required. */
  unlockAt: number
  /** Manifest model id or `proc:<builder>`. */
  model: string
  /** Length in metres after scaling. */
  length: number
  /** Nose direction in the source model: which local axis points forward, and whether to flip. */
  forward: '+x' | '-x' | '+z' | '-z'
  /** Material-name → paint slot mapping for GLBs; procedural builders use slots directly. */
  paintSlots?: Record<string, 'primary' | 'secondary' | 'accent' | 'canopy'>
  /** Whether the model's own textures should be tinted by the primary paint (textured models). */
  tintTextured?: boolean
  fx: PlaneFx
  trait: { id: string; blurb: string; stat?: Partial<Record<'fuel' | 'turn' | 'boost' | 'glide' | 'launch' | 'speed', number>> }
  blurb: string
  scope?: Scope
  /** Engine sound profile. */
  engine: 'paper' | 'prop' | 'radial' | 'jet' | 'rocket' | 'glider' | 'ion'
}

export function definePlane(def: PlaneDef): Readonly<PlaneDef> {
  idOk(def.id, 'plane')
  finite(def.tier, `plane ${def.id}.tier`)
  finite(def.unlockAt, `plane ${def.id}.unlockAt`)
  finite(def.length, `plane ${def.id}.length`)
  return Object.freeze({ scope: 'v1', ...def })
}

// ---------------------------------------------------------------------------
// Upgrades
// ---------------------------------------------------------------------------

export type UpgradeId =
  | 'launcher'
  | 'wings'
  | 'engine'
  | 'fuel'
  | 'airframe'
  | 'nitro'
  | 'armor'
  | 'magnet'
  | 'luck'
  | 'thermal'
  | 'plating'
  | 'trick'
  | 'radar'

export interface UpgradeDef {
  id: UpgradeId
  name: string
  icon: string
  blurb: string
  /** Formula text for the hangar tooltip. */
  formula: string
  maxLevel: number
}

export function defineUpgrade(def: UpgradeDef): Readonly<UpgradeDef> {
  idOk(def.id, 'upgrade')
  finite(def.maxLevel, `upgrade ${def.id}.maxLevel`)
  return Object.freeze(def)
}

/** Cost to buy level L (1-indexed): 30·1.62^L (GDD §7). */
export function upgradeCost(level: number): number {
  return Math.round(30 * Math.pow(1.62, level))
}

// ---------------------------------------------------------------------------
// Pickups & hazards
// ---------------------------------------------------------------------------

export type PickupEffect =
  | { type: 'coins'; amount: number }
  | { type: 'speed'; amount: number; nitro?: number }
  | { type: 'fuel'; seconds: number }
  | { type: 'nitro'; amount: number }
  | { type: 'shield'; amount: number }
  | { type: 'multiplier'; factor: number; seconds: number }
  | { type: 'bounce'; speed: number; pitch: number }
  | { type: 'fountain'; coins: number }
  | { type: 'thermal'; lift: number; radius: number; height: number }

export interface PickupDef {
  id: string
  name: string
  /** Manifest model id or `proc:<builder>`. */
  model: string
  /** Collision radius, metres. */
  radius: number
  /** Visual size (metres, longest axis). */
  size: number
  effect: PickupEffect
  /** Base spawn weight (biome bias multiplies). */
  weight: number
  /** Pattern options for spawning groups. */
  pattern?: 'single' | 'line' | 'arc' | 'sine' | 'grid' | 'chain'
  /** Pulled by the magnet. */
  magnetic?: boolean
  /** Emissive colour hex for glow/bloom. */
  glow: string
  /** Rarity multiplier from the luck stat applies. */
  rare?: boolean
  /** Float bob amplitude. */
  bob?: number
  /** Spin speed rad/s. */
  spin?: number
  sfx: string
  /** Altitude band above local ground [min,max]. */
  altitude: [number, number]
}

export function definePickup(def: PickupDef): Readonly<PickupDef> {
  idOk(def.id, 'pickup')
  finite(def.radius, `pickup ${def.id}.radius`)
  finite(def.weight, `pickup ${def.id}.weight`)
  return Object.freeze({ pattern: 'single', magnetic: false, bob: 0, spin: 0, ...def })
}

export type HazardEffect =
  | { type: 'slow'; factor: number }
  | { type: 'crash' }
  | { type: 'push'; x: number; y: number }
  | { type: 'burn'; fuel: number; slow: number }

export interface HazardDef {
  id: string
  name: string
  model: string
  radius: number
  size: number
  effect: HazardEffect
  /** Moves across the corridor (birds) at this speed, else static. */
  moveSpeed?: number
  /** Animated GLB clip name to play. */
  clip?: string
  /** Telegraph seconds before it becomes dangerous (lightning). */
  telegraph?: number
  /** Near-miss radius for combo (greater than radius). */
  nearMiss: number
  altitude: [number, number]
  sfx: string
}

export function defineHazard(def: HazardDef): Readonly<HazardDef> {
  idOk(def.id, 'hazard')
  finite(def.radius, `hazard ${def.id}.radius`)
  return Object.freeze(def)
}

// ---------------------------------------------------------------------------
// Soft walls
// ---------------------------------------------------------------------------

export interface SoftWallDef {
  id: string
  name: string
  /** Where fronts of this kind appear: fixed distances or per-biome. */
  placement: { kind: 'fixed'; distances: number[] } | { kind: 'biome'; every: number; offset: number }
  /** Thickness along the corridor, metres. */
  depth: number
  /** Base drag added at index 0 and per-index growth. */
  drag: { base: number; perIndex: number }
  downforce: number
  sidePush: number
  yawPush: number
  liftScale: number
  fuelBurn: number
  /** Visual id for the renderer. */
  visual: 'storm' | 'sandstorm' | 'ash' | 'crosswind' | 'thinair' | 'gate'
  /** Bonus coins for the first break (index-scaled). */
  breakBonus: { base: number; perIndex: number }
  /** HUD warning text. */
  warning: string
  banner: string
}

export function defineSoftWall(def: SoftWallDef): Readonly<SoftWallDef> {
  idOk(def.id, 'softwall')
  finite(def.depth, `softwall ${def.id}.depth`)
  return Object.freeze(def)
}

// ---------------------------------------------------------------------------
// Missions & achievements
// ---------------------------------------------------------------------------

export interface MissionContext {
  /** Difficulty tier from floor(completed/3). */
  tier: number
  /** Player's best distance so far. */
  best: number
}

export interface MissionDef {
  id: string
  /** Build a target for the given context. */
  target(ctx: MissionContext): number
  /** Text with the target filled in. */
  describe(target: number): string
  /** Which run stat field this tracks (RunStats key). */
  stat: string
  /** Lifetime (accumulates across runs) or per-run (reset each flight). */
  mode: 'run' | 'lifetime'
  /** Reward multiplier k. */
  k: number
  icon: string
}

export function defineMission(def: MissionDef): Readonly<MissionDef> {
  idOk(def.id, 'mission')
  assert(typeof def.target === 'function', `mission ${def.id} needs target()`)
  return Object.freeze(def)
}

export interface AchievementDef {
  id: string
  title: string
  blurb: string
  /** Lifetime stat key and threshold. */
  stat: string
  threshold: number
  reward: number
  /** Title unlocked for the hangar nameplate. */
  grantsTitle?: string
  icon: string
}

export function defineAchievement(def: AchievementDef): Readonly<AchievementDef> {
  idOk(def.id, 'achievement')
  finite(def.threshold, `achievement ${def.id}.threshold`)
  return Object.freeze(def)
}

// ---------------------------------------------------------------------------
// Paints
// ---------------------------------------------------------------------------

export interface PaintDef {
  id: string
  name: string
  primary: string
  secondary: string
  accent: string
  canopy: string
  /** Metalness/roughness overrides for special finishes. */
  finish?: 'gloss' | 'matte' | 'metal' | 'pearl'
  /** Unlock: coins or achievement id or prestige level. */
  unlock: { kind: 'free' } | { kind: 'coins'; cost: number } | { kind: 'achievement'; id: string } | { kind: 'prestige'; level: number }
}

export function definePaint(def: PaintDef): Readonly<PaintDef> {
  idOk(def.id, 'paint')
  return Object.freeze({ finish: 'gloss', ...def })
}

