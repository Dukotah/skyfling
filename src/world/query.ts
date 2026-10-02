/**
 * WorldQuery — the only way the game asks the world about a point
 * (ARCHITECTURE §3). Implemented by world/world.ts, consumed by game/ to
 * build the FlightEnv passed into the pure sim each step.
 */

export type SurfaceKind = 'ground' | 'water' | 'lava' | 'ice'

export interface BiomeSample {
  /** Registry id of the biome at this distance. */
  biome: string
  /** Next biome (for blending), equal to `biome` outside the transition band. */
  next: string
  /** 0 = fully `biome`, 1 = fully `next`. Non-zero only in the last 14% of a segment. */
  blend: number
  /** Index of the segment (0-based), i.e. how many biome boundaries have been crossed. */
  segment: number
}

export interface SoftWallContribution {
  kind: string
  index: number
  /** 0..1 how deep inside the wall the point is (0 = outside). */
  depth: number
  /** Extra drag coefficient to add to the sim this step. */
  dragAdd: number
  /** Downforce in m/s² (positive pushes down). */
  downforce: number
  /** Lateral push in m/s² (positive = +x). */
  sidePush: number
  /** Yaw push in rad/s. */
  yawPush: number
  /** Lift multiplier (1 = normal, 0.6 = thin air). */
  liftScale: number
  /** Fuel burn multiplier (1 = normal, 2 = ash cloud). */
  fuelBurn: number
}

export interface WorldQuery {
  heightAt(x: number, z: number): number
  surfaceAt(x: number, z: number): SurfaceKind
  /** Terrain slope along the flight direction, radians (positive = uphill ahead). */
  slopeAt(x: number, z: number): number
  biomeAt(distance: number): BiomeSample
  /** Wind vector at a point and time (m/s). */
  windAt(x: number, y: number, z: number, t: number, out: { x: number; y: number; z: number }): void
  /** Soft-wall force contributions at a point. Empty when clear. */
  softWallsAt(x: number, y: number, z: number): SoftWallContribution[]
  /** Updraft (m/s) from thermals/geysers at a point. */
  thermalAt(x: number, y: number, z: number): number
}
