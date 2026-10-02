/**
 * Content registries (ARCHITECTURE §2). Each content type is a folder of
 * one-file definitions collected with import.meta.glob. Adding content = adding
 * a file. Types and define* helpers live in define.ts.
 */

import type { PropDef, BiomeDef, PlaneDef, UpgradeDef, PickupDef, HazardDef, SoftWallDef, MissionDef, AchievementDef, PaintDef } from './define'

export * from './define'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`[registry] ${msg}`)
}

function collect<T extends { id: string }>(mods: Record<string, unknown>, what: string): Map<string, T> {
  const map = new Map<string, T>()
  for (const [file, mod] of Object.entries(mods)) {
    const rec = (mod as { default?: T }).default
    assert(rec && typeof rec === 'object' && 'id' in rec, `${file} must export default define${what}(...)`)
    assert(!map.has(rec.id), `duplicate ${what} id "${rec.id}" in ${file}`)
    map.set(rec.id, rec)
  }
  return map
}

// ---------------------------------------------------------------------------
// Collections (filled by the glob imports below)
// ---------------------------------------------------------------------------

export const PROPS = collect<Readonly<PropDef>>(import.meta.glob('./props/*.ts', { eager: true }), 'Prop')
export const BIOMES = collect<Readonly<BiomeDef>>(import.meta.glob('./biomes/*.ts', { eager: true }), 'Biome')
export const PLANES = collect<Readonly<PlaneDef>>(import.meta.glob('./planes/*.ts', { eager: true }), 'Plane')
export const UPGRADES = collect<Readonly<UpgradeDef>>(import.meta.glob('./upgrades/*.ts', { eager: true }), 'Upgrade')
export const PICKUPS = collect<Readonly<PickupDef>>(import.meta.glob('./pickups/*.ts', { eager: true }), 'Pickup')
export const HAZARDS = collect<Readonly<HazardDef>>(import.meta.glob('./hazards/*.ts', { eager: true }), 'Hazard')
export const SOFTWALLS = collect<Readonly<SoftWallDef>>(import.meta.glob('./softwalls/*.ts', { eager: true }), 'SoftWall')
export const MISSIONS = collect<Readonly<MissionDef>>(import.meta.glob('./missions/*.ts', { eager: true }), 'Mission')
export const ACHIEVEMENTS = collect<Readonly<AchievementDef>>(import.meta.glob('./achievements/*.ts', { eager: true }), 'Achievement')
export const PAINTS = collect<Readonly<PaintDef>>(import.meta.glob('./paints/*.ts', { eager: true }), 'Paint')

/** v1 biomes in run order. */
export const BIOME_ORDER: ReadonlyArray<Readonly<BiomeDef>> = [...BIOMES.values()]
  .filter((b) => b.scope !== 'v2')
  .sort((a, b) => a.order - b.order)

/** v1 planes by tier. */
export const PLANE_LADDER: ReadonlyArray<Readonly<PlaneDef>> = [...PLANES.values()]
  .filter((p) => p.scope !== 'v2')
  .sort((a, b) => a.tier - b.tier)

/** Plane for a total upgrade level. */
export function planeForLevel(total: number): Readonly<PlaneDef> {
  let cur = PLANE_LADDER[0]
  for (const p of PLANE_LADDER) if (total >= p.unlockAt) cur = p
  return cur
}

/** Cross-reference validation (run by the registry test and once at boot in dev). */
export function validateRegistries(): string[] {
  const problems: string[] = []
  for (const b of BIOMES.values()) {
    for (const p of b.props) if (!PROPS.has(p.prop)) problems.push(`biome ${b.id} references unknown prop ${p.prop}`)
    for (const l of b.landmarks) if (!PROPS.has(l.prop)) problems.push(`biome ${b.id} landmark references unknown prop ${l.prop}`)
    for (const h of b.hazards) if (!HAZARDS.has(h.hazard)) problems.push(`biome ${b.id} references unknown hazard ${h.hazard}`)
    for (const s of b.softWalls) if (!SOFTWALLS.has(s)) problems.push(`biome ${b.id} references unknown soft wall ${s}`)
    for (const k of Object.keys(b.pickupBias)) if (!PICKUPS.has(k)) problems.push(`biome ${b.id} pickupBias references unknown pickup ${k}`)
  }
  const orders = BIOME_ORDER.map((b) => b.order)
  for (let i = 0; i < orders.length; i++) if (orders[i] !== i + 1) problems.push(`biome order gap at ${i + 1}`)
  let last = -1
  for (const p of PLANE_LADDER) {
    if (p.unlockAt <= last) problems.push(`plane ${p.id} unlockAt ${p.unlockAt} not increasing`)
    last = p.unlockAt
  }
  return problems
}
