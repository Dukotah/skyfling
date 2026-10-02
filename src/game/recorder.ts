/**
 * Run recorder (ARCHITECTURE §3): records the seed, launch and per-step inputs
 * so a run can be replayed exactly (ghost, tests). Inputs are quantised to
 * 1/127 and run-length encoded so a 5-minute flight is a few KB.
 */

import type { FlightInput } from '../sim/flight'

export interface Recording {
  v: 1
  seed: number
  plane: string
  power: number
  mult: number
  /** RLE triples: [pitchQ, steerQ, boost(0/1), count] flattened. */
  rle: number[]
  /** Final distance, for the ghost HUD. */
  distance: number
  steps: number
  /** Sampled world positions [x,y,z,...] every PATH_EVERY steps (exact ghost playback without re-simulating). */
  path: number[]
}

export const PATH_EVERY = 6

const Q = 127

function q(v: number): number {
  return Math.max(-Q, Math.min(Q, Math.round(v * Q)))
}

export class Recorder {
  private rle: number[] = []
  private last: [number, number, number] | null = null
  private count = 0
  steps = 0
  path: number[] = []

  constructor(public seed: number, public plane: string, public power: number, public mult: number) {}

  /** Record one step. Returns the QUANTISED input — the sim must be stepped with this so replays match exactly. */
  push(input: FlightInput): FlightInput {
    const cur: [number, number, number] = [q(input.pitch ?? 0), q(input.steer ?? 0), input.boost ? 1 : 0]
    this.steps++
    if (this.last && this.last[0] === cur[0] && this.last[1] === cur[1] && this.last[2] === cur[2]) {
      this.count++
    } else {
      this.flush()
      this.last = cur
      this.count = 1
    }
    return { pitch: cur[0] / Q, steer: cur[1] / Q, boost: cur[2] === 1 }
  }

  /** Call after each sim step with the new position. */
  sample(x: number, y: number, z: number): void {
    if (this.steps % PATH_EVERY === 0) this.path.push(Math.round(x * 100) / 100, Math.round(y * 100) / 100, Math.round(z * 100) / 100)
  }

  private flush(): void {
    if (this.last) this.rle.push(this.last[0], this.last[1], this.last[2], this.count)
  }

  finish(distance: number): Recording {
    this.flush()
    this.last = null
    this.count = 0
    return { v: 1, seed: this.seed, plane: this.plane, power: this.power, mult: this.mult, rle: this.rle.slice(), distance, steps: this.steps, path: this.path.slice() }
  }
}

/** Iterate a recording's inputs step by step. */
export class Replayer {
  private i = 0
  private left = 0
  private cur: FlightInput = {}
  step = 0

  constructor(private rec: Recording) {}

  get done(): boolean {
    return this.step >= this.rec.steps
  }

  next(): FlightInput {
    if (this.left <= 0) {
      if (this.i >= this.rec.rle.length) {
        this.step++
        return this.cur
      }
      const r = this.rec.rle
      this.cur = { pitch: r[this.i] / Q, steer: r[this.i + 1] / Q, boost: r[this.i + 2] === 1 }
      this.left = r[this.i + 3]
      this.i += 4
    }
    this.left--
    this.step++
    return this.cur
  }

  reset(): void {
    this.i = 0
    this.left = 0
    this.step = 0
    this.cur = {}
  }
}

/** Compact string form for save/export. */
export function encodeRecording(rec: Recording): string {
  return btoa(JSON.stringify(rec))
}

export function decodeRecording(s: string): Recording | null {
  try {
    const r = JSON.parse(atob(s)) as Recording
    return r && r.v === 1 && Array.isArray(r.rle) ? { ...r, path: Array.isArray(r.path) ? r.path : [] } : null
  } catch {
    return null
  }
}
