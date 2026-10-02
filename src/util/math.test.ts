import { describe, it, expect } from 'vitest'
import { clamp, lerp, damp } from './math'

describe('clamp', () => {
  it('bounds below and above', () => {
    expect(clamp(-5, 0, 10)).toBe(0)
    expect(clamp(15, 0, 10)).toBe(10)
    expect(clamp(4, 0, 10)).toBe(4)
  })
})

describe('lerp', () => {
  it('interpolates endpoints', () => {
    expect(lerp(0, 10, 0)).toBe(0)
    expect(lerp(0, 10, 1)).toBe(10)
    expect(lerp(0, 10, 0.5)).toBe(5)
  })
})

describe('damp', () => {
  it('moves toward the target and converges', () => {
    let v = 0
    for (let i = 0; i < 300; i++) v = damp(v, 100, 6, 1 / 60)
    expect(v).toBeGreaterThan(99.5)
    expect(v).toBeLessThanOrEqual(100)
  })
})
