/**
 * WorldView (ARCHITECTURE §6/§7): streams chunks around the player — terrain
 * meshes, instanced props (GLB or procedural), and hands pickup/hazard
 * placements to the game's spawner. Keeps 6 chunks ahead and 2 behind, builds
 * at most one chunk per frame so the frame budget holds.
 */

import * as THREE from 'three'
import type { World } from '../world/world'
import type { ChunkContent, PropPlacement } from '../world/placement'
import { CHUNK_LENGTH } from '../world/placement'
import { buildChunkGeometry } from './terrain'
import { buildBatch, updateSpin, disposeBatch, type PropBatch } from './instancer'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { prepareProp, type PropParts } from '../assets/models'
import { buildProcProp } from './procprops'
import type { PropDef } from '../data/define'
import type { QualitySettings } from './renderer'

interface LiveChunk {
  index: number
  content: ChunkContent
  terrain: THREE.Mesh
  batches: PropBatch[]
  /** Static props merged per material: one mesh per material per chunk. */
  merged: Array<{ mesh: THREE.Mesh; lod: number; shadow: boolean }>
  group: THREE.Group
  /** Props still loading (GLBs) that will be added when ready. */
  pending: number
  disposed: boolean
  /** Per-material accumulators while props load. */
  acc: Map<THREE.Material, { geos: THREE.BufferGeometry[]; lod: number; shadow: boolean }>
  flushTimer: number
}

const TMP_M = new THREE.Matrix4()
const TMP_Q = new THREE.Quaternion()
const TMP_P = new THREE.Vector3()
const TMP_S = new THREE.Vector3()
const Y_AXIS = new THREE.Vector3(0, 1, 0)

/** Split a multi-material geometry into one geometry per group. */
function splitGroups(geo: THREE.BufferGeometry, material: THREE.Material | THREE.Material[]): Array<[THREE.BufferGeometry, THREE.Material]> {
  if (!Array.isArray(material) || geo.groups.length === 0) return [[geo, Array.isArray(material) ? material[0] : material]]
  const out: Array<[THREE.BufferGeometry, THREE.Material]> = []
  const src = geo.index ? geo.toNonIndexed() : geo
  for (const g of src.groups) {
    const part = new THREE.BufferGeometry()
    for (const name of Object.keys(src.attributes)) {
      const a = src.attributes[name] as THREE.BufferAttribute
      const arr = (a.array as Float32Array).slice(g.start * a.itemSize, (g.start + g.count) * a.itemSize)
      part.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize))
    }
    out.push([part, material[g.materialIndex ?? 0]])
  }
  return out
}

export const AHEAD = 3
export const BEHIND = 1

export class WorldView {
  group = new THREE.Group()
  private live = new Map<number, LiveChunk>()
  private partsCache = new Map<string, Promise<PropParts>>()
  private buildQueue: number[] = []
  private t = 0
  /** Called when a chunk's content becomes live (the game spawns its pickups/hazards). */
  onChunkLive: ((c: ChunkContent) => void) | null = null
  onChunkDrop: ((c: ChunkContent) => void) | null = null
  tris = 0

  constructor(private world: World, private terrainMaterial: THREE.Material, private props: Map<string, Readonly<PropDef>>, private quality: QualitySettings) {}

  setQuality(q: QualitySettings): void {
    this.quality = q
  }

  reset(): void {
    for (const c of this.live.values()) this.dropChunk(c)
    this.live.clear()
    this.buildQueue.length = 0
  }

  /** Ensure chunks around z exist; call every frame. */
  update(dt: number, z: number, camPos: THREE.Vector3): void {
    this.t += dt
    const cur = this.world.chunkIndexAt(z)
    const lo = Math.max(0, cur - BEHIND)
    const hi = cur + AHEAD
    for (let i = lo; i <= hi; i++) if (!this.live.has(i) && !this.buildQueue.includes(i)) this.buildQueue.push(i)
    for (const [i, c] of this.live) if (i < lo || i > hi + 2) { this.dropChunk(c); this.live.delete(i) }
    this.world.prune(lo)
    // One chunk per frame.
    const next = this.buildQueue.shift()
    if (next !== undefined && !this.live.has(next)) this.buildChunk(next)
    // Spin + per-prop LOD visibility.
    for (const c of this.live.values()) {
      const dz = Math.abs(camPos.z - (c.content.z0 - CHUNK_LENGTH / 2))
      for (const m of c.merged) {
        m.mesh.visible = dz < m.lod * this.quality.propLodScale
        m.mesh.castShadow = m.shadow && dz < 260
      }
      for (const b of c.batches) {
        const vis = dz < b.lod * this.quality.propLodScale
        if (b.spin) {
          b.spin.mesh.visible = vis
          b.spin.mesh.castShadow = b.shadow && dz < 260
          if (vis) updateSpin(b.spin, this.t)
        }
      }
    }
  }

