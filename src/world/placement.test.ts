import { describe, it, expect } from 'vitest'
import { createTerrain, WATER_Y } from './terrain'
import { generateChunk, CHUNK_LENGTH } from './placement'
import { BIOME_ORDER, PROPS, PICKUPS, HAZARDS, BIOMES } from '../data/registry'

const reg = { props: PROPS, pickups: PICKUPS, hazards: HAZARDS }

describe('chunk placement', () => {
  const terrain = createTerrain(BIOME_ORDER, 777)

  it('is deterministic per seed and chunk', () => {
    const a = generateChunk(5, 777, terrain, reg)
    const b = generateChunk(5, 777, terrain, reg)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    const c = generateChunk(5, 778, terrain, reg)
    expect(JSON.stringify(c)).not.toBe(JSON.stringify(a))
  })

  it('places ground props on land and water props on water, across all biomes', () => {
    for (let i = 0; i < 12 * (1200 / CHUNK_LENGTH); i += 3) {
      const ch = generateChunk(i, 777, terrain, reg)
      const biome = BIOMES.get(ch.biome)!
      const level = biome.terrain.waterLevel ?? WATER_Y
      for (const p of ch.props) {
        if (p.landmark) continue
        const def = PROPS.get(p.prop)!
        const h = terrain.heightAt(p.x, p.z)
        if (def.placement === 'water') expect(h).toBeLessThan(level)
        if (def.placement === 'ground' || def.placement === 'flat') expect(biome.terrain.water ? h >= level : true).toBe(true)
      }
    }
  })

  it('spawns pickups and hazards with content in every biome', () => {
    const seen = new Map<string, { props: number; pickups: number; hazards: number }>()
    for (let i = 2; i < 12 * 8; i++) {
      const ch = generateChunk(i, 777, terrain, reg)
      const s = seen.get(ch.biome) ?? { props: 0, pickups: 0, hazards: 0 }
      s.props += ch.props.length
      s.pickups += ch.pickups.length
      s.hazards += ch.hazards.length
      seen.set(ch.biome, s)
    }
    for (const b of BIOME_ORDER) {
      const s = seen.get(b.id)!
      expect(s, b.id).toBeDefined()
      expect(s.props, `${b.id} props`).toBeGreaterThan(10)
      expect(s.pickups, `${b.id} pickups`).toBeGreaterThan(20)
      if (b.hazards.length) expect(s.hazards, `${b.id} hazards`).toBeGreaterThan(0)
    }
  })

  it('keeps the launch pad area clear', () => {
    const ch = generateChunk(0, 777, terrain, reg)
    for (const p of ch.props) if (-p.z < 120) expect(Math.abs(p.x)).toBeGreaterThanOrEqual(60)
    expect(ch.pickups.length).toBe(0)
  })
})
