import { describe, it, expect } from 'vitest'
import { applyWall, wallDepthFactor, stormDrag, gateRingHit, GATE_BONUS, groundEffect, grazeFactor, type WallInstance } from './softwalls'
import { derivePlaneStats, launch, simStep, uniformLevels, ZERO_LEVELS, distance, cliffGroundY, NEUTRAL_ENV, resetEnv, type FlightEnv } from './flight'

const storm = (index: number, at: number): WallInstance => ({
  kind: 'storm-front', index, at, depth: 60, x: 0, halfWidth: 200, yMin: -100, yMax: 400,
})

describe('soft-wall math', () => {
  it('depth factor is 0 outside, 1 in the core', () => {
    const w = storm(0, 500)
    expect(wallDepthFactor(-400, w)).toBe(0)
    expect(wallDepthFactor(-500, w)).toBe(1)
    expect(wallDepthFactor(-526, w)).toBeGreaterThan(0)
    expect(wallDepthFactor(-531, w)).toBe(0)
  })

  it('storm drag grows with index and shrinks with plating', () => {
    expect(stormDrag(1)).toBeGreaterThan(stormDrag(0))
    expect(stormDrag(0, 10)).toBeCloseTo(stormDrag(0) * 0.6, 10)
  })

  it('applyWall contributes drag + downforce only inside', () => {
    const env: FlightEnv = { ...NEUTRAL_ENV }
    expect(applyWall(0, 50, -100, storm(0, 500), env)).toBe(0)
    expect(env.dragAdd).toBe(0)
    expect(applyWall(0, 50, -500, storm(0, 500), env)).toBe(1)
    expect(env.dragAdd).toBeGreaterThan(0)
    expect(env.downforce).toBeGreaterThan(0)
  })

  it('gate rings grade from the centre outward', () => {
    const gate: WallInstance = { kind: 'headwind-gate', index: 0, at: 300, depth: 10, x: 0, halfWidth: 40, yMin: 0, yMax: 80, gateRadii: [3, 6, 9], gateY: 40 }
    expect(gateRingHit(0, 40, gate)).toBe(0)
    expect(gateRingHit(5, 40, gate)).toBe(1)
    expect(gateRingHit(0, 48, gate)).toBe(2)
    expect(gateRingHit(20, 40, gate)).toBe(-1)
    expect(GATE_BONUS[0]).toBeGreaterThan(GATE_BONUS[2])
  })

  it('ground effect and graze fade with clearance', () => {
    expect(groundEffect(0, true)).toBeCloseTo(1.12, 10)
    expect(groundEffect(15, true)).toBe(1)
    expect(groundEffect(0, false)).toBe(1)
    expect(grazeFactor(1)).toBeCloseTo(0.28, 10)
    expect(grazeFactor(6)).toBe(0)
  })
})

/** Fly through the launch cliff with a storm at 500 m; return distance. */
function flyWithStorm(levels: ReturnType<typeof uniformLevels>, boost: boolean, plating = 0): number {
  const stats = derivePlaneStats(levels)
  const st = launch(stats, 1, { mult: 1.16 })
  const env: FlightEnv = { ...NEUTRAL_ENV }
  const wall = storm(0, 500)
  let t = 0
  while (t < 600) {
    resetEnv(env)
    applyWall(st.x, st.y, st.z, wall, env, plating)
    simStep(st, 0.02, { boost }, stats, env)
    t += 0.02
    if (st.y <= cliffGroundY(st.z) + 1) break
  }
  return distance(st)
}

describe('storm #1 gating (GDD §11)', () => {
  it('a stock plane cannot break the 500 m storm', () => {
    expect(flyWithStorm(ZERO_LEVELS, true)).toBeLessThan(560)
  })
  it('a uniform level-4 plane with boost breaks it and flies on', () => {
    expect(flyWithStorm(uniformLevels(4), true)).toBeGreaterThan(700)
  })
  it('boost matters: the same level-4 plane without boost is shorter', () => {
    expect(flyWithStorm(uniformLevels(4), false)).toBeLessThan(flyWithStorm(uniformLevels(4), true))
  })
  it('storm plating helps', () => {
    expect(flyWithStorm(uniformLevels(2), true, 10)).toBeGreaterThan(flyWithStorm(uniformLevels(2), true, 0))
  })
})

describe('FlightEnv neutrality', () => {
  it('NEUTRAL_ENV changes nothing versus the implicit default', () => {
    const stats = derivePlaneStats(uniformLevels(3))
    const a = launch(stats, 1)
    const b = launch(stats, 1)
    for (let i = 0; i < 400; i++) {
      simStep(a, 0.02, { boost: true }, stats)
      simStep(b, 0.02, { boost: true }, stats, NEUTRAL_ENV)
    }
    expect(a).toEqual(b)
  })
})
