/**
 * Soft-wall force math (GDD §5). Pure functions: given the plane's position and
 * a wall description, return the contribution to FlightEnv. The world layer
 * decides WHERE walls are; this decides WHAT they do. Ported from the
 * prototype's buildFront/applyFront (drag 9 + 3.5·i, downforce) and extended
 * with the five other wall types.
 */

import { clamp } from '../util/math'
import type { FlightEnv } from './flight'

export type SoftWallKind = 'storm-front' | 'sandstorm' | 'ash-cloud' | 'crosswind' | 'thin-air' | 'headwind-gate'

export interface WallInstance {
  kind: SoftWallKind
  /** Ordinal of this wall among its kind (0-based). Drives scaling. */
  index: number
  /** Corridor position (distance along −z in metres) of the wall's centre. */
  at: number
  /** Thickness along the corridor. */
  depth: number
  /** Lateral centre and half-width (crosswind corridors and gates are narrower than the sky). */
  x: number
  halfWidth: number
  /** Vertical band [yMin, yMax] in world Y. Thin air uses a floor only. */
  yMin: number
  yMax: number
  /** Gate ring radii (headwind gate only): [inner, mid, outer]. */
  gateRadii?: [number, number, number]
  /** Gate centre Y. */
  gateY?: number
}

/** Storm fronts at the GDD distances. */
export const STORM_DISTANCES = [500, 1150, 2050, 3200, 4700, 6600, 9000, 12000] as const

/** Storm front drag at index i: 9 + 3.5·i (prototype), expressed as extra drag coefficient. */
export function stormDrag(index: number, plating = 0): number {
  // Prototype drag is applied as s -= drag·s²·k with k tuned so a stock plane
  // (34 m/s) loses ~60% of its speed across a 60 m front. Storm plating −4%/Lv.
  return ((9 + 3.5 * index) * 0.0012) * (1 - 0.04 * plating)
}

/** 0 outside, 1 at the core; smooth across the depth. */
export function wallDepthFactor(z: number, wall: WallInstance): number {
  const d = -z
  const half = wall.depth / 2
  const t = 1 - Math.abs(d - wall.at) / half
  return t <= 0 ? 0 : t >= 0.6 ? 1 : t / 0.6
}

export function insideLateral(x: number, y: number, wall: WallInstance): boolean {
  return Math.abs(x - wall.x) <= wall.halfWidth && y >= wall.yMin && y <= wall.yMax
}

/**
 * Accumulate one wall's effect into `env`. Returns the depth factor (0 = not
 * inside) so the caller can emit enter/break events.
 */
export function applyWall(x: number, y: number, z: number, wall: WallInstance, env: FlightEnv, plating = 0): number {
  if (wall.kind === 'headwind-gate') return applyGate(x, y, z, wall, env)
  if (!insideLateral(x, y, wall)) return 0
  const f = wallDepthFactor(z, wall)
  if (f <= 0) return 0
  const relief = 1 - 0.04 * plating
  switch (wall.kind) {
    case 'storm-front':
      env.dragAdd += stormDrag(wall.index, plating) * f
      env.downforce += 2.2 * f * relief
      break
    case 'sandstorm':
      // Wider but weaker: half the storm's drag, strong sideways shove that alternates with index.
      env.dragAdd += stormDrag(wall.index, plating) * 0.5 * f
      env.sidePush += (wall.index % 2 === 0 ? 1 : -1) * 6 * f * relief
      break
    case 'ash-cloud':
      env.dragAdd += stormDrag(wall.index, plating) * 0.7 * f
      env.fuelBurn = Math.max(env.fuelBurn, 1 + f)
      break
    case 'crosswind':
      env.yawPush += 0.35 * f * relief
      env.sidePush += 3 * f * relief
      break
    case 'thin-air':
      env.liftScale = Math.min(env.liftScale, 1 - 0.4 * f)
      break
  }
  return f
}

/**
 * Headwind gate (GDD §5 + Design Bible bull's-eye): a ring of wind arrows.
 * Outside the outer ring but inside the gate's column → −30% speed over the
 * gate depth. Through a ring → speed bonus scaled by the ring hit
 * (mint +30 / butter +55 / coral +90 %). The bonus itself is applied by the
 * game (it's an impulse), this returns the depth factor and sets headwind.
 */
export function applyGate(x: number, y: number, z: number, wall: WallInstance, env: FlightEnv): number {
  const f = wallDepthFactor(z, wall)
  if (f <= 0) return 0
  const radii = wall.gateRadii ?? [3, 6, 9]
  const r = Math.hypot(x - wall.x, y - (wall.gateY ?? (wall.yMin + wall.yMax) / 2))
  if (r > radii[2] && r < wall.halfWidth) {
    // Missed the rings: headwind that costs ~30% of speed across the gate.
    env.headwind += 9 * f
  }
  return f
}

/** Which gate ring (0 inner … 2 outer, −1 none) a point passes through. */
export function gateRingHit(x: number, y: number, wall: WallInstance): number {
  const radii = wall.gateRadii ?? [3, 6, 9]
  const r = Math.hypot(x - wall.x, y - (wall.gateY ?? (wall.yMin + wall.yMax) / 2))
  if (r <= radii[0]) return 0
  if (r <= radii[1]) return 1
  if (r <= radii[2]) return 2
  return -1
}

/** Speed multiplier for a ring hit: coral +90%, butter +55%, mint +30%. */
export const GATE_BONUS = [1.9, 1.55, 1.3] as const

/** Lift multiplier from ground effect (Design Bible P0 Terrain Graze / Puddle Jumper): +12% within 15 m. */
export function groundEffect(clearance: number, enabled: boolean): number {
  if (!enabled || clearance > 15) return 1
  return 1 + 0.12 * (1 - clearance / 15)
}

/** Terrain-graze speed bonus multiplier per second (P0): up to +28%/s·dt at 1 m, 0 beyond 6 m. */
export function grazeFactor(clearance: number): number {
  if (clearance >= 6) return 0
  return clamp((6 - clearance) / 5, 0, 1) * 0.28
}

/** First-break bonus coins for a wall. */
export function breakBonus(kind: SoftWallKind, index: number): number {
  const base = kind === 'storm-front' ? 120 : kind === 'headwind-gate' ? 0 : 80
  return Math.round(base + index * 60)
}