  private parts(def: Readonly<PropDef>): Promise<PropParts> {
    let p = this.partsCache.get(def.id)
    if (!p) {
      p = def.model.startsWith('proc:') ? Promise.resolve(buildProcProp(def.model.slice(5))) : prepareProp(def)
      this.partsCache.set(def.id, p)
    }
    return p
  }

  private buildChunk(index: number): void {
    const content = this.world.chunk(index)
    const geo = buildChunkGeometry(this.world.terrain, index)
    const terrain = new THREE.Mesh(geo, this.terrainMaterial)
    terrain.receiveShadow = true
    terrain.castShadow = false
    const group = new THREE.Group()
    group.add(terrain)
    this.group.add(group)
    const chunk: LiveChunk = { index, content, terrain, batches: [], merged: [], group, pending: 0, disposed: false, acc: new Map(), flushTimer: 0 }
    this.live.set(index, chunk)
    // Group placements by prop.
    const byProp = new Map<string, PropPlacement[]>()
    for (const p of content.props) {
      const arr = byProp.get(p.prop) ?? []
      arr.push(p)
      byProp.set(p.prop, arr)
    }
    for (const [propId, placements] of byProp) {
      const def = this.props.get(propId)
      if (!def) continue
      chunk.pending++
      this.parts(def)
        .then((parts) => {
          if (chunk.disposed) return
          const shadow = def.shadow !== false && this.quality.shadows
          // Static part: bake every placement into per-material accumulators (merged below).
          if (parts.geometry.attributes.position) {
            for (const [geo, mat] of splitGroups(parts.geometry, parts.material)) {
              const slot = chunk.acc.get(mat) ?? { geos: [], lod: 0, shadow: false }
              for (const pl of placements) {
                TMP_P.set(pl.x, pl.y, pl.z)
                TMP_Q.setFromAxisAngle(Y_AXIS, pl.yaw)
                TMP_S.setScalar(pl.scale)
                TMP_M.compose(TMP_P, TMP_Q, TMP_S)
                const g = geo.clone()
                g.applyMatrix4(TMP_M)
                slot.geos.push(g)
              }
              slot.lod = Math.max(slot.lod, def.lod)
              slot.shadow = slot.shadow || shadow
              chunk.acc.set(mat, slot)
            }
            this.tris += parts.tris * placements.length
          }
          // Spinning parts stay instanced (their matrices change every frame).
          if (parts.spin) {
            const batch = buildBatch({ ...parts, geometry: new THREE.BufferGeometry() }, placements, def.lod, shadow)
            chunk.group.remove(batch.statics)
            batch.statics.visible = false
            chunk.batches.push(batch)
            if (batch.spin) chunk.group.add(batch.spin.mesh)
          }
        })
        .catch((err) => console.warn('[worldview] prop failed', propId, err))
        .finally(() => {
          chunk.pending--
          if (chunk.pending === 0) this.flush(chunk)
        })
    }
    this.onChunkLive?.(content)
  }

  /** Merge accumulated per-material geometry into one mesh each. */
  private flush(chunk: LiveChunk): void {
    if (chunk.disposed) return
    for (const [mat, slot] of chunk.acc) {
      if (!slot.geos.length) continue
      const geo = mergeGeometries(slot.geos, false)
      for (const g of slot.geos) g.dispose()
      if (!geo) continue
      geo.computeBoundingSphere()
      const mesh = new THREE.Mesh(geo, mat)
      mesh.receiveShadow = true
      mesh.castShadow = false
      chunk.group.add(mesh)
      chunk.merged.push({ mesh, lod: slot.lod, shadow: slot.shadow })
    }
    chunk.acc.clear()
  }

  private dropChunk(c: LiveChunk): void {
    c.disposed = true
    this.group.remove(c.group)
    c.terrain.geometry.dispose()
    for (const b of c.batches) disposeBatch(b)
    for (const m of c.merged) {
      m.mesh.geometry.dispose()
      this.tris -= (m.mesh.geometry.index ? m.mesh.geometry.index.count : m.mesh.geometry.attributes.position?.count ?? 0) / 3
    }
    for (const slot of c.acc.values()) for (const g of slot.geos) g.dispose()
    this.onChunkDrop?.(c.content)
  }

  get liveCount(): number {
    return this.live.size
  }
}
