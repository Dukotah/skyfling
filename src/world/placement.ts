/**
 * Prop and pickup placement per chunk (ARCHITECTURE §6). Pure: given a chunk
 * span and a terrain sampler, produce deterministic placements from the run's
 * seeded PRNG. The render layer instantiates them.
 */

import { Rng, hash2 } from './rng'
import type { TerrainSampler } from './terrain'
import { SEGMENT, HALF_WIDTH, WATER_Y } from './terrain'
import type { BiomeDef, PropDef, PickupDef, HazardDef } from '../data/define'

export const CHUNK_LENGTH = 250

export interface PropPlacement {
  prop: string
  x: number
  y: number
  z: number
  yaw: number
  scale: number
  /** Forced landmark (bypasses placement rules). */
  landmark?: boolean
}

export interface PickupPlacement {
  pickup: string
  x: number
  y: number
  z: number
  /** Group id (pattern chains share one). */
  group: number
}

export interface HazardPlacement {
  hazard: string
  x: number
  y: number
  z: number
  /** Lateral travel direction for moving hazards. */
  dir: number
}

export interface ChunkContent {
  index: number
  z0: number
  z1: number
  props: PropPlacement[]
  pickups: PickupPlacement[]
  hazards: HazardPlacement[]
  /** Biome id dominating this chunk (for materials/atmosphere hints). */
  biome: string
}

export interface Registries {
  props: Map<string, Readonly<PropDef>>
  pickups: Map<string, Readonly<PickupDef>>
  hazards: Map<string, Readonly<HazardDef>>
}

/** Does the placement rule accept this spot? */
function spotOk(def: Readonly<PropDef>, terrain: TerrainSampler, biome: Readonly<BiomeDef>, x: number, z: number, y: number): boolean {
  const level = biome.terrain.waterLevel ?? WATER_Y
  const wet = biome.terrain.water && y < level
  switch (def.placement) {
    case 'water':
      return !!wet && y < level - 1.5
    case 'shore':
      return !!biome.terrain.water && !wet && y < level + 6
    case 'ground':
      return !wet
    case 'flat': {
      if (wet) return false
      const s = Math.abs(terrain.heightAt(x + 6, z) - terrain.heightAt(x - 6, z)) + Math.abs(terrain.heightAt(x, z + 6) - terrain.heightAt(x, z - 6))
      return s < 4
    }
    case 'ridge': {
      if (wet) return false
      const around = (terrain.heightAt(x + 25, z) + terrain.heightAt(x - 25, z) + terrain.heightAt(x, z + 25) + terrain.heightAt(x, z - 25)) / 4
      return y >= around - 1
    }
    case 'air':
      return true
  }
}

