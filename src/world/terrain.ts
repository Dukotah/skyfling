/**
 * Terrain heightfield (ARCHITECTURE §6). Pure functions of (x, z) given the
 * biome sequence: the launch cliff, per-biome amplitude/roughness/basin from
 * the prototype `groundY`, ridged mesas and alpine ridges, a flat corridor
 * channel so the flight path is always flyable, and blending across the last
 * 14% of each 1,200 m segment. Deterministic (seeded noise), no three.js.
 */

import { fbm, ridged, valueNoise } from './rng'
import type { BiomeDef } from '../data/define'
import type { BiomeSample, SurfaceKind } from './query'

export const SEGMENT = 1200
export const BLEND_FRACTION = 0.14
/** Lateral half-extent of the generated world (metres). */
export const HALF_WIDTH = 450
export const WATER_Y = -26

export interface TerrainSampler {
  heightAt(x: number, z: number): number
  biomeAt(distance: number): BiomeSample
  surfaceAt(x: number, z: number): SurfaceKind
  slopeAt(x: number, z: number): number
  /** The two biomes and weight at a distance (for render palette/atmosphere). */
  blendAt(distance: number): { a: Readonly<BiomeDef>; b: Readonly<BiomeDef>; t: number }
}

/** Launch cliff: flat pad, then −22 m over 15–95 m (GDD §2). */
export function cliffDrop(d: number): number {
  const t = Math.min(1, Math.max(0, (d - 15) / 80))
  return -22 * (t * t * (3 - 2 * t))
}

/** Raw biome height before blending: hills + ridges + basin channel. */
function biomeHeight(b: Readonly<BiomeDef>, x: number, z: number, seed: number): number {
  const T = b.terrain
  if (T.isles) return (T.floor ?? -60) // Sky Isles: the ground is far below; islands are props
  let h = 0
  const s = seed * 0.001
  // Broad hills.
  h += fbm(x * 0.0045 + s, z * 0.0045, 4, seed) * T.amplitude
  // Medium detail scaled by roughness.
  h += fbm(x * 0.016 + s, z * 0.016, 3, seed + 7) * T.amplitude * 0.35 * (0.3 + T.roughness)
  // Ridged crests for canyon / alpine / volcano.
  if (T.roughness > 0.4) {
    const r = ridged(x * 0.0035 + s, z * 0.0035, 3, seed + 13)
    h += (r - 0.4) * T.amplitude * 1.6 * (T.roughness - 0.3)
  }
  // Mesas: flatten high ground into plateaus.
  if (T.mesa) {
    const plateau = Math.round(h / 18) * 18
    h = h + (plateau - h) * T.mesa * Math.min(1, Math.max(0, h / 12))
  }
  // Basin channel: carve a flat valley along the corridor so the line is always flyable.
  if (T.basin > 0) {
    const w = 120 + 60 * (1 - T.basin)
    const k = Math.exp(-(x * x) / (2 * w * w))
    h = h * (1 - T.basin * 0.85 * k) - 6 * T.basin * k
  }
  // Gentle lateral rise toward the edges keeps the world framed.
  h += Math.max(0, Math.abs(x) - 300) * 0.25
  return h + (T.floor ?? 0)
}

export function createTerrain(biomes: ReadonlyArray<Readonly<BiomeDef>>, seed: number): TerrainSampler {
  const n = biomes.length
  const byIndex = (i: number) => biomes[((i % n) + n) % n]

  function blendAt(distance: number) {
    const d = Math.max(0, distance)
    const seg = Math.floor(d / SEGMENT)
    const f = (d - seg * SEGMENT) / SEGMENT
    const a = byIndex(seg)
    const b = byIndex(seg + 1)
    const start = 1 - BLEND_FRACTION
    const t = f < start ? 0 : smooth((f - start) / BLEND_FRACTION)
    return { a, b, t, seg }
  }

  function heightAt(x: number, z: number): number {
    const d = -z
    const { a, b, t } = blendAt(d)
    let h = biomeHeight(a, x, z, seed)
    if (t > 0) h = h + (biomeHeight(b, x, z, seed) - h) * t
    // The whole world sits 22 m below the launch pad (prototype groundY): the
    // cliff drop is permanent, and the pad itself is flat for the first 100 m.
    const drop = cliffDrop(d)
    if (d < 180) {
      const k = Math.min(1, Math.max(0, (d - 100) / 80))
      const padH = Math.abs(x) > 20 ? -Math.min(30, (Math.abs(x) - 20) * 0.6) : 0
      h = (drop + padH) * (1 - k) + (h + drop) * k
      if (d < 15) h = Math.max(h, padH)
      return h
    }
    return h + drop
  }

  function biomeAt(distance: number): BiomeSample {
    const { a, b, t, seg } = blendAt(distance)
    return { biome: a.id, next: b.id, blend: t, segment: seg }
  }

  function surfaceAt(x: number, z: number): SurfaceKind {
    const { a, b, t } = blendAt(-z)
    const biome = t < 0.5 ? a : b
    const T = biome.terrain
    if (!T.water) return 'ground'
    const level = T.waterLevel ?? WATER_Y
    if (heightAt(x, z) < level - 0.5) return T.waterKind === 'lava' ? 'lava' : T.waterKind === 'ice' ? 'ice' : 'water'
    return 'ground'
  }

  function slopeAt(x: number, z: number): number {
    const h0 = heightAt(x, z + 2)
    const h1 = heightAt(x, z - 2)
    return Math.atan2(h1 - h0, 4)
  }

  return { heightAt, biomeAt, surfaceAt, slopeAt, blendAt }
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t)
}

/** Small cheap noise for prop jitter etc. */
export const noise2 = valueNoise
