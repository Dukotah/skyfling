/**
 * Pickup and hazard visuals (ARCHITECTURE §7). Procedural `proc:` meshes
 * (rings, fuel can, thermal column, shield orb, star, golden ring, cable, ice
 * crystal, lightning, geyser) and GLB actors (coin, balloon, crate, chest,
 * birds, drone). Static pickups of the same kind in a chunk share one
 * InstancedMesh; animated hazards are individual actors.
 */

import * as THREE from 'three'
import { glowMaterial, haloMaterial } from './materials'
import { prepareActor, prepareProp, type PreparedActor } from '../assets/models'
import type { ModelId } from '../assets/loader'
import type { PickupDef, HazardDef } from '../data/define'

export interface PickupVisual {
  /** Template to instance (static pickups). */
  geometry: THREE.BufferGeometry
  material: THREE.Material | THREE.Material[]
  /** Extra halo mesh template (rings/thermals) added per group as a sprite-ish mesh. */
  halo?: THREE.Mesh
  spin: number
  bob: number
}

const cache = new Map<string, Promise<PickupVisual>>()

function torus(r: number, tube: number, color: string): THREE.Mesh {
  return new THREE.Mesh(new THREE.TorusGeometry(r, tube, 10, 36), glowMaterial(color, 1.4))
}

async function buildProc(name: string, def: Readonly<PickupDef>): Promise<PickupVisual> {
  const s = def.size
  switch (name) {
    case 'ring': {
      const g = new THREE.TorusGeometry(s / 2, s * 0.06, 10, 40)
      g.rotateY(Math.PI / 2) // ring faces the flight direction (−z); torus default faces +z
      const halo = new THREE.Mesh(new THREE.CircleGeometry(s / 2 - s * 0.08, 32).rotateY(Math.PI / 2), haloMaterial(def.glow, 0.18))
      return { geometry: g, material: glowMaterial(def.glow, 1.3), halo, spin: 0, bob: def.bob ?? 0 }
    }
    case 'goldring': {
      const g = new THREE.TorusGeometry(s / 2, s * 0.07, 10, 40)
      g.rotateY(Math.PI / 2)
      const halo = new THREE.Mesh(new THREE.CircleGeometry(s / 2 - s * 0.08, 32).rotateY(Math.PI / 2), haloMaterial('#ffd23f', 0.22))
      return { geometry: g, material: glowMaterial('#ffd23f', 1.8), halo, spin: 0, bob: 0.2 }
    }
    case 'fuelcan': {
      const body = new THREE.BoxGeometry(s * 0.6, s * 0.8, s * 0.35)
      const cap = new THREE.CylinderGeometry(s * 0.1, s * 0.1, s * 0.2, 8)
      cap.translate(s * 0.18, s * 0.5, 0)
      const handle = new THREE.TorusGeometry(s * 0.14, s * 0.03, 6, 12)
      handle.translate(-s * 0.1, s * 0.45, 0)
      const geos = [body, cap, handle]
      const merged = mergeTo(geos)
      return { geometry: merged, material: glowMaterial(def.glow, 0.7), spin: def.spin ?? 1, bob: def.bob ?? 0.3 }
    }
    case 'shield': {
      const g = new THREE.IcosahedronGeometry(s / 2, 1)
      const halo = new THREE.Mesh(new THREE.SphereGeometry(s * 0.7, 12, 8), haloMaterial(def.glow, 0.12))
      return { geometry: g, material: new THREE.MeshPhysicalMaterial({ color: def.glow, emissive: def.glow, emissiveIntensity: 0.9, roughness: 0.1, metalness: 0.1, transmission: 0.4, thickness: 1, transparent: true, opacity: 0.95 }), halo, spin: def.spin ?? 1.5, bob: def.bob ?? 0.3 }
    }
    case 'star': {
      const shape = new THREE.Shape()
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? s / 2 : s / 5
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2
        if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r)
        else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r)
      }
      shape.closePath()
      const g = new THREE.ExtrudeGeometry(shape, { depth: s * 0.18, bevelEnabled: true, bevelSize: s * 0.04, bevelThickness: s * 0.04, bevelSegments: 1 })
      g.center()
      const halo = new THREE.Mesh(new THREE.CircleGeometry(s * 0.8, 24), haloMaterial('#ffffff', 0.15))
      return { geometry: g, material: glowMaterial('#ffffff', 1.5), halo, spin: def.spin ?? 2, bob: def.bob ?? 0.3 }
    }
    case 'thermal': {
      // A translucent column with rising rings; the column itself is the visual, the sim handles lift.
      const g = new THREE.CylinderGeometry(s / 2, s / 2.4, 90, 18, 1, true)
      g.translate(0, 45, 0)
      const halo = torus(s / 2, s * 0.02, '#fff1b8')
      halo.rotation.x = Math.PI / 2
      return { geometry: g, material: new THREE.MeshBasicMaterial({ color: '#fff1b8', transparent: true, opacity: 0.045, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }), halo, spin: 0, bob: 0 }
    }
    default:
      throw new Error(`[pickups] unknown proc ${name}`)
  }
}

