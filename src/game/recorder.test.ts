import { describe, it, expect } from 'vitest'
import { Recorder, Replayer, encodeRecording, decodeRecording } from './recorder'
import { derivePlaneStats, launch, simStep, uniformLevels, cliffGroundY, NEUTRAL_ENV } from '../sim/flight'
import { Rng } from '../world/rng'

describe('run recorder', () => {
  it('replays a recorded flight to the identical final state', () => {
    const stats = derivePlaneStats(uniformLevels(3))
    const rng = new Rng(1234)
    const rec = new Recorder(1234, 'hornet', 1, 1.16)
    const a = launch(stats, 1, { mult: 1.16 })
    // A noisy pilot: random hold/release and steering.
    let hold = false
    let steer = 0
    for (let i = 0; i < 2000; i++) {
      if (i % 37 === 0) hold = rng.chance(0.6)
      if (i % 53 === 0) steer = rng.range(-0.6, 0.6)
      const input = rec.push({ pitch: hold ? 1 : -0.35, steer, boost: i % 200 < 60 })
      simStep(a, 1 / 60, input, stats, NEUTRAL_ENV)
      if (a.y <= cliffGroundY(a.z) + 1) break
    }
    const recording = rec.finish(-a.z)
    expect(recording.rle.length).toBeLessThan(recording.steps * 4)

    const roundTrip = decodeRecording(encodeRecording(recording))!
    const rp = new Replayer(roundTrip)
    const b = launch(stats, 1, { mult: 1.16 })
    while (!rp.done) {
      simStep(b, 1 / 60, rp.next(), stats, NEUTRAL_ENV)
      if (b.y <= cliffGroundY(b.z) + 1) break
    }
    expect(b.x).toBeCloseTo(a.x, 9)
    expect(b.y).toBeCloseTo(a.y, 9)
    expect(b.z).toBeCloseTo(a.z, 9)
    expect(b.s).toBeCloseTo(a.s, 9)
  })

  it('seeded rng is deterministic and forks independently', () => {
    const a = new Rng(42)
    const b = new Rng(42)
    const seqA = Array.from({ length: 5 }, () => a.next())
    const seqB = Array.from({ length: 5 }, () => b.next())
    expect(seqA).toEqual(seqB)
    const f1 = new Rng(42).fork(7).next()
    const f2 = new Rng(42).fork(8).next()
    expect(f1).not.toBe(f2)
  })
})
