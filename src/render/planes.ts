/**
 * Plane roster rendering (ARCHITECTURE §7): GLB planes with paint tint, and
 * procedural tiers built from lathe fuselages, swept wings and shared
 * paint-slot materials. Every plane is a Group with local +X as the nose and
 * optional named parts: `prop` (spins with speed), `burners` (afterburner
 * cones), `tips` (contrail anchors).
 */

import * as THREE from 'three'
import { makePaintSet, tintTextured, type PaintSet } from './materials'
import { prepareActor } from '../assets/models'
import type { ModelId } from '../assets/loader'
import type { PlaneDef, PaintDef } from '../data/define'

export interface PlaneRig {
  group: THREE.Group
  def: Readonly<PlaneDef>
  prop: THREE.Object3D | null
  burners: THREE.Mesh[]
  tips: THREE.Vector3[]
  /** Length in metres (for camera/body radius). */
  length: number
  /** Simple morph for the Paper Dart crumple (0..1). */
  setDamage?(d: number): void
  mixer?: THREE.AnimationMixer
}

const BURNER_VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
const BURNER_FRAG = /* glsl */ `
  uniform float uTime; uniform float uPower; uniform vec3 uColor; varying vec2 vUv;
  float n(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
  void main(){
    float flick = n(vec2(floor(uTime * 40.0), vUv.x * 8.0)) * 0.3 + 0.7;
    float core = smoothstep(1.0, 0.0, vUv.y) * flick;
    vec3 col = mix(uColor, vec3(1.0, 0.95, 0.8), pow(core, 3.0));
    float a = core * uPower * (1.0 - smoothstep(0.75, 1.0, vUv.y));
    gl_FragColor = vec4(col * (1.0 + core * 2.0), a);
  }`

export function makeBurner(radius: number): THREE.Mesh {
  const g = new THREE.ConeGeometry(radius, radius * 5, 12, 1, true)
  g.rotateZ(Math.PI / 2) // point along -X (behind the plane)
  g.translate(-radius * 2.5, 0, 0)
  const m = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uPower: { value: 0 }, uColor: { value: new THREE.Color(0xff8a3c) } }, vertexShader: BURNER_VERT, fragmentShader: BURNER_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
  const mesh = new THREE.Mesh(g, m)
  mesh.name = 'burner'
  return mesh
}

export function setBurner(mesh: THREE.Mesh, power: number, t: number): void {
  const m = mesh.material as THREE.ShaderMaterial
  m.uniforms.uPower.value = power
  m.uniforms.uTime.value = t
  mesh.visible = power > 0.01
  mesh.scale.set(0.6 + power * 0.8, 0.7 + power * 0.5, 0.7 + power * 0.5)
}

/** Spinning prop: a thin cross plus a translucent disc that fades in with speed. */
export function makePropDisc(radius: number, mats: PaintSet): THREE.Group {
  const g = new THREE.Group()
  const blade = new THREE.BoxGeometry(0.06, radius * 2, radius * 0.16)
  g.add(new THREE.Mesh(blade, mats.dark))
  const blade2 = blade.clone().rotateX(Math.PI / 2)
  g.add(new THREE.Mesh(blade2, mats.dark))
  const disc = new THREE.Mesh(new THREE.CircleGeometry(radius, 24).rotateY(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide }))
  disc.name = 'disc'
  g.add(disc)
  const hub = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.18, radius * 0.5, 10).rotateZ(-Math.PI / 2), mats.metal)
  hub.position.x = radius * 0.2
  g.add(hub)
  g.name = 'prop'
  return g
}

// ---------------------------------------------------------------------------
// Procedural builders. All in metres, nose at +X, origin at the body centre.
// ---------------------------------------------------------------------------

function lathe(profile: Array<[number, number]>, segments = 14): THREE.BufferGeometry {
  // profile: [x along fuselage, radius]
  const pts = profile.map(([x, r]) => new THREE.Vector2(r, x))
  const g = new THREE.LatheGeometry(pts, segments)
  g.rotateZ(-Math.PI / 2) // lathe axis Y → X
  return g
}

