/**
 * Skyfling world — scenery + landmarks.
 *
 * Instanced props (pines, rock spires, dune cacti, city towers) scattered on
 * the terrain flanks per biome band, plus a handful of hand-placed hero
 * landmarks (windmill, lighthouse, canyon arch) that give each early zone an
 * unmistakable silhouette. All positions are deterministic (seeded by distance)
 * and sit on the real terrain surface via `heightAt`.
 *
 * Props are static instanced meshes (one draw call per category) covering the
 * demo distance, so there's nothing to update per frame. The windmill blades
 * get a lightweight spin via update().
 */

import * as THREE from 'three'
import { bandAt, heightAt } from './terrain'

const MAX_D = 6600

// Deterministic 1-D hash → 0..1.
function h(n: number): number {
  const s = Math.sin(n * 78.233) * 27183.1459
  return s - Math.floor(s)
}

interface Placement {
  x: number
  y: number
  z: number
  s: number
  color: THREE.Color
}

type Category = 'pine' | 'rock' | 'cactus' | 'tower'

export class Scenery {
  readonly group = new THREE.Group()
  private windmillBlades?: THREE.Object3D
  private meshes: THREE.InstancedMesh[] = []

  constructor() {
    const buckets: Record<Category, Placement[]> = { pine: [], rock: [], cactus: [], tower: [] }

    // Walk the corridor flanks and drop props appropriate to the biome.
    for (let d = 40; d < MAX_D; d += 12) {
      const info = bandAt(d)
      const biome = info.cur
      const side = h(d * 1.3) > 0.5 ? 1 : -1
      const x = side * (34 + h(d * 2.1) * 150)
      const z = -d - h(d * 0.7) * 10
      const y = heightAt(x, z)
      const r = h(d * 4.7)

      const cat = categoryFor(biome.id)
      if (!cat) continue
      // Density: skip some slots so fields breathe (denser in forest biomes).
      const keep = cat === 'pine' ? 0.75 : cat === 'tower' ? 0.6 : 0.5
      if (r > keep) continue

      const color = new THREE.Color(tintFor(cat, biome.groundColor, h(d * 9.1)))
      const s = 0.7 + h(d * 3.3) * (cat === 'tower' ? 2.4 : 1.6)
      buckets[cat].push({ x, y, z, s, color })
    }

    this.meshes.push(this.buildField('pine', buckets.pine))
    this.meshes.push(this.buildField('rock', buckets.rock))
    this.meshes.push(this.buildField('cactus', buckets.cactus))
    this.meshes.push(this.buildField('tower', buckets.tower))

    this.buildLandmarks()
  }

