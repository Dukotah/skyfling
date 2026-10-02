/**
 * Collision math (ARCHITECTURE §3): spheres (pickups/hazards) vs the plane,
 * a spatial hash keyed on corridor distance, magnet pull and near-miss
 * detection. Pure; no three.js.
 */

export interface Sphere {
  x: number
  y: number
  z: number
  r: number
}

export interface Collidable extends Sphere {
  id: number
  kind: string
  /** Near-miss radius (hazards); 0 disables. */
  nearMiss: number
  /** Set once consumed/hit so it is skipped. */
  dead: boolean
  /** Set once a near-miss was credited. */
  grazed: boolean
}

/** Capsule-ish plane body: a sphere at the body centre plus one at the nose. */
export interface PlaneBody {
  x: number
  y: number
  z: number
  /** Forward unit vector. */
  fx: number
  fy: number
  fz: number
  /** Body radius and nose offset. */
  r: number
  noseLen: number
}

export function sphereHit(a: Sphere, b: Sphere): boolean {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = a.z - b.z
  const rr = a.r + b.r
  return dx * dx + dy * dy + dz * dz <= rr * rr
}

export function planeHits(body: PlaneBody, s: Sphere): boolean {
  if (sphereHit(body, s)) return true
  const nose: Sphere = { x: body.x + body.fx * body.noseLen, y: body.y + body.fy * body.noseLen, z: body.z + body.fz * body.noseLen, r: body.r * 0.7 }
  return sphereHit(nose, s)
}

/** Distance from the plane centre to a sphere surface (negative = overlapping). */
export function clearance(body: PlaneBody, s: Sphere): number {
  return Math.hypot(body.x - s.x, body.y - s.y, body.z - s.z) - s.r - body.r
}

/**
 * Spatial hash on corridor distance (−z) in cells of `cell` metres. Objects are
 * inserted once; queries return the cell at d and its neighbours.
 */
export class CorridorHash<T extends Collidable> {
  private cells = new Map<number, T[]>()
  constructor(private cell = 40) {}

  key(z: number): number {
    return Math.floor(-z / this.cell)
  }

  insert(o: T): void {
    const k = this.key(o.z)
    let arr = this.cells.get(k)
    if (!arr) {
      arr = []
      this.cells.set(k, arr)
    }
    arr.push(o)
  }

  remove(o: T): void {
    const arr = this.cells.get(this.key(o.z))
    if (!arr) return
    const i = arr.indexOf(o)
    if (i >= 0) arr.splice(i, 1)
  }

  /** Visit live objects within ±`reach` metres of z. */
  near(z: number, reach: number, visit: (o: T) => void): void {
    const k0 = this.key(z + reach)
    const k1 = this.key(z - reach)
    for (let k = k0; k <= k1; k++) {
      const arr = this.cells.get(k)
      if (!arr) continue
      for (const o of arr) if (!o.dead) visit(o)
    }
  }

  /** Drop cells behind the plane (distance < d − keep). */
  prune(z: number, keep: number, onDrop?: (o: T) => void): void {
    const kmin = this.key(z + keep)
    for (const [k, arr] of this.cells) {
      if (k < kmin) {
        if (onDrop) for (const o of arr) onDrop(o)
        this.cells.delete(k)
      }
    }
  }

  clear(onDrop?: (o: T) => void): void {
    if (onDrop) for (const arr of this.cells.values()) for (const o of arr) onDrop(o)
    this.cells.clear()
  }

  get size(): number {
    let n = 0
    for (const arr of this.cells.values()) n += arr.length
    return n
  }
}

/**
 * Magnet pull: move a pickup toward the plane when within `radius`. Returns
 * true if it moved. Speed scales with closeness so coins "snap" in.
 */
export function magnetPull(o: Sphere, body: PlaneBody, radius: number, dt: number): boolean {
  const dx = body.x - o.x
  const dy = body.y - o.y
  const dz = body.z - o.z
  const d2 = dx * dx + dy * dy + dz * dz
  if (d2 > radius * radius || d2 < 1e-6) return false
  const d = Math.sqrt(d2)
  const speed = 18 + (radius - d) * 6
  const step = Math.min(d, speed * dt)
  o.x += (dx / d) * step
  o.y += (dy / d) * step
  o.z += (dz / d) * step
  return true
}

export interface CollideResult<T extends Collidable> {
  hits: T[]
  nearMisses: T[]
}

/**
 * One step of collision: hits and near-misses among objects near the plane.
 * Near-miss: within `nearMiss` radius but not hit, credited once per object,
 * and only once the plane has passed its z (so it is a real dodge).
 */
export function collideStep<T extends Collidable>(hash: CorridorHash<T>, body: PlaneBody, out: CollideResult<T>): CollideResult<T> {
  out.hits.length = 0
  out.nearMisses.length = 0
  hash.near(body.z, 30, (o) => {
    if (planeHits(body, o)) {
      out.hits.push(o)
      return
    }
    if (o.nearMiss > 0 && !o.grazed && o.z > body.z) {
      const d = Math.hypot(body.x - o.x, body.y - o.y, body.z - o.z)
      if (d <= o.nearMiss) {
        o.grazed = true
        out.nearMisses.push(o)
      }
    }
  })
  return out
}