function wing(span: number, chordRoot: number, chordTip: number, sweep: number, thickness: number, dihedral = 0.05): THREE.BufferGeometry {
  // A tapered swept plank, extruded as a thin box via a custom shape. span is total.
  const half = span / 2
  const shape = new THREE.Shape()
  shape.moveTo(chordRoot / 2, 0)
  shape.lineTo(chordTip / 2 - sweep, half)
  shape.lineTo(-chordTip / 2 - sweep, half)
  shape.lineTo(-chordRoot / 2, 0)
  shape.lineTo(-chordTip / 2 - sweep, -half)
  shape.lineTo(chordTip / 2 - sweep, -half)
  shape.closePath()
  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelThickness: thickness * 0.4, bevelSize: thickness * 0.4, bevelSegments: 1 })
  g.rotateX(Math.PI / 2) // shape plane XY → XZ, thickness along Y
  g.translate(0, -thickness / 2, 0)
  // Dihedral: bend tips up slightly.
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) + Math.abs(pos.getZ(i)) * dihedral)
  g.computeVertexNormals()
  return g
}

function canopy(len: number, w: number, h: number, mats: PaintSet): THREE.Mesh {
  const g = new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2)
  g.scale(len / 2, h, w / 2)
  const m = new THREE.Mesh(g, mats.canopy)
  m.castShadow = true
  return m
}

type ProcBuilder = (mats: PaintSet, def: Readonly<PlaneDef>) => PlaneRig

function base(def: Readonly<PlaneDef>): PlaneRig {
  return { group: new THREE.Group(), def, prop: null, burners: [], tips: def.fx.contrails.map(([x, y, z]) => new THREE.Vector3(x, y, z)), length: def.length }
}

