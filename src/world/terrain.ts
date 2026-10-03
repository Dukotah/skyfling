/**
 * Skyfling world — rolling terrain + biome bands.
 *
 * This is the layer that turns the `biomes.ts` *data* into an actual
 * rendered world. It owns:
 *   - a deterministic world height function (`heightAt`) with a central
 *     flyable corridor and rising side ridges, shaped per biome,
 *   - the distance→biome banding (`bandAt`) shared by every world module so
 *     terrain, scenery, atmosphere and collectibles always agree on "which
 *     zone are we in",
 *   - a recentering terrain patch mesh that follows the plane and resamples
 *     height + vertex colour, giving effectively-infinite rolling ground for
 *     the price of a fixed vertex count.
 *
 * No DOM. Depends only on three.js, the biome data and the pure math helpers.
 */

import * as THREE from 'three'
import { BIOMES, getBiomeById, type Biome } from '../data/biomes'
import { WATER_Y } from '../sim/flight'
import { clamp, lerp } from '../util/math'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Mean ground level at the launch pad (matches the old flat plane). */
export const GROUND_BASE = -22

/** Half-width of the flat-ish flight lane carved down the middle, metres. */
const LANE = 34

/**
 * The biome running order for the demo world. These are ids into BIOMES
 * (see data/biomes.ts). The sequence loops, so the world is endless and every
 * ~800 m you cross into a visibly different, cohesive zone.
 */
const BAND_IDS = [1, 3, 2, 5, 4, 8] as const // Meadow→Coast→Canyon→Alpine→Dunes→Neon
/** Length of each biome band along the flight axis, metres. */
const BAND_LEN = 800
/** Cross-fade length at the end of each band, metres. */
const XFADE = 200

// ---------------------------------------------------------------------------
// Biome banding — pure, shared by every world module
// ---------------------------------------------------------------------------

export interface BandInfo {
  /** The biome you are currently in. */
  cur: Biome
  /** The next biome in the sequence (what you are fading toward). */
  next: Biome
  /** 0 = fully `cur`, 1 = fully `next`. Non-zero only inside the cross-fade. */
  blend: number
  /** Index of the current band (monotonic with distance). */
  index: number
}

const BAND_BIOMES: Biome[] = BAND_IDS.map((id) => getBiomeById(id) ?? BIOMES[0])

/**
 * Which biome(s) are active at distance `d` (metres), and the fade between
 * them. Pure and cheap — call it per-vertex, per-prop, per-frame freely.
 */
export function bandAt(d: number): BandInfo {
  const t = Math.max(0, d) / BAND_LEN
  const index = Math.floor(t)
  const frac = t - index
  const cur = BAND_BIOMES[index % BAND_BIOMES.length]
  const next = BAND_BIOMES[(index + 1) % BAND_BIOMES.length]
  const fadeStart = 1 - XFADE / BAND_LEN
  const blend = frac <= fadeStart ? 0 : (frac - fadeStart) / (XFADE / BAND_LEN)
  return { cur, next, blend, index }
}

/** Linearly blend a biome scalar field across the current band fade. */
function blendTerrain(info: BandInfo): { amplitude: number; roughness: number; basin: number } {
  const a = info.cur.terrain
  const b = info.next.terrain
  const t = info.blend
  return {
    amplitude: lerp(a.amplitude, b.amplitude, t),
    roughness: lerp(a.roughness, b.roughness, t),
    basin: lerp(a.basin, b.basin, t),
  }
}

// ---------------------------------------------------------------------------
// Deterministic value noise (no Math.random → stable world + ghost-safe)
// ---------------------------------------------------------------------------

function hash2(ix: number, iz: number): number {
  const h = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453
  return h - Math.floor(h)
}

function smoother(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function valueNoise(x: number, z: number): number {
  const ix = Math.floor(x)
  const iz = Math.floor(z)
  const fx = x - ix
  const fz = z - iz
  const a = hash2(ix, iz)
  const b = hash2(ix + 1, iz)
  const c = hash2(ix, iz + 1)
  const d = hash2(ix + 1, iz + 1)
  const ux = smoother(fx)
  const uz = smoother(fz)
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uz)
}

