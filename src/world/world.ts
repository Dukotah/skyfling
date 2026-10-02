/**
 * World (ARCHITECTURE §3/§6): implements WorldQuery over the terrain sampler,
 * owns the soft-wall instances for a run, thermals, and wind. Pure data; the
 * render layer reads chunk content through `chunk(index)`.
 */

import type { WorldQuery, BiomeSample, SurfaceKind, SoftWallContribution } from './query'
import { createTerrain, type TerrainSampler, SEGMENT, WATER_Y } from './terrain'
import { generateChunk, CHUNK_LENGTH, type ChunkContent, type Registries } from './placement'
import { applyWall, type WallInstance, type SoftWallKind, STORM_DISTANCES } from '../sim/softwalls'
import type { FlightEnv } from '../sim/flight'
import { resetEnv } from '../sim/flight'
import { Rng, hash2, valueNoise } from './rng'
import type { BiomeDef, SoftWallDef } from '../data/define'

export interface ThermalColumn {
  x: number
  z: number
  /** Base Y and top Y. */
  y0: number
  y1: number
  radius: number
  lift: number
  id: number
}

export class World implements WorldQuery {
  terrain: TerrainSampler
  walls: WallInstance[] = []
  thermals: ThermalColumn[] = []
  private chunks = new Map<number, ChunkContent>()
  private rng: Rng
  /** Storm plating level (0–10) from the save; lowers wall drag. */
  plating = 0
  /** Thermal lift multiplier from Thermal Wings. */
  thermalMult = 1

  constructor(public seed: number, public biomes: ReadonlyArray<Readonly<BiomeDef>>, public softWalls: Map<string, Readonly<SoftWallDef>>, private reg: Registries, public luckF = 1) {
    this.terrain = createTerrain(biomes, seed)
    this.rng = new Rng(hash2(seed, 0x5a11))
    this.buildWalls()
  }

  // --- WorldQuery -----------------------------------------------------------
  heightAt(x: number, z: number): number {
    return this.terrain.heightAt(x, z)
  }
  surfaceAt(x: number, z: number): SurfaceKind {
    return this.terrain.surfaceAt(x, z)
  }
  slopeAt(x: number, z: number): number {
    return this.terrain.slopeAt(x, z)
  }
  biomeAt(distance: number): BiomeSample {
    return this.terrain.biomeAt(distance)
  }
  windAt(x: number, _y: number, z: number, t: number, out: { x: number; y: number; z: number }): void {
    // Gentle ambient gusts; crosswind corridors add through soft walls.
    const g = valueNoise(x * 0.01 + t * 0.15, z * 0.01, 5) * 2 - 1
    out.x = g * 1.5
    out.y = 0
    out.z = 0
  }
  softWallsAt(x: number, y: number, z: number): SoftWallContribution[] {
    const res: SoftWallContribution[] = []
    const env = resetEnv({} as FlightEnv)
    for (const w of this.walls) {
      if (Math.abs(-z - w.at) > w.depth) continue
      resetEnv(env)
      const depth = applyWall(x, y, z, w, env, this.plating)
      if (depth > 0) res.push({ kind: w.kind, index: w.index, depth, dragAdd: env.dragAdd, downforce: env.downforce, sidePush: env.sidePush, yawPush: env.yawPush, liftScale: env.liftScale, fuelBurn: env.fuelBurn })
    }
    return res
  }
  thermalAt(x: number, y: number, z: number): number {
    let lift = 0
    for (const t of this.thermals) {
      if (Math.abs(t.z - z) > t.radius * 1.2) continue
      const d = Math.hypot(t.x - x, t.z - z)
      if (d > t.radius || y < t.y0 || y > t.y1) continue
      const core = 1 - d / t.radius
      const fade = 1 - Math.max(0, (y - t.y0) / (t.y1 - t.y0) - 0.7) / 0.3
      lift = Math.max(lift, t.lift * core * Math.max(0, fade) * this.thermalMult)
    }
    return lift
  }

