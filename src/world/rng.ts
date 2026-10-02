/**
 * Seeded PRNG (mulberry32). Every random draw that affects a run goes through
 * one of these so ghosts and replays reproduce exactly (ARCHITECTURE §3).
 * Pure: no three.js, no DOM.
 */
export class Rng {
  private s: number

  constructor(seed: number) {
    this.s = seed >>> 0
  }

  /** Uniform in [0, 1). */
  next(): number {
    let t = (this.s += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** Uniform in [a, b). */
  range(a: number, b: number): number {
    return a + (b - a) * this.next()
  }

  /** Integer in [a, b] inclusive. */
  int(a: number, b: number): number {
    return a + Math.floor(this.next() * (b - a + 1))
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.next() < p
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)]
  }

  /** Weighted pick from [item, weight] pairs. */
  weighted<T>(pairs: ReadonlyArray<readonly [T, number]>): T {
    let total = 0
    for (const [, w] of pairs) total += w
    let r = this.next() * total
    for (const [item, w] of pairs) {
      r -= w
      if (r <= 0) return item
    }
    return pairs[pairs.length - 1][0]
  }

  /** Derive an independent child stream (e.g. per chunk) without consuming much of this one. */
  fork(salt: number): Rng {
    return new Rng(hash2(this.s, salt))
  }
}

/** Deterministic 2-int hash → uint32 (for per-chunk / per-cell seeds). */
export function hash2(a: number, b: number): number {
  let h = (a | 0) ^ 0x9e3779b9
  h = Math.imul(h ^ (b | 0), 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

/** Seed from a string (for weekly challenge / daily seeds). */
export function seedFromString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Fresh run seed from the clock (the only place Math.random-ish entropy enters a run). */
export function freshSeed(): number {
  return (Date.now() ^ ((Math.random() * 0xffffffff) >>> 0)) >>> 0
}

// ---------------------------------------------------------------------------
// Value noise helpers for terrain (deterministic in x,z; no state).
// ---------------------------------------------------------------------------

function hashXZ(xi: number, zi: number, seed: number): number {
  return hash2(hash2(xi, zi), seed) / 4294967296
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t)
}

/** 2D value noise in [0,1], smooth, periodic in nothing. Cell size 1. */
export function valueNoise(x: number, z: number, seed = 0): number {
  const xi = Math.floor(x)
  const zi = Math.floor(z)
  const fx = smooth(x - xi)
  const fz = smooth(z - zi)
  const a = hashXZ(xi, zi, seed)
  const b = hashXZ(xi + 1, zi, seed)
  const c = hashXZ(xi, zi + 1, seed)
  const d = hashXZ(xi + 1, zi + 1, seed)
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz
}

/** Fractal value noise in [-1,1]. */
export function fbm(x: number, z: number, octaves = 4, seed = 0, lacunarity = 2.02, gain = 0.5): number {
  let amp = 1
  let sum = 0
  let norm = 0
  let fx = x
  let fz = z
  for (let i = 0; i < octaves; i++) {
    sum += (valueNoise(fx, fz, seed + i * 101) * 2 - 1) * amp
    norm += amp
    amp *= gain
    fx *= lacunarity
    fz *= lacunarity
  }
  return sum / norm
}

/** Ridged noise in [0,1]: sharp crests for mesas / alpine ridges. */
export function ridged(x: number, z: number, octaves = 3, seed = 0): number {
  let amp = 1
  let sum = 0
  let norm = 0
  let fx = x
  let fz = z
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(valueNoise(fx, fz, seed + i * 37) * 2 - 1)
    sum += n * n * amp
    norm += amp
    amp *= 0.5
    fx *= 2.1
    fz *= 2.1
  }
  return sum / norm
}