/** 3-octave fractal noise in roughly 0..1. */
function fbm(x: number, z: number, roughness: number): number {
  let f = 0
  let amp = 0.5
  let freq = 1
  let norm = 0
  const octaves = 2 + Math.round(roughness * 2) // rougher biomes get finer detail
  for (let o = 0; o < octaves; o++) {
    f += amp * valueNoise(x * freq, z * freq)
    norm += amp
    freq *= 2.03
    amp *= 0.5
  }
  return f / norm
}

/** Smoothstep ramp, 0 below `a`, 1 above `b`. */
function ramp(a: number, b: number, x: number): number {
  return smoother(clamp((x - a) / (b - a), 0, 1))
}

// ---------------------------------------------------------------------------
// World height field
// ---------------------------------------------------------------------------

/**
 * Ground height (world Y) at world (x, z). Deterministic and pure so terrain,
 * scenery, collectibles and the ground check all agree.
 *
 * Shape: a flat launch apron, then rolling hills whose amplitude/roughness come
 * from the active biome, with a carved central lane you can fly down and taller
 * ridges to the sides so each zone feels enclosed and "designed" rather than an
 * open prairie. Coastal/oasis biomes let the far sides dip below the water line.
 */
export function heightAt(x: number, z: number): number {
  const d = Math.max(0, -z)
  const info = bandAt(d)
  const { amplitude, roughness, basin } = blendTerrain(info)

  // Hills fade in past the launch apron so the slingshot drop stays clean.
  const hillRamp = ramp(45, 190, d)

  // Base rolling field, centred on zero.
  const n = fbm(x * 0.0115 + 1000, z * 0.0115 + 1000, roughness) - 0.5
  let h = GROUND_BASE + n * amplitude * hillRamp

  // Central flight lane: pull the middle down toward a flat channel (basin),
  // and push the sides up into ridges for enclosure.
  const lane = Math.exp(-(x * x) / (2 * LANE * LANE)) // 1 at centre → 0 at sides
  h -= basin * lane * amplitude * 0.45 * hillRamp
  h += (1 - lane) * amplitude * 0.22 * hillRamp

  // Keep the lane itself safely above the water so you don't splash constantly.
  const laneGuard = ramp(0.35, 0.85, lane)
  h = lerp(h, Math.max(h, WATER_Y + 3), laneGuard)

  // Coastal / oasis biomes: let the outer flanks drop into the sea.
  const waterPull = (info.cur.waterColor ? 1 - info.blend : 0) + (info.next.waterColor ? info.blend : 0)
  if (waterPull > 0) {
    const flank = ramp(70, 150, Math.abs(x))
    h -= flank * waterPull * (amplitude + 18) * hillRamp
  }

  return h
}

/** Local forward slope (radians) at (x, z), for crash/landing resolution. */
export function slopeAt(x: number, z: number): number {
  const dz = 4
  const h0 = heightAt(x, z + dz)
  const h1 = heightAt(x, z - dz)
  return Math.atan2(h1 - h0, dz * 2)
}

/** True if the surface under (x, z) is water (below the water line). */
export function isWaterAt(x: number, z: number): boolean {
  return heightAt(x, z) < WATER_Y
}

// ---------------------------------------------------------------------------
// Recentering terrain patch
// ---------------------------------------------------------------------------

const PATCH_HALF_X = 230 // metres to each side
const PATCH_AHEAD = 1040 // metres in front of the plane (−z)
const PATCH_BEHIND = 210 // metres behind
const CELL = 11 // grid spacing, metres

/**
 * A fixed-resolution ground mesh that follows the plane. Each resample moves
 * the whole grid to the player's snapped position and recomputes height +
 * vertex colour from the world field, so the ground looks infinite while the
 * GPU only ever sees a few thousand vertices.
 */