  /** Fill a FlightEnv for a point (the game calls this once per sim step). Returns the walls currently entered. */
  envAt(x: number, y: number, z: number, env: FlightEnv, groundEffect: boolean): WallInstance[] {
    resetEnv(env)
    const inside: WallInstance[] = []
    for (const w of this.walls) {
      if (Math.abs(-z - w.at) > w.depth) continue
      if (applyWall(x, y, z, w, env, this.plating) > 0) inside.push(w)
    }
    env.thermalLift = this.thermalAt(x, y, z)
    if (groundEffect) {
      const clearance = y - this.heightAt(x, z)
      if (clearance < 15 && clearance > 0) env.liftScale *= 1 + 0.12 * (1 - clearance / 15)
    }
    return inside
  }

  // --- chunks --------------------------------------------------------------
  chunk(index: number): ChunkContent {
    let c = this.chunks.get(index)
    if (!c) {
      c = generateChunk(index, this.seed, this.terrain, this.reg, this.luckF)
      this.chunks.set(index, c)
      // Thermals are pickups of kind 'thermal' → register columns for the sim.
      for (const p of c.pickups) {
        if (p.pickup === 'thermal') this.thermals.push({ x: p.x, z: p.z, y0: p.y - 2, y1: p.y + 90, radius: 9, lift: 11, id: p.group })
      }
    }
    return c
  }

  chunkIndexAt(z: number): number {
    return Math.max(0, Math.floor(-z / CHUNK_LENGTH))
  }

  /** Forget chunks far behind (and their thermals). */
  prune(behindIndex: number): void {
    for (const k of [...this.chunks.keys()]) if (k < behindIndex - 1) this.chunks.delete(k)
    const minZ = -behindIndex * CHUNK_LENGTH
    this.thermals = this.thermals.filter((t) => t.z < minZ)
  }

  // --- walls ---------------------------------------------------------------
  private buildWalls(): void {
    const seg = SEGMENT
    // Fixed storm fronts.
    STORM_DISTANCES.forEach((d, i) => {
      const y = this.terrain.heightAt(0, -d)
      this.walls.push({ kind: 'storm-front', index: i, at: d, depth: 60, x: 0, halfWidth: 480, yMin: y - 40, yMax: y + 400 })
    })
    // Per-biome walls.
    const counters = new Map<string, number>()
    for (let s = 0; s < 24; s++) {
      const biome = this.biomes[s % this.biomes.length]
      for (const id of biome.softWalls) {
        const def = this.softWalls.get(id)
        if (!def || def.placement.kind !== 'biome') continue
        const kind = id as SoftWallKind
        const n = counters.get(id) ?? 0
        counters.set(id, n + 1)
        const at = s * seg + def.placement.offset
        if (at < 150) continue
        const y = this.terrain.heightAt(0, -at)
        if (kind === 'headwind-gate') {
          const gx = this.rng.range(-25, 25)
          const gy = Math.max(y, biome.terrain.water ? (biome.terrain.waterLevel ?? WATER_Y) : y) + this.rng.range(28, 55)
          this.walls.push({ kind, index: n, at, depth: def.depth, x: gx, halfWidth: 60, yMin: gy - 60, yMax: gy + 60, gateRadii: [3.2, 6.4, 9.6], gateY: gy })
        } else if (kind === 'thin-air') {
          this.walls.push({ kind, index: n, at: at + seg / 2, depth: seg, x: 0, halfWidth: 480, yMin: 400, yMax: 5000 })
        } else if (kind === 'crosswind') {
          this.walls.push({ kind, index: n, at, depth: def.depth, x: 0, halfWidth: 480, yMin: y - 40, yMax: y + 300 })
        } else {
          this.walls.push({ kind, index: n, at, depth: def.depth, x: 0, halfWidth: 480, yMin: y - 40, yMax: y + 400 })
        }
      }
    }
    this.walls.sort((a, b) => a.at - b.at)
  }
}
