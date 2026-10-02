/**
 * Procedural landmark props (ARCHITECTURE §2: `proc:<builder>` models). Each
 * builder returns PropParts in the same normalised space as GLB props
 * (centred x/z, floor at y=0, height = 1 so the instancer scales by def.height).
 * Materials are flat-shaded MeshStandard so they sit beside the packs.
 */

import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { PropParts } from '../assets/models'

type Builder = () => PropParts

const mat = (color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.02, flatShading: true, ...opts })

const PROC_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.02, flatShading: true })
const PROC_EMISSIVE = new THREE.MeshBasicMaterial({ vertexColors: true })

function finish(geos: THREE.BufferGeometry[], mats: THREE.Material[], spin?: PropParts['spin']): PropParts {
  // Bake material colours into vertex colours; emissive parts go in a second (unlit, bright) group.
  const lit: THREE.BufferGeometry[] = []
  const glow: THREE.BufferGeometry[] = []
  geos.forEach((g0, i) => {
    const g = g0.index ? g0.toNonIndexed() : g0
    const m = (mats[i] ?? mats[mats.length - 1]) as THREE.MeshStandardMaterial
    const isGlow = !!m.emissive && m.emissive.r + m.emissive.g + m.emissive.b > 0.1
    const c = isGlow ? m.emissive.clone().multiplyScalar(Math.max(1.6, m.emissiveIntensity || 1)) : m.color.clone()
    const n = g.attributes.position.count
    const arr = new Float32Array(n * 3)
    for (let k = 0; k < n; k++) { arr[k * 3] = c.r; arr[k * 3 + 1] = c.g; arr[k * 3 + 2] = c.b }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
    for (const key of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(key)) g.deleteAttribute(key)
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2))
    ;(isGlow ? glow : lit).push(g)
  })
  const groups: THREE.BufferGeometry[] = []
  const groupMats: THREE.Material[] = []
  if (lit.length) { groups.push(mergeGeometries(lit, false)!); groupMats.push(PROC_MAT) }
  if (glow.length) { groups.push(mergeGeometries(glow, false)!); groupMats.push(PROC_EMISSIVE) }
  const merged = groups.length === 1 ? groups[0] : mergeGeometries(groups, true)!
  merged.computeBoundingBox()
  const bb = merged.boundingBox!
  const h = bb.max.y - bb.min.y
  const cx = (bb.min.x + bb.max.x) / 2
  const cz = (bb.min.z + bb.max.z) / 2
  merged.translate(-cx, -bb.min.y, -cz)
  merged.scale(1 / h, 1 / h, 1 / h)
  merged.computeVertexNormals()
  if (spin) {
    spin.geometry.scale(1 / h, 1 / h, 1 / h)
    spin.pivot.sub(new THREE.Vector3(cx, bb.min.y, cz)).multiplyScalar(1 / h)
  }
  let tris = 0
  for (const g of geos) tris += (g.index ? g.index.count : g.attributes.position.count) / 3
  return { geometry: merged, material: groupMats.length === 1 ? groupMats[0] : groupMats, spin, box: new THREE.Box3().setFromBufferAttribute(merged.attributes.position as THREE.BufferAttribute), tris: Math.round(tris) }
}

function at(g: THREE.BufferGeometry, x: number, y: number, z: number, ry = 0): THREE.BufferGeometry {
  if (ry) g.rotateY(ry)
  g.translate(x, y, z)
  return g
}