function mergeTo(geos: THREE.BufferGeometry[], withColor = false): THREE.BufferGeometry {
  // Small helper: merge non-indexed copies (optionally carrying a color attribute).
  const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g))
  let count = 0
  for (const g of parts) count += g.attributes.position.count
  const pos = new Float32Array(count * 3)
  const nor = new Float32Array(count * 3)
  const uv = new Float32Array(count * 2)
  const col = withColor ? new Float32Array(count * 3) : null
  let o = 0
  for (const g of parts) {
    g.computeVertexNormals()
    pos.set(g.attributes.position.array as Float32Array, o * 3)
    nor.set(g.attributes.normal.array as Float32Array, o * 3)
    if (g.attributes.uv) uv.set(g.attributes.uv.array as Float32Array, o * 2)
    if (col && g.attributes.color) col.set(g.attributes.color.array as Float32Array, o * 3)
    o += g.attributes.position.count
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  if (col) out.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return out
}

export function pickupVisual(def: Readonly<PickupDef>): Promise<PickupVisual> {
  let p = cache.get(def.id)
  if (!p) {
    if (def.model.startsWith('proc:')) p = buildProc(def.model.slice(5), def)
    else
      p = prepareProp({ id: def.id, model: def.model, height: def.size, placement: 'air', lod: 400, sink: 0, randomYaw: true, shadow: false }).then((parts) => {
        // Centre vertically for pickups (props are floor-aligned).
        const g = parts.geometry
        g.translate(0, -def.size / 2, 0)
        const mats = Array.isArray(parts.material) ? parts.material : [parts.material]
        for (const m of mats) {
          const s = m as THREE.MeshStandardMaterial
          if ('emissive' in s && def.id === 'coin') {
            s.emissive = new THREE.Color(def.glow)
            s.emissiveIntensity = 0.55
            s.metalness = 0.6
            s.roughness = 0.35
          }
        }
        return { geometry: g, material: parts.material, spin: def.spin ?? 0, bob: def.bob ?? 0 }
      })
    cache.set(def.id, p)
  }
  return p
}

// ---------------------------------------------------------------------------
// Hazards
// ---------------------------------------------------------------------------

export interface HazardVisual {
  /** Fresh object per hazard instance. */
  make(): { object: THREE.Object3D; mixer?: THREE.AnimationMixer; actions?: THREE.AnimationAction[] }
}

const hazardCache = new Map<string, Promise<HazardVisual>>()