  private buildField(cat: Category, items: Placement[]): THREE.InstancedMesh {
    const geo = geometryFor(cat)
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: cat === 'tower' ? 0.2 : 0, flatShading: true })
    const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, items.length))
    mesh.castShadow = true
    mesh.receiveShadow = false
    mesh.frustumCulled = false
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    const pos = new THREE.Vector3()
    const scl = new THREE.Vector3()
    items.forEach((it, i) => {
      q.setFromAxisAngle(up, h(it.x + it.z) * Math.PI * 2)
      pos.set(it.x, it.y, it.z)
      const vstretch = cat === 'tower' ? it.s * 1.8 : it.s
      scl.set(it.s, vstretch, it.s)
      m.compose(pos, q, scl)
      mesh.setMatrixAt(i, m)
      mesh.setColorAt(i, it.color)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    if (items.length === 0) mesh.visible = false
    this.group.add(mesh)
    return mesh
  }

  // ----- Hero landmarks -----------------------------------------------------

  private buildLandmarks(): void {
    this.group.add(this.windmill(-46, 360))
    this.group.add(this.lighthouse(62, 1180))
    this.group.add(this.canyonArch(0, 2000))
  }

  private windmill(x: number, d: number): THREE.Group {
    const g = new THREE.Group()
    const z = -d
    const y = heightAt(x, z)
    const towerMat = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.9, flatShading: true })
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 4.6, 20, 10), towerMat)
    tower.position.set(x, y + 10, z)
    tower.castShadow = true
    g.add(tower)
    const capMat = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.8, flatShading: true })
    const cap = new THREE.Mesh(new THREE.ConeGeometry(4.2, 5, 10), capMat)
    cap.position.set(x, y + 22, z)
    g.add(cap)

    const blades = new THREE.Group()
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, flatShading: true })
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(2, 14, 0.5), bladeMat)
      blade.position.y = 7
      const pivot = new THREE.Group()
      pivot.add(blade)
      pivot.rotation.z = (i * Math.PI) / 2
      blades.add(pivot)
    }
    blades.position.set(x, y + 19, z + 4.8)
    g.add(blades)
    this.windmillBlades = blades
    return g
  }

  private lighthouse(x: number, d: number): THREE.Group {
    const g = new THREE.Group()
    const z = -d
    const y = Math.max(heightAt(x, z), -24)
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(3, 4.5, 26, 12),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true }),
    )
    body.position.set(x, y + 13, z)
    body.castShadow = true
    g.add(body)
    // Red bands.
    for (let i = 0; i < 3; i++) {
      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(3.4 - i * 0.4, 3.9 - i * 0.4, 3.2, 12),
        new THREE.MeshStandardMaterial({ color: 0xe8443a, roughness: 0.8, flatShading: true }),
      )
      band.position.set(x, y + 5 + i * 8, z)
      g.add(band)
    }
    const lamp = new THREE.Mesh(
      new THREE.CylinderGeometry(2.4, 2.4, 4, 10),
      new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffd23f, emissiveIntensity: 0.9, roughness: 0.3 }),
    )
    lamp.position.set(x, y + 28, z)
    g.add(lamp)
    return g
  }

  private canyonArch(x: number, d: number): THREE.Group {
    const g = new THREE.Group()
    const z = -d
    const y = heightAt(x, z)
    const mat = new THREE.MeshStandardMaterial({ color: 0xb0472f, roughness: 1, flatShading: true })
    const torus = new THREE.Mesh(new THREE.TorusGeometry(26, 7, 8, 16, Math.PI), mat)
    torus.position.set(x, y, z)
    torus.castShadow = true
    g.add(torus)
    return g
  }

  update(dt: number): void {
    if (this.windmillBlades) this.windmillBlades.rotation.z += dt * 0.9
  }

  dispose(): void {
    for (const m of this.meshes) {
      m.geometry.dispose()
      ;(m.material as THREE.Material).dispose()
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function categoryFor(biomeId: number): Category | null {
  switch (biomeId) {
    case 1: // meadow
    case 3: // coast
    case 5: // alpine
      return 'pine'
    case 2: // canyon
      return 'rock'
    case 4: // dunes
      return 'cactus'
    case 8: // neon city
      return 'tower'
    default:
      return null
  }
}

function geometryFor(cat: Category): THREE.BufferGeometry {
  switch (cat) {
    case 'pine':
      return new THREE.ConeGeometry(1.7, 6.5, 6)
    case 'rock':
      return new THREE.IcosahedronGeometry(2.6, 0)
    case 'cactus':
      return new THREE.CylinderGeometry(0.9, 1.1, 5, 7)
    case 'tower':
      return new THREE.BoxGeometry(6, 10, 6)
  }
}

function tintFor(cat: Category, groundHex: string, r: number): THREE.Color {
  const c = new THREE.Color()
  switch (cat) {
    case 'pine':
      c.setHSL(0.33, 0.45, 0.22 + r * 0.14)
      break
    case 'rock':
      c.set(groundHex).offsetHSL(0, 0, -0.05 + r * 0.1)
      break
    case 'cactus':
      c.setHSL(0.28, 0.4, 0.3 + r * 0.1)
      break
    case 'tower':
      c.setHSL(0.62, 0.3, 0.14 + r * 0.14)
      break
  }
  return c
}