const builders: Record<string, ProcBuilder> = {
  dart: (mats, def) => {
    const rig = base(def)
    const g = rig.group
    // Two folded slabs meeting at a crease, slight dihedral; a paper plane.
    const L = def.length
    const make = (side: number) => {
      const shape = new THREE.Shape()
      shape.moveTo(L / 2, 0)
      shape.lineTo(-L / 2, side * L * 0.42)
      shape.lineTo(-L / 2, 0)
      shape.closePath()
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false })
      geo.rotateX(Math.PI / 2)
      // Fold up: rotate about X by a dihedral.
      geo.rotateX(side * 0.35)
      return new THREE.Mesh(geo, mats.paper)
    }
    const l = make(1)
    const r = make(-1)
    l.castShadow = r.castShadow = true
    g.add(l, r)
    // Keel (the folded underside).
    const keel = new THREE.Mesh(new THREE.BoxGeometry(L * 0.96, 0.32, 0.05), mats.paper)
    keel.position.y = -0.16
    g.add(keel)
    // Crease line
    const crease = new THREE.Mesh(new THREE.BoxGeometry(L, 0.02, 0.02), mats.dark)
    g.add(crease)
    rig.setDamage = (d) => {
      l.rotation.x = d * 0.5
      r.rotation.x = -d * 0.2
    }
    return rig
  },

  biplane: (mats, def) => {
    const rig = base(def)
    const g = rig.group
    const L = def.length
    const body = new THREE.Mesh(lathe([[-L / 2, 0.18], [-L * 0.3, 0.3], [0, 0.42], [L * 0.25, 0.44], [L * 0.42, 0.36], [L / 2, 0.22]]), mats.primary)
    body.castShadow = true
    g.add(body)
    const span = L * 1.45
    const upper = new THREE.Mesh(wing(span, 0.9, 0.8, 0.05, 0.08, 0.02), mats.fabric)
    upper.position.set(0.3, 0.75, 0)
    const lower = new THREE.Mesh(wing(span * 0.92, 0.85, 0.75, 0.05, 0.08, 0.02), mats.fabric)
    lower.position.set(0.1, -0.3, 0)
    upper.castShadow = lower.castShadow = true
    g.add(upper, lower)
    for (const z of [-span * 0.3, span * 0.3]) for (const x of [-0.1, 0.6]) {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.05, 6), mats.metal)
      strut.position.set(x, 0.22, z)
      g.add(strut)
    }
    const tail = new THREE.Mesh(wing(1.6, 0.6, 0.45, 0.1, 0.06, 0), mats.fabric)
    tail.position.set(-L * 0.42, 0.1, 0)
    g.add(tail)
    const vfin = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.05), mats.accent)
    vfin.position.set(-L * 0.44, 0.45, 0)
    g.add(vfin)
    // Pilot head + scarf.
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), mats.dark)
    head.position.set(-0.2, 0.55, 0)
    g.add(head)
    const scarf = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.12), mats.accent)
    scarf.position.set(-0.5, 0.5, 0.05)
    g.add(scarf)
    const wheels = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.1, 10).rotateX(Math.PI / 2), mats.dark)
    wheels.position.set(0.3, -0.6, 0.35)
    g.add(wheels, wheels.clone().translateZ(-0.7))
    const prop = makePropDisc(0.95, mats)
    prop.position.set(L / 2 + 0.05, 0.05, 0)
    g.add(prop)
    rig.prop = prop
    return rig
  },

  jet: (mats, def) => {
    const rig = base(def)
    const g = rig.group
    const L = def.length
    const body = new THREE.Mesh(lathe([[-L / 2, 0.2], [-L * 0.3, 0.42], [0, 0.5], [L * 0.3, 0.48], [L * 0.45, 0.3], [L / 2, 0.04]], 10), mats.primary)
    body.castShadow = true
    g.add(body)
    const w = new THREE.Mesh(wing(L * 1.15, 1.6, 0.6, 1.2, 0.1, 0.06), mats.secondary)
    w.position.set(-0.2, -0.15, 0)
    w.castShadow = true
    g.add(w)
    const ttail = new THREE.Mesh(wing(L * 0.5, 0.8, 0.4, 0.5, 0.07, 0), mats.secondary)
    ttail.position.set(-L * 0.45, 1.1, 0)
    g.add(ttail)
    const vfin = new THREE.Mesh(wing(2.2, 1.0, 0.5, 0.7, 0.07, 0).rotateX(Math.PI / 2), mats.accent)
    vfin.position.set(-L * 0.42, 0.55, 0)
    g.add(vfin)
    for (const z of [-0.7, 0.7]) {
      const pod = new THREE.Mesh(lathe([[-1.2, 0.2], [-0.6, 0.32], [0.6, 0.3], [1.0, 0.22]], 10), mats.metal)
      pod.position.set(-L * 0.25, -0.1, z)
      g.add(pod)
    }
    g.add(canopy(1.6, 0.7, 0.45, mats).translateX(L * 0.2).translateY(0.42))
    for (const [x, y, z] of def.fx.afterburner!.at) {
      const b = makeBurner(def.fx.afterburner!.radius)
      b.position.set(x, y, z)
      g.add(b)
      rig.burners.push(b)
    }
    return rig
  },

  rocket: (mats, def) => {
    const rig = base(def)
    const g = rig.group
    const L = def.length
    const body = new THREE.Mesh(lathe([[-L / 2, 0.36], [-L * 0.2, 0.42], [L * 0.25, 0.4], [L * 0.42, 0.22], [L / 2, 0.02]], 12), mats.primary)
    body.castShadow = true
    g.add(body)
    const delta = new THREE.Mesh(wing(L * 0.95, 2.4, 0.3, 1.6, 0.1, 0.03), mats.secondary)
    delta.position.set(-L * 0.2, -0.1, 0)
    delta.castShadow = true
    g.add(delta)
    const vfin = new THREE.Mesh(wing(1.6, 1.2, 0.3, 0.9, 0.07, 0).rotateX(Math.PI / 2), mats.accent)
    vfin.position.set(-L * 0.38, 0.5, 0)
    g.add(vfin)
    for (const z of [-0.9, 0.9]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(L * 0.5, 0.04, 0.12), mats.accent)
      stripe.position.set(0, 0.2, z * 0.45)
      g.add(stripe)
    }
    g.add(canopy(1.3, 0.6, 0.38, mats).translateX(L * 0.15).translateY(0.36))
    const nozzle = new THREE.Mesh(lathe([[-L / 2 - 0.5, 0.42], [-L / 2, 0.36]], 12), mats.dark)
    g.add(nozzle)
    for (const [x, y, z] of def.fx.afterburner!.at) {
      const b = makeBurner(def.fx.afterburner!.radius)
      b.position.set(x, y, z)
      g.add(b)
      rig.burners.push(b)
    }
    return rig
  },

  glider: (mats, def) => {
    const rig = base(def)
    const g = rig.group
    const L = def.length
    const body = new THREE.Mesh(lathe([[-L / 2, 0.05], [-L * 0.3, 0.16], [0, 0.3], [L * 0.3, 0.28], [L / 2, 0.06]], 12), mats.primary)
    body.castShadow = true
    g.add(body)
    const w = new THREE.Mesh(wing(L * 1.9, 0.9, 0.35, 0.25, 0.07, 0.09), mats.secondary)
    w.position.set(0.1, 0.12, 0)
    w.castShadow = true
    g.add(w)
    const tail = new THREE.Mesh(wing(L * 0.45, 0.5, 0.3, 0.1, 0.05, 0), mats.secondary)
    tail.position.set(-L * 0.47, 0.6, 0)
    g.add(tail)
    const vfin = new THREE.Mesh(wing(1.3, 0.7, 0.3, 0.4, 0.05, 0).rotateX(Math.PI / 2), mats.accent)
    vfin.position.set(-L * 0.46, 0.3, 0)
    g.add(vfin)
    g.add(canopy(1.4, 0.5, 0.3, mats).translateX(L * 0.15).translateY(0.24))
    return rig
  },

  delta: (mats, def) => {
    const rig = base(def)
    const g = rig.group
    const L = def.length
    const body = new THREE.Mesh(lathe([[-L / 2, 0.3], [-L * 0.25, 0.45], [L * 0.1, 0.42], [L * 0.4, 0.2], [L / 2, 0.02]], 8), mats.primary)
    body.castShadow = true
    g.add(body)
    const delta = new THREE.Mesh(wing(L * 0.9, 3.4, 0.4, 2.4, 0.12, 0.02), mats.secondary)
    delta.position.set(-L * 0.18, -0.05, 0)
    delta.castShadow = true
    g.add(delta)
    for (const z of [-0.55, 0.55]) {
      const vfin = new THREE.Mesh(wing(1.4, 1.0, 0.3, 0.8, 0.06, 0).rotateX(Math.PI / 2), mats.accent)
      vfin.position.set(-L * 0.4, 0.45, z)
      vfin.rotation.x = -z * 0.5
      g.add(vfin)
    }
    g.add(canopy(1.8, 0.7, 0.4, mats).translateX(L * 0.12).translateY(0.38))
    // Leading-edge glow strips.
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, L * 0.85), mats.emissive)
    strip.position.set(L * 0.05, 0, 0)
    g.add(strip)
    for (const [x, y, z] of def.fx.afterburner!.at) {
      const b = makeBurner(def.fx.afterburner!.radius)
      b.position.set(x, y, z)
      ;(b.material as THREE.ShaderMaterial).uniforms.uColor.value.set(0x5fd3b5)
      g.add(b)
      rig.burners.push(b)
    }
    return rig
  },

  spaceplane: (mats, def) => {
    const rig = base(def)
    const g = rig.group
    const L = def.length
    const body = new THREE.Mesh(lathe([[-L / 2, 0.42], [-L * 0.2, 0.52], [L * 0.2, 0.5], [L * 0.42, 0.3], [L / 2, 0.08]], 14), mats.primary)
    body.castShadow = true
    g.add(body)
    const belly = new THREE.Mesh(lathe([[-L / 2, 0.44], [-L * 0.2, 0.54], [L * 0.2, 0.52], [L * 0.4, 0.3]], 14), mats.dark)
    belly.position.y = -0.1
    belly.scale.y = 0.8
    g.add(belly)
    const w = new THREE.Mesh(wing(L * 0.8, 2.6, 0.5, 1.6, 0.12, 0.08), mats.secondary)
    w.position.set(-L * 0.2, -0.1, 0)
    w.castShadow = true
    g.add(w)
    for (const [z, rx] of [[-0.6, 0.5], [0.6, -0.5]] as const) {
      const vfin = new THREE.Mesh(wing(1.6, 1.1, 0.4, 0.8, 0.07, 0).rotateX(Math.PI / 2), mats.accent)
      vfin.position.set(-L * 0.4, 0.5, z)
      vfin.rotation.x = rx
      g.add(vfin)
    }
    g.add(canopy(2.0, 0.8, 0.42, mats).translateX(L * 0.18).translateY(0.44))
    for (const [x, y, z] of def.fx.afterburner!.at) {
      const b = makeBurner(def.fx.afterburner!.radius)
      b.position.set(x, y, z)
      ;(b.material as THREE.ShaderMaterial).uniforms.uColor.value.set(0x9fe3ff)
      g.add(b)
      rig.burners.push(b)
    }
    return rig
  },

  phoenix: (mats, def) => {
    const rig = base(def)
    const g = rig.group
    const L = def.length
    const body = new THREE.Mesh(lathe([[-L / 2, 0.12], [-L * 0.3, 0.35], [0, 0.48], [L * 0.3, 0.4], [L * 0.45, 0.2], [L / 2, 0.03]], 12), mats.primary)
    body.castShadow = true
    g.add(body)
    // Scalloped feather wings: three overlapping tapered planks per side with an emissive trailing edge.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const fw = new THREE.Mesh(wing(L * (0.95 - i * 0.18), 1.4 - i * 0.3, 0.25, 0.6 + i * 0.5, 0.08, 0.1 + i * 0.04), i === 2 ? mats.accent : mats.secondary)
        fw.position.set(-L * (0.05 + i * 0.12), 0.05 + i * 0.1, 0)
        fw.scale.z = side
        fw.castShadow = true
        g.add(fw)
      }
      const glow = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, L * 0.45), mats.emissive)
      glow.position.set(-L * 0.42, 0.25, side * L * 0.25)
      g.add(glow)
    }
    const tail = new THREE.Mesh(wing(L * 0.5, 1.2, 0.2, 0.6, 0.06, -0.1), mats.accent)
    tail.position.set(-L * 0.46, 0.1, 0)
    g.add(tail)
    g.add(canopy(1.5, 0.6, 0.36, mats).translateX(L * 0.18).translateY(0.42))
    for (const [x, y, z] of def.fx.afterburner!.at) {
      const b = makeBurner(def.fx.afterburner!.radius)
      b.position.set(x, y, z)
      ;(b.material as THREE.ShaderMaterial).uniforms.uColor.value.set(0xffd23f)
      g.add(b)
      rig.burners.push(b)
    }
    return rig
  },
}