function procHazard(name: string, def: Readonly<HazardDef>): HazardVisual {
  const s = def.size
  switch (name) {
    case 'cable': {
      // One merged mesh with baked vertex colours: cable, two pylons, four cars.
      const parts: Array<[THREE.BufferGeometry, number]> = []
      parts.push([new THREE.CylinderGeometry(0.12, 0.12, s, 6).rotateZ(Math.PI / 2), 0x2a2e33])
      for (const x of [-s / 2, s / 2]) parts.push([new THREE.CylinderGeometry(0.4, 0.7, 40, 6).translate(x, -20, 0), 0x8a8f94])
      for (let i = 0; i < 4; i++) parts.push([new THREE.BoxGeometry(1.6, 1.8, 1.4).translate(-s / 2 + (i + 0.5) * (s / 4), -1.4, 0), i % 2 ? 0xff6b4a : 0xffd23f])
      const colored = parts.map(([g, hex]) => {
        const ng = g.index ? g.toNonIndexed() : g
        const c = new THREE.Color(hex)
        const n = ng.attributes.position.count
        const arr = new Float32Array(n * 3)
        for (let k = 0; k < n; k++) { arr[k * 3] = c.r; arr[k * 3 + 1] = c.g; arr[k * 3 + 2] = c.b }
        ng.setAttribute('color', new THREE.BufferAttribute(arr, 3))
        if (!ng.attributes.uv) ng.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2))
        return ng
      })
      const merged = mergeTo(colored, true)
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.3 })
      return { make: () => ({ object: new THREE.Mesh(merged, mat) }) }
    }
    case 'icecrystal': {
      const mat = new THREE.MeshPhysicalMaterial({ color: 0xcfe9ff, roughness: 0.1, transmission: 0.6, thickness: 1.5, transparent: true, opacity: 0.95, flatShading: true })
      const parts: THREE.BufferGeometry[] = []
      for (let i = 0; i < 4; i++) {
        const g = new THREE.OctahedronGeometry(s * (0.25 + Math.random() * 0.3), 0)
        g.rotateX(Math.random() * 3)
        g.rotateY(Math.random() * 3)
        g.translate((Math.random() - 0.5) * s * 0.6, (Math.random() - 0.5) * s * 0.6, (Math.random() - 0.5) * s * 0.6)
        parts.push(g)
      }
      const merged = mergeTo(parts)
      return { make: () => ({ object: new THREE.Mesh(merged, mat) }) }
    }
    case 'lightning': {
      return {
        make: () => {
          const g = new THREE.Group()
          // Telegraph ring on the ground + bolt (hidden until it fires).
          const ring = new THREE.Mesh(new THREE.RingGeometry(3, 4.5, 32).rotateX(-Math.PI / 2), haloMaterial('#9fe3ff', 0.0))
          ring.name = 'telegraph'
          g.add(ring)
          const pts: THREE.Vector3[] = []
          let x = 0
          let z = 0
          for (let y = 0; y <= s; y += s / 10) {
            pts.push(new THREE.Vector3(x, y, z))
            x += (Math.random() - 0.5) * 6
            z += (Math.random() - 0.5) * 6
          }
          const bolt = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.5, 5, false), new THREE.MeshBasicMaterial({ color: 0xcfe9ff, transparent: true, opacity: 0 }))
          bolt.name = 'bolt'
          g.add(bolt)
          return { object: g }
        },
      }
    }
    case 'geyser': {
      return {
        make: () => {
          const g = new THREE.Group()
          const pool = new THREE.Mesh(new THREE.CircleGeometry(4, 20).rotateX(-Math.PI / 2), glowMaterial('#ff5a1a', 2.5))
          pool.name = 'telegraph'
          g.add(pool)
          const jet = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.2, s, 10, 1, true).translate(0, s / 2, 0), new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }))
          jet.name = 'bolt'
          g.add(jet)
          return { object: g }
        },
      }
    }
    default:
      throw new Error(`[pickups] unknown hazard proc ${name}`)
  }
}

export function hazardVisual(def: Readonly<HazardDef>): Promise<HazardVisual> {
  let p = hazardCache.get(def.id)
  if (!p) {
    if (def.model.startsWith('proc:')) p = Promise.resolve(procHazard(def.model.slice(5), def))
    else
      p = (async () => {
        const template: PreparedActor = await prepareActor(def.model as ModelId, def.size, 'max', '+x', false, !def.clip || def.clip === 'Fly')
        return {
          make: () => {
            const object = template.group.clone(true)
            // Clone skinned/animated hierarchy properly by re-preparing is expensive; birds/drones are few, so clone and rebuild a mixer on the clone.
            let mixer: THREE.AnimationMixer | undefined
            const actions: THREE.AnimationAction[] = []
            if (template.clips.length) {
              mixer = new THREE.AnimationMixer(object)
              for (const clip of template.clips) {
                if (!def.clip || clip.name === def.clip) {
                  const a = mixer.clipAction(clip)
                  a.play()
                  actions.push(a)
                }
              }
            }
            return { object, mixer, actions }
          },
        }
      })()
    hazardCache.set(def.id, p)
  }
  return p
}
