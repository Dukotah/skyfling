import { describe, it, expect } from 'vitest'
import { createTerrain, SEGMENT, cliffDrop } from './terrain'
import { BIOME_ORDER } from '../data/registry'

describe('terrain', () => {
  const t = createTerrain(BIOME_ORDER, 1234)

  it('starts on a flat pad and drops the cliff (GDD §2)', () => {
    expect(t.heightAt(0, 0)).toBeCloseTo(0, 5)
    expect(t.heightAt(0, -10)).toBeCloseTo(0, 5)
    expect(cliffDrop(95)).toBeCloseTo(-22, 5)
    expect(t.heightAt(0, -95)).toBeLessThan(-18)
    expect(t.heightAt(0, -150)).toBeLessThan(-10)
  })

  it('is deterministic for a seed and differs across seeds', () => {
    const t2 = createTerrain(BIOME_ORDER, 1234)
    const t3 = createTerrain(BIOME_ORDER, 99)
    expect(t2.heightAt(37, -812)).toBe(t.heightAt(37, -812))
    expect(t3.heightAt(37, -812)).not.toBe(t.heightAt(37, -812))
  })

  it('sequences biomes every 1200 m and blends only in the last 14%', () => {
    expect(t.biomeAt(0).biome).toBe('green-meadow')
    expect(t.biomeAt(SEGMENT + 10).biome).toBe('red-canyon')
    expect(t.biomeAt(SEGMENT * 0.5).blend).toBe(0)
    expect(t.biomeAt(SEGMENT * 0.95).blend).toBeGreaterThan(0)
    expect(t.biomeAt(SEGMENT * 11 + 10).biome).toBe('stratosphere')
    expect(t.biomeAt(SEGMENT * 12 + 10).biome).toBe('green-meadow') // wraps
  })

  it('keeps the corridor flyable: no spikes above 60 m within ±40 m of the centre line over 15 km', () => {
    let worst = -Infinity
    for (let d = 100; d < 15000; d += 7) {
      for (const x of [-40, -20, 0, 20, 40]) worst = Math.max(worst, t.heightAt(x, -d))
    }
    expect(worst).toBeLessThan(60)
  })

  it('reports water where the ground is below the water level in water biomes', () => {
    // Blue Coast is segment 3 (2400–3600 m). Search for a water sample.
    let water = 0
    for (let d = 2500; d < 3400; d += 10) for (const x of [-200, -100, 0, 100, 200]) if (t.surfaceAt(x, -d) === 'water') water++
    expect(water).toBeGreaterThan(0)
  })
})