export class Terrain {
  readonly mesh: THREE.Mesh
  private geo: THREE.BufferGeometry
  private nx: number
  private nz: number
  private gx: Float32Array // local X offset per column
  private gz: Float32Array // local Z offset per row
  private pos: Float32Array
  private col: Float32Array
  private lastCx = Number.NaN
  private lastCz = Number.NaN
  private cBase = new THREE.Color()
  private cTmp = new THREE.Color()

  constructor() {
    this.nx = Math.round((PATCH_HALF_X * 2) / CELL) + 1
    this.nz = Math.round((PATCH_AHEAD + PATCH_BEHIND) / CELL) + 1
    const n = this.nx * this.nz

    this.gx = new Float32Array(this.nx)
    for (let i = 0; i < this.nx; i++) this.gx[i] = -PATCH_HALF_X + i * CELL
    this.gz = new Float32Array(this.nz)
    for (let j = 0; j < this.nz; j++) this.gz[j] = PATCH_BEHIND - j * CELL // +z (behind) → −z (ahead)

    this.pos = new Float32Array(n * 3)
    this.col = new Float32Array(n * 3)

    // Index buffer (two triangles per cell).
    const idx: number[] = []
    for (let j = 0; j < this.nz - 1; j++) {
      for (let i = 0; i < this.nx - 1; i++) {
        const a = j * this.nx + i
        const b = a + 1
        const c = a + this.nx
        const d = c + 1
        idx.push(a, c, b, b, c, d)
      }
    }

    this.geo = new THREE.BufferGeometry()
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3))
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3))
    this.geo.setIndex(idx)

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      metalness: 0,
      flatShading: true, // faceted, low-poly look like the reference
    })
    this.mesh = new THREE.Mesh(this.geo, mat)
    this.mesh.receiveShadow = true
    this.mesh.castShadow = false
    this.mesh.frustumCulled = false
  }

  /** Recenter + resample if the plane moved to a new cell. */
  update(px: number, pz: number): void {
    const cx = Math.round(px / CELL) * CELL
    const cz = Math.round(pz / CELL) * CELL
    if (cx === this.lastCx && cz === this.lastCz) return
    this.lastCx = cx
    this.lastCz = cz
    this.resample(cx, cz)
  }

  private resample(cx: number, cz: number): void {
    const { pos, gx, gz, nx, nz } = this
    let p = 0
    for (let j = 0; j < nz; j++) {
      const wz = cz + gz[j]
      for (let i = 0; i < nx; i++) {
        const wx = cx + gx[i]
        const y = heightAt(wx, wz)
        pos[p] = gx[i]
        pos[p + 1] = y
        pos[p + 2] = gz[j]
        this.colorAt(wx, wz, y, p)
        p += 3
      }
    }
    this.geo.attributes.position.needsUpdate = true
    this.geo.attributes.color.needsUpdate = true
    // Material is flat-shaded (normals derived in-shader from position
    // derivatives), so we skip the costly per-resample normal/bounds recompute.
    this.mesh.position.set(cx, 0, cz)
  }

  /** Vertex colour: biome ground tint, lifted on peaks, darkened in hollows. */
  private colorAt(wx: number, wz: number, y: number, offset: number): void {
    const d = Math.max(0, -wz)
    const info = bandAt(d)
    this.cBase.set(info.cur.groundColor)
    if (info.blend > 0) {
      this.cTmp.set(info.next.groundColor)
      this.cBase.lerp(this.cTmp, info.blend)
    }
    // Height shade: slightly brighter up high, darker down in the valleys.
    const hNorm = clamp((y - GROUND_BASE + 14) / 60, 0, 1)
    const shade = 0.78 + hNorm * 0.34
    // A touch of per-vertex grain so large faces aren't dead flat.
    const grain = 0.94 + hash2(Math.round(wx * 0.4), Math.round(wz * 0.4)) * 0.12
    const k = shade * grain
    this.col[offset] = this.cBase.r * k
    this.col[offset + 1] = this.cBase.g * k
    this.col[offset + 2] = this.cBase.b * k
  }

  dispose(): void {
    this.geo.dispose()
    ;(this.mesh.material as THREE.Material).dispose()
  }
}
