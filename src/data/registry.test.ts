import { describe, it, expect } from 'vitest'
import { BIOMES, BIOME_ORDER, PLANES, PLANE_LADDER, PROPS, PICKUPS, HAZARDS, SOFTWALLS, UPGRADES, MISSIONS, ACHIEVEMENTS, PAINTS, validateRegistries, planeForLevel, upgradeCost } from './registry'
import { MODELS } from '../assets/manifest.generated'

describe('content registries', () => {
  it('load the v1 roster', () => {
    expect(BIOME_ORDER.length).toBe(12)
    expect(PLANE_LADDER.length).toBe(10)
    expect(UPGRADES.size).toBe(13)
    expect(SOFTWALLS.size).toBe(6)
    expect(PICKUPS.size).toBe(10)
    expect(HAZARDS.size).toBe(8)
    expect(MISSIONS.size).toBe(16)
    expect(ACHIEVEMENTS.size).toBe(30)
    expect(PAINTS.size).toBe(12)
    expect(PROPS.size).toBeGreaterThan(80)
    expect(BIOMES.size).toBe(12)
    expect(PLANES.size).toBe(10)
  })

  it('cross-references resolve', () => {
    expect(validateRegistries()).toEqual([])
  })

  it('every GLB-backed prop, plane, pickup and hazard model exists in the asset manifest', () => {
    const ids = new Set(Object.keys(MODELS))
    const missing: string[] = []
    for (const p of PROPS.values()) if (!p.model.startsWith('proc:') && !ids.has(p.model)) missing.push(`prop ${p.id}→${p.model}`)
    for (const p of PLANES.values()) if (!p.model.startsWith('proc:') && !ids.has(p.model)) missing.push(`plane ${p.id}→${p.model}`)
    for (const p of PICKUPS.values()) if (!p.model.startsWith('proc:') && !ids.has(p.model)) missing.push(`pickup ${p.id}→${p.model}`)
    for (const h of HAZARDS.values()) if (!h.model.startsWith('proc:') && !ids.has(h.model)) missing.push(`hazard ${h.id}→${h.model}`)
    expect(missing).toEqual([])
  })

  it('plane ladder matches GDD §6 thresholds and total cost follows 30·1.62^L (≈126k for 130 levels)', () => {
    expect(PLANE_LADDER.map((p) => p.unlockAt)).toEqual([0, 8, 20, 34, 50, 68, 86, 104, 118, 130])
    expect(planeForLevel(0).id).toBe('paper-dart')
    expect(planeForLevel(19).id).toBe('kite-biplane')
    expect(planeForLevel(130).id).toBe('phoenix')
    let total = 0
    for (let l = 1; l <= 10; l++) total += upgradeCost(l) * 13
    // GDD §7 quotes ≈76k; the prototype's actual formula sums to ≈126k. The formula is authoritative (DECISIONS 2026-10-02).
    expect(total).toBeGreaterThan(110000)
    expect(total).toBeLessThan(140000)
  })

  it('mission targets are positive and grow with tier', () => {
    for (const m of MISSIONS.values()) {
      const a = m.target({ tier: 0, best: 300 })
      const b = m.target({ tier: 4, best: 1500 })
      expect(a).toBeGreaterThan(0)
      expect(b).toBeGreaterThanOrEqual(a)
      expect(m.describe(a)).toContain(String(a))
    }
  })
})
