/**
 * Skyfling world — authored collectibles.
 *
 * Coins strung in arcs, boost-ring gates, and updraft thermals, all generated
 * deterministically along the flight corridor from distance alone (so a run is
 * repeatable and ghost-safe — no Math.random). These are what turn an empty
 * sky into a *route*: the coin arcs pull your flight path, the rings reward
 * threading them with speed, and the thermals let you claw back altitude.
 *
 * update() both detects pickups (magnet radius) and applies their effect to the
 * flight state, returning a small event summary for HUD/juice.
 */

import * as THREE from 'three'
import { bandAt, heightAt } from './terrain'
import { derivePlaneStats, uniformLevels, launch, simStep, type FlightState } from '../sim/flight'

const START_D = 120
const MAX_D = 6600

const COIN_ARC_GAP = 92 // metres between coin arcs
const COINS_PER_ARC = 6
const RING_GAP = 360 // metres between boost rings

const _up = new THREE.Vector3(0, 1, 0)

// Deterministic 1-D hash → 0..1 (stable, seeded by integer).
function h1(n: number): number {
  const s = Math.sin(n * 12.9898) * 43758.5453
  return s - Math.floor(s)
}

interface Coin {
  x: number
  y: number
  z: number
  got: boolean
}
interface Ring {
  x: number
  y: number
  z: number
  used: boolean
  mesh: THREE.Mesh
}
interface Thermal {
  x: number
  z: number
  baseY: number
  height: number
  radius: number
}

export interface CollectEvents {
  /** Coins collected this frame. */
  coins: number
  /** True on the frame you thread a boost ring. */
  ring: boolean
  /** True while riding a thermal. */
  thermal: boolean
}

export class Collectibles {
  readonly group = new THREE.Group()
  private coins: Coin[] = []
  private rings: Ring[] = []
  private thermals: Thermal[] = []
  private coinMesh: THREE.InstancedMesh
  private thermalMeshes: THREE.Mesh[] = []
  private spin = 0
  private mtx = new THREE.Matrix4()
  private q = new THREE.Quaternion()
  private v = new THREE.Vector3()
  private sc = new THREE.Vector3()

