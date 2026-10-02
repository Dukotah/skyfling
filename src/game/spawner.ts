/**
 * Spawner: turns chunk placements into live pickups and hazards — instanced
 * visuals per (chunk, kind), collision objects in the corridor hash, magnet
 * pull, bob/spin animation, bird/drone movement, lightning/geyser telegraph
 * cycles. Emits nothing itself; the game interprets hits.
 */

import * as THREE from 'three'
import { CorridorHash, type Collidable } from '../sim/collide'
import type { ChunkContent } from '../world/placement'
import { PICKUPS, HAZARDS } from '../data/registry'
import type { PickupDef, HazardDef } from '../data/define'
import { pickupVisual, hazardVisual, type PickupVisual } from '../render/pickups'

export interface LivePickup extends Collidable {
  def: Readonly<PickupDef>
  mesh: THREE.InstancedMesh
  index: number
  baseY: number
  phase: number
  group: number
  halos?: THREE.InstancedMesh
}

export interface LiveHazard extends Collidable {
  def: Readonly<HazardDef>
  object: THREE.Object3D
  mixer?: THREE.AnimationMixer
  dir: number
  x0: number
  /** Telegraph cycle time for lightning/geysers. */
  cycle: number
  /** True while dangerous (lightning bolt / geyser jet active). Static hazards are always active. */
  active: boolean
}

const M = new THREE.Matrix4()
const Q = new THREE.Quaternion()
const P = new THREE.Vector3()
const S = new THREE.Vector3()
const Y = new THREE.Vector3(0, 1, 0)

export class Spawner {
  group = new THREE.Group()
  hash = new CorridorHash<LivePickup | LiveHazard>(40)
  private byChunk = new Map<number, { meshes: THREE.Object3D[]; objs: Array<LivePickup | LiveHazard> }>()
  private nextId = 1
  private t = 0
  /** Luck multiplier (rare spawn) is applied in placement; this is for runtime only. */

  reset(): void {
    for (const c of this.byChunk.values()) for (const m of c.meshes) this.group.remove(m)
    this.byChunk.clear()
    this.hash.clear()
  }

  async addChunk(content: ChunkContent): Promise<void> {
    if (this.byChunk.has(content.index)) return
    const entry = { meshes: [] as THREE.Object3D[], objs: [] as Array<LivePickup | LiveHazard> }
    this.byChunk.set(content.index, entry)
    // Pickups grouped by id.
    const byId = new Map<string, typeof content.pickups>()
    for (const p of content.pickups) {
      const arr = byId.get(p.pickup) ?? []
      arr.push(p)
      byId.set(p.pickup, arr)
    }
    for (const [id, list] of byId) {
      const def = PICKUPS.get(id)
      if (!def) continue
      let vis: PickupVisual
      try {
        vis = await pickupVisual(def)
      } catch (e) {
        console.warn('[spawner] pickup visual failed', id, e)
        continue
      }
      if (!this.byChunk.has(content.index)) return // dropped while loading
      const mesh = new THREE.InstancedMesh(vis.geometry, vis.material, list.length)
      mesh.frustumCulled = false
      mesh.castShadow = false
      this.group.add(mesh)
      entry.meshes.push(mesh)
      let halos: THREE.InstancedMesh | null = null
      if (vis.halo) {
        halos = new THREE.InstancedMesh(vis.halo.geometry, vis.halo.material, list.length)
        halos.frustumCulled = false
        this.group.add(halos)
        entry.meshes.push(halos)
      }
      list.forEach((pl, i) => {
        const obj: LivePickup = { id: this.nextId++, kind: id, x: pl.x, y: pl.y, z: pl.z, r: def.radius, nearMiss: 0, dead: false, grazed: false, def, mesh, index: i, baseY: pl.y, phase: Math.random() * 6.28, group: pl.group, halos: halos ?? undefined }
        this.writeMatrix(obj, 0)
        entry.objs.push(obj)
        if (def.id !== 'thermal') this.hash.insert(obj)
      })
      mesh.instanceMatrix.needsUpdate = true
      if (halos) halos.instanceMatrix.needsUpdate = true
    }
    // Hazards: individual actors.
    for (const hz of content.hazards) {
      const def = HAZARDS.get(hz.hazard)
      if (!def) continue
      try {
        const vis = await hazardVisual(def)
        if (!this.byChunk.has(content.index)) return
        const made = vis.make()
        made.object.traverse((o) => { o.castShadow = false; o.receiveShadow = false })
        made.object.position.set(hz.x, hz.y, hz.z)
        if (def.moveSpeed) made.object.rotation.y = hz.dir > 0 ? 0 : Math.PI
        this.group.add(made.object)
        entry.meshes.push(made.object)
        const obj: LiveHazard = { id: this.nextId++, kind: def.id, x: hz.x, y: hz.y, z: hz.z, r: def.radius, nearMiss: def.nearMiss, dead: false, grazed: false, def, object: made.object, mixer: made.mixer, dir: hz.dir, x0: hz.x, cycle: Math.random() * 4, active: !def.telegraph }
        entry.objs.push(obj)
        this.hash.insert(obj)
      } catch (e) {
        console.warn('[spawner] hazard visual failed', def.id, e)
      }
    }
  }