/** Build a plane rig for a definition and paint. GLB planes load asynchronously. */
export async function buildPlaneRig(def: Readonly<PlaneDef>, paint: Readonly<PaintDef>): Promise<PlaneRig> {
  const mats = makePaintSet(paint)
  if (def.model.startsWith('proc:')) {
    const b = builders[def.model.slice(5)]
    if (!b) throw new Error(`[planes] no builder ${def.model}`)
    const rig = b(mats, def)
    rig.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true
    })
    return rig
  }
  const actor = await prepareActor(def.model as ModelId, def.length, 'max', def.forward)
  if (def.tintTextured) tintTextured(actor.group, paint, def.paintSlots)
  const rig: PlaneRig = { group: actor.group, def, prop: null, burners: [], tips: def.fx.contrails.map(([x, y, z]) => new THREE.Vector3(x, y, z)), length: def.length, mixer: actor.mixer }
  if (def.fx.prop?.node) {
    actor.group.traverse((o) => {
      if (!rig.prop && o.name === def.fx.prop!.node) rig.prop = o
    })
  }
  // GLB prop animations (Cesium Air, aerobatic) spin via their clips when present.
  if (actor.mixer && actor.clips.length) {
    for (const clip of actor.clips) {
      if (/prop|idle/i.test(clip.name)) {
        const a = actor.mixer.clipAction(clip)
        a.play()
      }
    }
  }
  return rig
}

export const PROC_PLANE_BUILDERS = Object.keys(builders)