  constructor() {
    this.generate()

    // --- Coins (one instanced gold disc for the whole field) ---
    const coinGeo = new THREE.CylinderGeometry(1.5, 1.5, 0.32, 10)
    coinGeo.rotateZ(Math.PI / 2) // face lies in the YZ plane, spins about Y
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0xffcf33,
      emissive: 0xffa800,
      emissiveIntensity: 0.45,
      roughness: 0.3,
      metalness: 0.7,
    })
    this.coinMesh = new THREE.InstancedMesh(coinGeo, coinMat, this.coins.length)
    this.coinMesh.frustumCulled = false
    this.coinMesh.castShadow = false
    this.group.add(this.coinMesh)
    this.writeCoinMatrices()

    // --- Boost rings ---
    const ringGeo = new THREE.TorusGeometry(7, 0.75, 10, 28)
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x5fd3ff,
      emissive: 0x2aa8ff,
      emissiveIntensity: 0.8,
      roughness: 0.3,
      metalness: 0.4,
    })
    for (const r of this.rings) {
      const mesh = new THREE.Mesh(ringGeo, ringMat)
      mesh.position.set(r.x, r.y, r.z)
      mesh.frustumCulled = false
      r.mesh = mesh
      this.group.add(mesh)
    }

    // --- Thermals (translucent updraft columns) ---
    const thMat = new THREE.MeshBasicMaterial({
      color: 0xaef0d0,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    for (const t of this.thermals) {
      const geo = new THREE.CylinderGeometry(t.radius * 0.5, t.radius, t.height, 16, 1, true)
      const mesh = new THREE.Mesh(geo, thMat)
      mesh.position.set(t.x, t.baseY + t.height / 2, t.z)
      mesh.frustumCulled = false
      this.thermalMeshes.push(mesh)
      this.group.add(mesh)
    }
  }

  private generate(): void {
    // --- Reference flight path -------------------------------------------
    // Simulate a neutral-input flight with the real physics so coins and rings
    // land *on the line the player naturally flies*, not floating out of reach.
    // Beyond where the reference flight lands, fall back to a terrain-relative
    // height so the course keeps going for boosted/upgraded runs.
    const refStats = derivePlaneStats(uniformLevels(3))
    const rf = launch(refStats, 0.9)
    const pz: number[] = [rf.z]
    const py: number[] = [rf.y]
    for (let i = 0; i < 6000; i++) {
      simStep(rf, 1 / 60, {}, refStats)
      pz.push(rf.z)
      py.push(rf.y)
      if (-rf.z > MAX_D) break
      if (rf.y <= heightAt(rf.x, rf.z) + 1) break
    }
    const pathEnd = -pz[pz.length - 1]
    const pathYAt = (d: number): number => {
      const targetZ = -d
      if (d >= pathEnd) return heightAt(0, targetZ) + 34 // past landing → float over ground
      // pz is monotonically decreasing (more negative with distance).
      for (let i = 1; i < pz.length; i++) {
        if (pz[i] <= targetZ) {
          const t = (targetZ - pz[i - 1]) / (pz[i] - pz[i - 1] || 1)
          return py[i - 1] + (py[i] - py[i - 1]) * t
        }
      }
      return py[py.length - 1]
    }

    // Coin arcs that weave gently above/below the flight line.
    for (let d = START_D, seg = 0; d < MAX_D; d += COIN_ARC_GAP, seg++) {
      const laneX = (h1(seg * 1.7) - 0.5) * 20 // modest side-to-side wander
      const z0 = -d
      const span = 46
      const archH = 8 + h1(seg * 3.1) * 16 // how far the arc bows above the line
      const bias = (h1(seg * 5.3) - 0.5) * 16 // whole-arc vertical offset
      for (let i = 0; i < COINS_PER_ARC; i++) {
        const t = i / (COINS_PER_ARC - 1)
        const z = z0 - t * span
        const x = laneX + Math.sin(seg + t * 2) * 4
        const base = pathYAt(d + t * span)
        const y = base + bias + Math.sin(Math.PI * t) * archH
        this.coins.push({ x, y, z, got: false })
      }
    }

    // Boost rings threaded onto the flight line.
    for (let d = START_D + 180; d < MAX_D; d += RING_GAP) {
      const z = -d
      const x = (h1(d * 0.013) - 0.5) * 16
      const y = pathYAt(d) + (h1(d * 0.027) - 0.5) * 10
      this.rings.push({ x, y, z, used: false, mesh: undefined as unknown as THREE.Mesh })
    }

    // Thermals wherever a band's biome favours them.
    for (let band = 0; band * 800 < MAX_D; band++) {
      const d = band * 800 + 380
      const info = bandAt(d)
      if (info.cur.pickupBias === 'thermals' || info.cur.id === 5) {
        const x = (h1(band * 7.7) - 0.5) * 40
        const z = -d
        this.thermals.push({ x, z, baseY: heightAt(x, z), height: 95, radius: 30 })
      }
    }
  }

  private writeCoinMatrices(): void {
    for (let i = 0; i < this.coins.length; i++) {
      const c = this.coins[i]
      if (c.got) {
        this.sc.set(0, 0, 0)
      } else {
        this.sc.set(1, 1, 1)
      }
      this.q.setFromAxisAngle(_up, this.spin)
      this.v.set(c.x, c.y, c.z)
      this.mtx.compose(this.v, this.q, this.sc)
      this.coinMesh.setMatrixAt(i, this.mtx)
    }
    this.coinMesh.instanceMatrix.needsUpdate = true
  }

  /** Un-collect everything and reset rings for a fresh run. */
  reset(): void {
    for (const c of this.coins) c.got = false
    for (const r of this.rings) r.used = false
    this.spin = 0
    this.writeCoinMatrices()
  }

  /**
   * Detect + apply pickups near the plane and return what happened. Mutates
   * `fs` for ring boosts and thermal lift.
   */
  update(fs: FlightState, magnetR: number, dt: number): CollectEvents {
    const ev: CollectEvents = { coins: 0, ring: false, thermal: false }
    this.spin += dt * 3

    // Coins — only scan the window of arcs near the plane.
    const grabR = magnetR + 2.5
    const grab2 = grabR * grabR
    for (const c of this.coins) {
      if (c.got) continue
      const dz = c.z - fs.z
      if (dz > 60 || dz < -40) continue // ahead/behind window
      const dx = c.x - fs.x
      const dy = c.y - fs.y
      if (dx * dx + dy * dy + dz * dz <= grab2) {
        c.got = true
        ev.coins++
      }
    }

    // Boost rings — thread the torus for speed + a splash of nitro.
    for (const r of this.rings) {
      if (r.used) continue
      const dz = r.z - fs.z
      if (dz > 10 || dz < -14) continue
      const dx = r.x - fs.x
      const dy = r.y - fs.y
      if (dx * dx + dy * dy < 7 * 7) {
        r.used = true
        fs.s += 17
        fs.nitro = Math.min(1, fs.nitro + 0.28)
        ev.ring = true
      }
    }

    // Thermals — a gentle, continuous updraft while inside the column.
    for (const t of this.thermals) {
      const dx = t.x - fs.x
      const dz = t.z - fs.z
      if (dx * dx + dz * dz < t.radius * t.radius && fs.y > t.baseY - 10 && fs.y < t.baseY + t.height) {
        fs.a = Math.min(fs.a + 2.1 * dt, 1.15)
        fs.nitro = Math.min(1, fs.nitro + 0.12 * dt)
        ev.thermal = true
      }
    }

    this.writeCoinMatrices()
    return ev
  }

  dispose(): void {
    this.coinMesh.geometry.dispose()
    ;(this.coinMesh.material as THREE.Material).dispose()
    for (const r of this.rings) if (r.mesh) r.mesh.geometry.dispose()
    for (const m of this.thermalMeshes) m.geometry.dispose()
  }
}