export function generateChunk(index: number, seed: number, terrain: TerrainSampler, reg: Registries, luckF = 1): ChunkContent {
  const z0 = -index * CHUNK_LENGTH
  const z1 = z0 - CHUNK_LENGTH
  const dMid = -(z0 + z1) / 2
  const { a, b, t } = terrain.blendAt(dMid)
  const biome = t < 0.5 ? a : b
  const rng = new Rng(hash2(seed, index))
  const out: ChunkContent = { index, z0, z1, props: [], pickups: [], hazards: [], biome: biome.id }

  // --- Props ---------------------------------------------------------------
  const occupied: Array<[number, number, number]> = [] // x, z, radius
  const tryPlace = (def: Readonly<PropDef>, x: number, z: number, scaleMul = 1): boolean => {
    const y = terrain.heightAt(x, z)
    if (!spotOk(def, terrain, biome, x, z, y)) return false
    const r = def.height * 0.35 * scaleMul
    for (const o of occupied) {
      const dx = o[0] - x
      const dz = o[1] - z
      if (dx * dx + dz * dz < (o[2] + r) * (o[2] + r)) return false
    }
    occupied.push([x, z, r])
    const level = biome.terrain.waterLevel ?? WATER_Y
    let py = def.placement === 'water' ? level : y
    if (def.placement === 'air') py = y + 90 + rng.range(0, 150)
    py -= def.height * (def.sink ?? 0.04)
    out.props.push({ prop: def.id, x, y: py, z, yaw: def.randomYaw === false ? (rng.chance(0.5) ? 0 : Math.PI) : rng.range(0, Math.PI * 2), scale: (1 + rng.range(-1, 1) * (def.jitter ?? 0.15)) * scaleMul })
    return true
  }

  // Keep the first 120 m clear around the launch pad so the cliff reads.
  const nearPad = index === 0
  for (const spawn of biome.props) {
    const def = reg.props.get(spawn.prop)
    if (!def) continue
    const expected = (spawn.density * CHUNK_LENGTH) / 100
    let count = Math.floor(expected) + (rng.chance(expected - Math.floor(expected)) ? 1 : 0)
    if (nearPad) count = Math.round(count * 0.5)
    const band = spawn.band ?? [10, HALF_WIDTH]
    for (let i = 0; i < count; i++) {
      const side = rng.chance(0.5) ? 1 : -1
      const x = side * rng.range(band[0], Math.min(band[1], HALF_WIDTH))
      const z = rng.range(z1, z0)
      if (nearPad && -z < 120 && Math.abs(x) < 60) continue
      if (spawn.cluster) {
        const n = rng.int(spawn.cluster[0], spawn.cluster[1])
        for (let k = 0; k < n; k++) tryPlace(def, x + rng.range(-def.height, def.height) * 1.2, z + rng.range(-def.height, def.height) * 1.2)
      } else {
        tryPlace(def, x, z)
      }
    }
  }
  // Landmarks: once per segment at a fixed fraction.
  const segStart = Math.floor(dMid / SEGMENT) * SEGMENT
  for (const lm of biome.landmarks) {
    const d = segStart + lm.at * SEGMENT
    if (d >= -z0 && d < -z1) {
      const def = reg.props.get(lm.prop)
      if (!def) continue
      const x = lm.x ?? 0
      const z = -d
      const y = terrain.heightAt(x, z)
      const level = biome.terrain.waterLevel ?? WATER_Y
      let py = def.placement === 'water' ? level : Math.max(y, biome.terrain.water ? level : y)
      if (def.placement === 'air') py = y + 90
      py -= def.height * (def.sink ?? 0.04)
      out.props.push({ prop: def.id, x, y: py, z, yaw: def.randomYaw === false ? 0 : rng.range(0, Math.PI * 2), scale: lm.scale ?? 1, landmark: true })
      occupied.push([x, z, def.height * 0.6])
    }
  }

  // --- Pickups -------------------------------------------------------------
  if (index >= 1) {
    const pairs: Array<[Readonly<PickupDef>, number]> = []
    for (const p of reg.pickups.values()) {
      let w = p.weight * (biome.pickupBias[p.id] ?? 1)
      if (p.rare) w *= luckF
      pairs.push([p, w])
    }
    // Groups per chunk: coins are frequent, specials sparse.
    const groups = 3 + rng.int(0, 2)
    let gid = index * 100
    for (let g = 0; g < groups; g++) {
      const def = rng.weighted(pairs)
      const z = rng.range(z1 + 10, z0 - 10)
      const x = rng.range(-70, 70)
      const ground = terrain.heightAt(x, z)
      const level = biome.terrain.waterLevel ?? WATER_Y
      const base = Math.max(ground, biome.terrain.water ? level : ground)
      const alt = rng.range(def.altitude[0], def.altitude[1])
      gid++
      if (def.id === 'thermal') {
        out.pickups.push({ pickup: def.id, x, y: base, z, group: gid })
        continue
      }
      const pattern = def.id === 'coin' ? rng.pick(['line', 'arc', 'sine', 'grid'] as const) : def.pattern ?? 'single'
      switch (pattern) {
        case 'line': {
          const n = rng.int(5, 9)
          for (let i = 0; i < n; i++) out.pickups.push({ pickup: def.id, x, y: base + alt, z: z - i * 4.5, group: gid })
          break
        }
        case 'arc': {
          const n = rng.int(6, 9)
          for (let i = 0; i < n; i++) {
            const u = i / (n - 1)
            out.pickups.push({ pickup: def.id, x, y: base + alt + Math.sin(u * Math.PI) * 12, z: z - i * 5, group: gid })
          }
          break
        }
        case 'sine': {
          const n = rng.int(8, 12)
          for (let i = 0; i < n; i++) out.pickups.push({ pickup: def.id, x: x + Math.sin(i * 0.8) * 10, y: base + alt, z: z - i * 4.5, group: gid })
          break
        }
        case 'grid': {
          for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) out.pickups.push({ pickup: def.id, x: x + (i - 1) * 4, y: base + alt + (j - 1) * 4, z, group: gid })
          break
        }
        case 'chain': {
          for (let i = 0; i < 3; i++) out.pickups.push({ pickup: def.id, x: x + (i - 1) * 6, y: base + alt + i * 3, z: z - i * 28, group: gid })
          break
        }
        default:
          out.pickups.push({ pickup: def.id, x, y: base + alt, z, group: gid })
      }
    }
  }

  // --- Hazards -------------------------------------------------------------
  if (index >= 2) {
    for (const hs of biome.hazards) {
      const def = reg.hazards.get(hs.hazard)
      if (!def) continue
      const expected = (hs.rate * CHUNK_LENGTH) / 100
      const count = Math.floor(expected) + (rng.chance(expected - Math.floor(expected)) ? 1 : 0)
      for (let i = 0; i < count; i++) {
        const x = rng.range(-60, 60)
        const z = rng.range(z1 + 5, z0 - 5)
        const ground = terrain.heightAt(x, z)
        const level = biome.terrain.waterLevel ?? WATER_Y
        const base = Math.max(ground, biome.terrain.water ? level : ground)
        out.hazards.push({ hazard: def.id, x, y: base + rng.range(def.altitude[0], def.altitude[1]), z, dir: rng.chance(0.5) ? 1 : -1 })
      }
    }
  }
  return out
}