const builders: Record<string, Builder> = {
  pyramid: () => {
    const g = new THREE.ConeGeometry(1, 1.1, 4, 1)
    g.rotateY(Math.PI / 4)
    g.translate(0, 0.55, 0)
    const cap = new THREE.ConeGeometry(0.12, 0.14, 4, 1)
    cap.rotateY(Math.PI / 4)
    cap.translate(0, 1.1, 0)
    return finish([g, cap], [mat(0xe0b878), mat(0xffd27a, { metalness: 0.6, roughness: 0.3 })])
  },
  obelisk: () => {
    const base = new THREE.BoxGeometry(0.5, 0.15, 0.5)
    base.translate(0, 0.075, 0)
    const shaft = new THREE.CylinderGeometry(0.1, 0.17, 1.6, 4)
    shaft.rotateY(Math.PI / 4)
    shaft.translate(0, 0.95, 0)
    const tip = new THREE.ConeGeometry(0.1, 0.22, 4)
    tip.rotateY(Math.PI / 4)
    tip.translate(0, 1.86, 0)
    return finish([base, shaft, tip], [mat(0xcfae70), mat(0xd9ba7c), mat(0xffd27a, { metalness: 0.6, roughness: 0.3 })])
  },
  lighthouse: () => {
    const base = new THREE.CylinderGeometry(0.42, 0.5, 0.3, 12)
    base.translate(0, 0.15, 0)
    const tower = new THREE.CylinderGeometry(0.22, 0.32, 1.9, 12)
    tower.translate(0, 1.25, 0)
    const bandA = new THREE.CylinderGeometry(0.31, 0.33, 0.3, 12)
    bandA.translate(0, 0.9, 0)
    const bandB = new THREE.CylinderGeometry(0.25, 0.28, 0.3, 12)
    bandB.translate(0, 1.6, 0)
    const gallery = new THREE.CylinderGeometry(0.3, 0.3, 0.08, 12)
    gallery.translate(0, 2.22, 0)
    const lamp = new THREE.CylinderGeometry(0.17, 0.17, 0.3, 10)
    lamp.translate(0, 2.4, 0)
    const roof = new THREE.ConeGeometry(0.24, 0.3, 10)
    roof.translate(0, 2.7, 0)
    return finish([base, tower, bandA, bandB, gallery, lamp, roof], [mat(0x8a8f94), mat(0xf3ecdf), mat(0xff6b4a), mat(0xff6b4a), mat(0x3a3f44), mat(0xfff1b8, { emissive: 0xfff1b8, emissiveIntensity: 2.2, flatShading: false }), mat(0x1f2a44)])
  },
  pier: () => {
    const deck = new THREE.BoxGeometry(0.6, 0.08, 4)
    deck.translate(0, 0.9, 0)
    const geos: THREE.BufferGeometry[] = [deck]
    for (let i = 0; i < 5; i++) for (const sx of [-0.25, 0.25]) {
      const post = new THREE.CylinderGeometry(0.05, 0.05, 1, 6)
      post.translate(sx, 0.45, -1.8 + i * 0.9)
      geos.push(post)
    }
    const hut = new THREE.BoxGeometry(0.5, 0.45, 0.6)
    hut.translate(0, 1.16, -1.5)
    const roof = new THREE.ConeGeometry(0.45, 0.3, 4)
    roof.rotateY(Math.PI / 4)
    roof.translate(0, 1.53, -1.5)
    geos.push(hut, roof)
    return finish(geos, [mat(0xb98a5a), ...Array(10).fill(mat(0x8a6a4a)), mat(0xf3ecdf), mat(0xff6b4a)])
  },
  icespike: () => {
    const geos: THREE.BufferGeometry[] = []
    const n = 5
    for (let i = 0; i < n; i++) {
      const h = 0.5 + Math.random() * 0.9
      const g = new THREE.ConeGeometry(0.12 + Math.random() * 0.1, h, 5)
      g.translate((Math.random() - 0.5) * 0.5, h / 2, (Math.random() - 0.5) * 0.5)
      g.rotateZ((Math.random() - 0.5) * 0.3)
      geos.push(g)
    }
    return finish(geos, [new THREE.MeshPhysicalMaterial({ color: 0xcfe9ff, roughness: 0.15, metalness: 0, transmission: 0.5, thickness: 1, flatShading: true, transparent: true, opacity: 0.95 })])
  },
  volcano: () => {
    const cone = new THREE.CylinderGeometry(0.28, 1.0, 1, 10, 1, true)
    cone.translate(0, 0.5, 0)
    const rim = new THREE.CylinderGeometry(0.3, 0.3, 0.04, 10)
    rim.translate(0, 1, 0)
    const lava = new THREE.CircleGeometry(0.26, 10)
    lava.rotateX(-Math.PI / 2)
    lava.translate(0, 0.98, 0)
    return finish([cone, rim, lava], [mat(0x3a302c), mat(0x2a2220), mat(0xff5a1a, { emissive: 0xff4a0a, emissiveIntensity: 3, flatShading: false })])
  },
  billboard: () => {
    const post = new THREE.CylinderGeometry(0.05, 0.06, 1.2, 6)
    post.translate(0, 0.6, 0)
    const board = new THREE.BoxGeometry(1.4, 0.7, 0.06)
    board.translate(0, 1.55, 0)
    const screen = new THREE.PlaneGeometry(1.3, 0.6)
    screen.translate(0, 1.55, 0.035)
    return finish([post, board, screen], [mat(0x3a3f44), mat(0x1f2a44), mat(0x5fd3b5, { emissive: 0x5fd3b5, emissiveIntensity: 1.8, flatShading: false })])
  },
  blimp: () => {
    const body = new THREE.SphereGeometry(0.5, 14, 10)
    body.scale(1, 1, 2.2)
    body.translate(0, 0.9, 0)
    const gondola = new THREE.BoxGeometry(0.3, 0.16, 0.6)
    gondola.translate(0, 0.35, 0)
    const finV = new THREE.BoxGeometry(0.04, 0.5, 0.4)
    finV.translate(0, 1.2, -1.0)
    const finH = new THREE.BoxGeometry(0.9, 0.04, 0.4)
    finH.translate(0, 0.9, -1.0)
    return finish([body, gondola, finV, finH], [mat(0xf3ecdf, { flatShading: false, roughness: 0.5 }), mat(0x1f2a44), mat(0xff6b4a), mat(0xff6b4a)])
  },
  island: () => {
    const top = new THREE.CylinderGeometry(1, 0.85, 0.25, 9)
    top.translate(0, 0.9, 0)
    const rock = new THREE.ConeGeometry(0.85, 0.9, 9)
    rock.rotateX(Math.PI)
    rock.translate(0, 0.33, 0)
    const grass = new THREE.CylinderGeometry(1.0, 1.0, 0.06, 9)
    grass.translate(0, 1.03, 0)
    const tree = new THREE.ConeGeometry(0.2, 0.5, 6)
    tree.translate(0.3, 1.3, 0.1)
    const trunk = new THREE.CylinderGeometry(0.04, 0.05, 0.2, 5)
    trunk.translate(0.3, 1.1, 0.1)
    return finish([top, rock, grass, tree, trunk], [mat(0x8a7a66), mat(0x6e6256), mat(0x7fc06a), mat(0x3f8f5a), mat(0x7a5a3a)])
  },
  temple: () => {
    const geos: THREE.BufferGeometry[] = []
    const mats: THREE.Material[] = []
    const stone = mat(0x8e9a7c)
    const moss = mat(0x5f8f4a)
    for (let i = 0; i < 4; i++) {
      const w = 2.4 - i * 0.5
      const g = new THREE.BoxGeometry(w, 0.3, w)
      g.translate(0, 0.15 + i * 0.3, 0)
      geos.push(g)
      mats.push(i % 2 ? moss : stone)
    }
    const shrine = new THREE.BoxGeometry(0.5, 0.45, 0.5)
    shrine.translate(0, 1.42, 0)
    geos.push(shrine)
    mats.push(stone)
    const roof = new THREE.ConeGeometry(0.45, 0.35, 4)
    roof.rotateY(Math.PI / 4)
    roof.translate(0, 1.82, 0)
    geos.push(roof)
    mats.push(mat(0xffd27a, { metalness: 0.5, roughness: 0.35 }))
    return finish(geos, mats)
  },
  lightningrod: () => {
    const base = new THREE.CylinderGeometry(0.3, 0.4, 0.2, 8)
    base.translate(0, 0.1, 0)
    const mast = new THREE.CylinderGeometry(0.04, 0.09, 2.2, 6)
    mast.translate(0, 1.3, 0)
    const ring = new THREE.TorusGeometry(0.25, 0.03, 6, 16)
    ring.rotateX(Math.PI / 2)
    ring.translate(0, 1.9, 0)
    const tip = new THREE.SphereGeometry(0.1, 8, 6)
    tip.translate(0, 2.45, 0)
    return finish([base, mast, ring, tip], [mat(0x3a3f44), mat(0x9aa3ad, { metalness: 0.8, roughness: 0.3 }), mat(0x9aa3ad, { metalness: 0.8, roughness: 0.3 }), mat(0x9fe3ff, { emissive: 0x9fe3ff, emissiveIntensity: 2.5, flatShading: false })])
  },
  satellite: () => {
    const body = new THREE.BoxGeometry(0.5, 0.5, 0.7)
    body.translate(0, 0.5, 0)
    const panelL = new THREE.BoxGeometry(1.4, 0.03, 0.5)
    panelL.translate(-1.0, 0.5, 0)
    const panelR = new THREE.BoxGeometry(1.4, 0.03, 0.5)
    panelR.translate(1.0, 0.5, 0)
    const dish = new THREE.SphereGeometry(0.28, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2.2)
    dish.rotateX(Math.PI)
    dish.translate(0, 0.95, 0)
    return finish([body, panelL, panelR, dish], [mat(0xcfd4dc, { metalness: 0.8, roughness: 0.3 }), mat(0x1f4a9a, { metalness: 0.4, roughness: 0.25 }), mat(0x1f4a9a, { metalness: 0.4, roughness: 0.25 }), mat(0xf3ecdf)])
  },
  arch: () => {
    // Fly-through canyon arch: two piers and a lintel with chunky rock faces.
    const left = new THREE.BoxGeometry(0.5, 1.6, 0.6)
    left.translate(-0.9, 0.8, 0)
    const right = new THREE.BoxGeometry(0.5, 1.6, 0.6)
    right.translate(0.9, 0.8, 0)
    const lintel = new THREE.BoxGeometry(2.4, 0.45, 0.7)
    lintel.translate(0, 1.8, 0)
    const cap = new THREE.ConeGeometry(0.4, 0.4, 5)
    cap.translate(0.5, 2.2, 0.05)
    return finish([left, right, lintel, cap], [mat(0xb0623a), mat(0xb0623a), mat(0xc07048), mat(0x9c4a2e)])
  },
  dart: () => {
    // Fallback-only; the Paper Dart plane has its own builder.
    const g = new THREE.ConeGeometry(0.3, 1, 3)
    g.rotateZ(-Math.PI / 2)
    g.translate(0, 0.3, 0)
    return finish([g], [mat(0xf3ecdf)])
  },
}

const cache = new Map<string, PropParts>()

export function buildProcProp(name: string): PropParts {
  let p = cache.get(name)
  if (!p) {
    const b = builders[name]
    if (!b) throw new Error(`[procprops] unknown builder ${name}`)
    p = b()
    cache.set(name, p)
  }
  return p
}

export function hasProcProp(name: string): boolean {
  return name in builders
}

export { at }
