/**
 * Balance lock for the flight model.
 *
 * These tests simulate full flights with the pure functions in flight.ts and
 * assert the verified distance targets from docs/GDD.md §2 and the balance
 * oracle (legacy/balance-sim.js, the "FINAL" P-set):
 *
 *   stock  (all level 0)  ≈ 292 m   (assert 250–350 m)
 *   all-5                 ≈ 2661 m  (assert within ±15% of the 2502 m oracle)
 *   all-10                ≈ 8157 m  (assert 6.3–8.5 km)
 *
 * The harness mirrors the oracle exactly: launch at full power with the default
 * 0.42 pitch, a fixed 0.02 s timestep, boost held the whole way, no steering,
 * over the terrain-free launch-cliff ground. The run ends when the plane drops
 * to within 1 m of the cliff surface (the oracle's break condition).
 */

import { describe, it, expect } from 'vitest'
import {
  derivePlaneStats,
  launch,
  simStep,
  cliffGroundY,
  distance,
  uniformLevels,
  ZERO_LEVELS,
  gradeLaunch,
  zoneCenter,
  liftFactor,
  type UpgradeLevels,
  type PlaneStats,
} from './flight'

const DT = 0.02
const MAX_TIME = 900

/** Simulate a full flight over the launch cliff and return [metres, seconds]. */
function flyToGround(lv: UpgradeLevels): { dist: number; time: number } {
  const stats: PlaneStats = derivePlaneStats(lv)
  // Launch at full power (matches the oracle's power = 1, default 0.42 pitch).
  const state = launch(stats, 1)
  let t = 0
  while (t < MAX_TIME) {
    simStep(state, DT, { boost: true }, stats)
    t += DT
    // Oracle break condition: plane is within 1 m of the cliff surface.
    if (state.y <= cliffGroundY(state.z) + 1) break
  }
  return { dist: Math.round(distance(state)), time: Math.round(t) }
}

describe('derivePlaneStats (GDD §2 formulas)', () => {
  it('stock plane matches the GDD base numbers', () => {
    const s = derivePlaneStats(ZERO_LEVELS)
    expect(s.launch).toBe(34)
    expect(s.stall).toBe(14)
    expect(s.gr).toBe(7)
    expect(s.drag).toBeCloseTo(0.0028, 10)
    expect(s.thrust).toBe(5)
    expect(s.fuel).toBe(2.5)
    expect(s.turn).toBeCloseTo(1.4, 10)
    expect(s.magnet).toBe(5)
    expect(s.boost).toBe(16)
    expect(s.nitro0).toBeCloseTo(0.4, 10)
    expect(s.ndrain).toBeCloseTo(0.3, 10)
    expect(s.shields).toBe(0)
    expect(s.coinMult).toBe(1)
    expect(s.luckF).toBe(1)
  })

  it('maxed plane matches the GDD level-10 numbers', () => {
    const s = derivePlaneStats(uniformLevels(10))
    expect(s.launch).toBe(99) // 34 + 6.5·10
    expect(s.stall).toBeCloseTo(8, 10) // 14 − 0.6·10
    expect(s.gr).toBe(16) // 7 + 0.9·10
    expect(s.thrust).toBe(27) // 5 + 2.2·10
    expect(s.fuel).toBe(16.5) // 2.5 + 1.4·10
    expect(s.boost).toBe(33) // 16 + 1.2·10 + 0.5·10
    expect(s.magnet).toBe(27) // 5 + 2.2·10
    expect(s.shields).toBe(4) // floor((10+2)/3)
    expect(s.coinMult).toBeCloseTo(1.7, 10) // 1 + 0.07·10
    expect(s.luckF).toBeCloseTo(2, 10) // 1 + 0.1·10
    // drag = 0.0028 / 1.8 / 2
    expect(s.drag).toBeCloseTo(0.0028 / 1.8 / 2, 12)
  })

  it('shields follow the GDD table 0,1,1,1,2,2,2,3,3,3,4', () => {
    const table = [0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4]
    for (let armor = 0; armor <= 10; armor++) {
      expect(derivePlaneStats({ ...ZERO_LEVELS, armor }).shields).toBe(table[armor])
    }
  })
})

describe('launch', () => {
  it('seeds state from the stats and perfect-timing multiplier', () => {
    const stats = derivePlaneStats(ZERO_LEVELS)
    const st = launch(stats, 1, { mult: 1.16 })
    expect(st.s).toBeCloseTo(34 * 1.16, 6)
    expect(st.a).toBeCloseTo(0.42, 10)
    expect(st.fuel).toBe(stats.fuel)
    expect(st.nitro).toBe(stats.nitro0)
    expect(st.alive).toBe(true)
  })

  it('never launches slower than 6 m/s', () => {
    const stats = derivePlaneStats(ZERO_LEVELS)
    expect(launch(stats, 0.01).s).toBe(6)
  })
})

describe('gradeLaunch (perfect-timing)', () => {
  it('grades a dead-center launch as perfect with a streak bonus', () => {
    const center = zoneCenter(0)
    const r0 = gradeLaunch(center, center, 0)
    expect(r0.grade).toBe('perfect')
    expect(r0.mult).toBeCloseTo(1.16, 10)
    expect(r0.streak).toBe(1)
    const r4 = gradeLaunch(center, center, 4)
    expect(r4.mult).toBeCloseTo(1.16 + 0.04 * 4, 10) // streak caps at +4
  })

  it('grades a near miss as good and a wide miss as none', () => {
    const center = 0.8
    expect(gradeLaunch(center + 0.1, center).grade).toBe('good')
    expect(gradeLaunch(center + 0.3, center).grade).toBe('none')
  })
})

describe('liftFactor', () => {
  it('is 0 at/below 0.6·stall and 1 at/above stall', () => {
    expect(liftFactor(14 * 0.6, 14)).toBe(0)
    expect(liftFactor(14, 14)).toBeCloseTo(1, 10)
    expect(liftFactor(14 * 0.8, 14)).toBeCloseTo(0.5, 10)
  })
})

describe('balance lock — full-flight distances', () => {
  it('stock (all level 0) travels ~290 m (250–350)', () => {
    const { dist } = flyToGround(ZERO_LEVELS)
    // Oracle: 292 m.
    expect(dist).toBe(292)
    expect(dist).toBeGreaterThanOrEqual(250)
    expect(dist).toBeLessThanOrEqual(350)
  })

  it('all-level-5 travels ~2.5 km (within ±15% of the 2502 m oracle)', () => {
    const { dist } = flyToGround(uniformLevels(5))
    // Oracle FINAL: 2502 m; GDD 0.1 body-drag variant: 2661 m.
    const lo = 2502 * 0.85 // 2126.7
    const hi = 2502 * 1.15 // 2877.3
    expect(dist).toBe(2661)
    expect(dist).toBeGreaterThanOrEqual(lo)
    expect(dist).toBeLessThanOrEqual(hi)
  })

  it('all-level-10 travels ~7.4 km (6.3–8.5 km)', () => {
    const { dist } = flyToGround(uniformLevels(10))
    // Oracle FINAL: 7391 m; GDD 0.1 body-drag variant: 8157 m.
    expect(dist).toBe(8157)
    expect(dist).toBeGreaterThanOrEqual(6300)
    expect(dist).toBeLessThanOrEqual(8500)
  })

  it('distance increases monotonically with upgrade level', () => {
    let prev = 0
    for (let n = 0; n <= 10; n++) {
      const { dist } = flyToGround(uniformLevels(n))
      expect(dist).toBeGreaterThan(prev)
      prev = dist
    }
  })
})
