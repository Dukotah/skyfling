import { describe, it, expect } from 'vitest'
import { CorridorHash, collideStep, magnetPull, planeHits, type Collidable, type PlaneBody } from './collide'

const body = (z: number): PlaneBody => ({ x: 0, y: 10, z, fx: 0, fy: 0, fz: -1, r: 1.2, noseLen: 2 })
let nextId = 1
const obj = (z: number, x = 0, y = 10, r = 1, nearMiss = 0, kind = 'coin'): Collidable => ({ id: nextId++, kind, x, y, z, r, nearMiss, dead: false, grazed: false })

describe('collision', () => {
  it('hits when spheres overlap, including the nose', () => {
    expect(planeHits(body(-100), obj(-100))).toBe(true)
    expect(planeHits(body(-100), obj(-102.5))).toBe(true) // nose
    expect(planeHits(body(-100), obj(-110))).toBe(false)
  })

  it('spatial hash returns only nearby live objects and prunes behind', () => {
    const h = new CorridorHash<Collidable>(40)
    for (let d = 0; d < 1000; d += 10) h.insert(obj(-d))
    const seen: number[] = []
    h.near(-500, 30, (o) => seen.push(-o.z))
    expect(Math.min(...seen)).toBeGreaterThanOrEqual(430)
    expect(Math.max(...seen)).toBeLessThanOrEqual(570)
    const before = h.size
    h.prune(-500, 100)
    expect(h.size).toBeLessThan(before)
    const seenAfter: number[] = []
    h.near(-200, 30, (o) => seenAfter.push(-o.z))
    expect(seenAfter.length).toBe(0)
  })

  it('collideStep reports hits and credits a near-miss once, after passing', () => {
    const h = new CorridorHash<Collidable>()
    const coin = obj(-100)
    const bird = obj(-100, 5, 10, 1, 8, 'bird')
    h.insert(coin)
    h.insert(bird)
    const out = { hits: [] as Collidable[], nearMisses: [] as Collidable[] }
    collideStep(h, body(-100), out)
    expect(out.hits).toContain(coin)
    expect(out.nearMisses.length).toBe(0) // not yet passed
    collideStep(h, body(-103), out)
    expect(out.nearMisses).toContain(bird)
    collideStep(h, body(-104), out)
    expect(out.nearMisses.length).toBe(0) // credited once
  })

  it('magnet pulls coins in and stops outside the radius', () => {
    const c = obj(-100, 6, 10)
    const b = body(-100)
    expect(magnetPull(c, b, 5, 0.016)).toBe(false)
    expect(magnetPull(c, b, 8, 0.1)).toBe(true)
    expect(c.x).toBeLessThan(6)
  })
})