  dropChunk(index: number): void {
    const entry = this.byChunk.get(index)
    if (!entry) return
    for (const m of entry.meshes) {
      this.group.remove(m)
      if ((m as THREE.InstancedMesh).isInstancedMesh) (m as THREE.InstancedMesh).dispose()
    }
    for (const o of entry.objs) this.hash.remove(o)
    this.byChunk.delete(index)
  }

  private writeMatrix(o: LivePickup, t: number): void {
    const vis = o.def
    const bob = (vis.bob ?? 0) * Math.sin(t * 2 + o.phase)
    P.set(o.x, o.dead ? -9999 : o.y + bob, o.z)
    Q.setFromAxisAngle(Y, (vis.spin ?? 0) * t + o.phase)
    S.setScalar(o.dead ? 0.0001 : 1)
    M.compose(P, Q, S)
    o.mesh.setMatrixAt(o.index, M)
    if (o.halos) {
      // Halos keep the ring's facing but not the spin, and never bob out of sync.
      Q.identity()
      M.compose(P, Q, S)
      o.halos.setMatrixAt(o.index, M)
      o.halos.instanceMatrix.needsUpdate = true
    }
  }

  /** Consume a pickup: hide instance and mark dead. */
  consume(o: LivePickup): void {
    o.dead = true
    this.writeMatrix(o, this.t)
    o.mesh.instanceMatrix.needsUpdate = true
  }

  /** Per-frame animation. `planeZ` limits work to nearby chunks. */
  update(dt: number, planeZ: number): void {
    this.t += dt
    for (const [, entry] of this.byChunk) {
      for (const o of entry.objs) {
        if ('mesh' in o) {
          if (o.dead) continue
          if (Math.abs(o.z - planeZ) > 500) continue
          this.writeMatrix(o, this.t)
          o.mesh.instanceMatrix.needsUpdate = true
        } else {
          const h = o
          const far = Math.abs(h.z - planeZ) > 450
          h.object.visible = !far
          if (far) continue
          h.mixer?.update(dt)
          if (h.def.moveSpeed) {
            h.x += h.dir * h.def.moveSpeed * dt
            if (Math.abs(h.x - h.x0) > 70) {
              h.dir *= -1
              h.object.rotation.y = h.dir > 0 ? 0 : Math.PI
            }
            h.object.position.x = h.x
            h.object.position.y = h.y + Math.sin(this.t * 1.5 + h.id) * 0.8
          }
          if (h.def.telegraph) {
            // Cycle: idle → telegraph → strike.
            const period = h.def.id === 'lightning' ? 4.5 : 3.2
            const tele = h.def.telegraph
            const strike = h.def.id === 'lightning' ? 0.35 : 1.1
            h.cycle = (h.cycle + dt) % period
            const inTele = h.cycle > period - tele - strike && h.cycle <= period - strike
            const inStrike = h.cycle > period - strike
            h.active = inStrike
            const telegraph = h.object.getObjectByName('telegraph') as THREE.Mesh | undefined
            const bolt = h.object.getObjectByName('bolt') as THREE.Mesh | undefined
            if (telegraph) (telegraph.material as THREE.MeshBasicMaterial).opacity = inTele ? 0.6 + 0.4 * Math.sin(this.t * 20) : inStrike ? 0.9 : h.def.id === 'geyser' ? 0.5 : 0
            if (bolt) {
              const bm = bolt.material as THREE.MeshBasicMaterial
              bm.opacity = inStrike ? (h.def.id === 'lightning' ? 0.95 : 0.6) : 0
              bolt.visible = inStrike
            }
          }
        }
      }
    }
  }

  /** Thermals near a point (for the game to emit 'thermal' and particles). */
  thermalsNear(x: number, z: number, r = 12): LivePickup[] {
    const out: LivePickup[] = []
    for (const entry of this.byChunk.values()) for (const o of entry.objs) if ('mesh' in o && o.def.id === 'thermal' && Math.hypot(o.x - x, o.z - z) < r) out.push(o)
    return out
  }
}
