import './style.css'
import * as THREE from 'three'
import { Sky } from 'three/examples/jsm/objects/Sky.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { registerSW } from 'virtual:pwa-register'
import { buildPlane } from './render/plane.ts'
import {
  derivePlaneStats,
  uniformLevels,
  launch,
  simStep,
  groundCheck,
  gradeLaunch,
  distance,
  cliffGroundY,
  ZONE_HALF_WIDTH,
  type FlightState,
  type PlaneStats,
} from './sim/flight.ts'
import { load, save } from './save/save.ts'
import { sfx } from './audio/sfx.ts'
import { engine } from './audio/engine.ts'

registerSW({ immediate: true })

/**
 * Phase 2 (first playable): tap-to-fling flight toy on the real ported physics.
 * Slingshot timing → launch → fly with drag-to-pitch + hold-boost → land →
 * results with best distance (persisted). Terrain, biomes, pickups, missions,
 * the full plane roster and hangar follow in later roadmap items.
 */

// --- DOM -------------------------------------------------------------------
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const canvas = $<HTMLCanvasElement>('scene')
const boot = $<HTMLDivElement>('boot')
const bootFill = $<HTMLDivElement>('bootFill')
const hud = $<HTMLDivElement>('hud')
const hDist = $<HTMLSpanElement>('hDist')
const hSpeed = $<HTMLDivElement>('hSpeed')
const hBest = $<HTMLDivElement>('hBest')
const boostBtn = $<HTMLButtonElement>('boost')
const aim = $<HTMLDivElement>('aim')
const powerZone = $<HTMLDivElement>('powerZone')
const powerMarker = $<HTMLDivElement>('powerMarker')
const results = $<HTMLDivElement>('results')
const resHead = $<HTMLDivElement>('resHead')
const resDist = $<HTMLSpanElement>('resDist')
const resBest = $<HTMLDivElement>('resBest')
const againBtn = $<HTMLButtonElement>('again')
const toastEl = $<HTMLDivElement>('toast')

// --- Renderer / scene ------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

const scene = new THREE.Scene()
scene.fog = new THREE.Fog(0x9fc4e8, 120, 900)

const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 4000)

const pmrem = new THREE.PMREMGenerator(renderer)
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture

// Sky.
const sky = new Sky()
sky.scale.setScalar(10000)
scene.add(sky)
const sunDir = new THREE.Vector3()
{
  const u = sky.material.uniforms
  u.turbidity.value = 6
  u.rayleigh.value = 1.8
  u.mieCoefficient.value = 0.005
  u.mieDirectionalG.value = 0.8
  sunDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 24), THREE.MathUtils.degToRad(-50))
  u.sunPosition.value.copy(sunDir)
}

const sunLight = new THREE.DirectionalLight(0xfff2d8, 2.6)
sunLight.position.copy(sunDir).multiplyScalar(80)
sunLight.castShadow = true
sunLight.shadow.mapSize.set(1024, 1024)
sunLight.shadow.camera.near = 1
sunLight.shadow.camera.far = 220
sunLight.shadow.camera.left = -40
sunLight.shadow.camera.right = 40
sunLight.shadow.camera.top = 40
sunLight.shadow.camera.bottom = -40
sunLight.shadow.bias = -0.0004
scene.add(sunLight)
scene.add(new THREE.HemisphereLight(0xbfe3ff, 0x4a5a3a, 0.55))

// Ground that follows the launch-cliff profile near the pad, then flat.
{
  const g = new THREE.Mesh(
    new THREE.PlaneGeometry(4000, 7000, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x6fb36a, roughness: 1, metalness: 0 }),
  )
  g.rotation.x = -Math.PI / 2
  g.position.set(0, -22, -3200)
  g.receiveShadow = true
  scene.add(g)

  // Launch pad / cliff block at the origin so the drop reads.
  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(26, 44, 30),
    new THREE.MeshStandardMaterial({ color: 0x7d8a6a, roughness: 1 }),
  )
  pad.position.set(0, -22, 7)
  pad.receiveShadow = true
  pad.castShadow = true
  scene.add(pad)
}

// Instanced scenery so speed reads as you fly.
{
  const treeGeo = new THREE.ConeGeometry(1.5, 5, 6)
  const treeMat = new THREE.MeshStandardMaterial({ color: 0x3f8f5a, roughness: 1, flatShading: true })
  const COUNT = 340
  const trees = new THREE.InstancedMesh(treeGeo, treeMat, COUNT)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const s = new THREE.Vector3()
  const p = new THREE.Vector3()
  for (let i = 0; i < COUNT; i++) {
    const x = (Math.random() * 2 - 1) * 80
    const z = -Math.random() * 3400 - 30
    const sc = 0.6 + Math.random() * 1.8
    p.set(x, cliffGroundY(z) - 22 + 2.3 * sc, z)
    s.set(sc, sc, sc)
    m.compose(p, q, s)
    trees.setMatrixAt(i, m)
  }
  trees.instanceMatrix.needsUpdate = true
  scene.add(trees)
}

// Plane.
const plane = buildPlane()
scene.add(plane)

// Contrail-ish simple trail: a short ribbon of fading points behind the plane.
const TRAIL = 40
const trailPos = new Float32Array(TRAIL * 3)
const trailGeo = new THREE.BufferGeometry()
trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3))
const trail = new THREE.Line(
  trailGeo,
  new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }),
)
trail.frustumCulled = false
scene.add(trail)

// --- Game state ------------------------------------------------------------
type Mode = 'ready' | 'flying' | 'ended'
let mode: Mode = 'ready'
let started = false // true once the boot screen is dismissed
const stats: PlaneStats = derivePlaneStats(uniformLevels(3)) // a lively mid-game plane for the demo
let fs: FlightState = launch(stats, 0.8, { pos: { x: 0, y: 9, z: 0 } })
let best = load().bestDistance || 0
let streak = 0

// Aim sweep.
let aimT = 0
const AIM_PERIOD = 1.5
const AIM_CENTER = 0.8

// Input.
let pitchInput = 0
let steerInput = 0
let boostHeld = false
let dragId: number | null = null
let dragX = 0
let dragY = 0

// --- HUD helpers -----------------------------------------------------------
function toast(text: string, color = '#fff') {
  toastEl.textContent = text
  toastEl.style.color = color
  toastEl.classList.remove('show')
  void toastEl.offsetWidth // restart animation
  toastEl.classList.add('show')
}

function show(el: HTMLElement, on: boolean) {
  el.classList.toggle('hidden', !on)
}

function setBestChip() {
  hBest.textContent = `best ${Math.round(best)} m`
}

// Lay out the power bar's fixed gold zone once.
powerZone.style.left = `${(AIM_CENTER - ZONE_HALF_WIDTH) * 100}%`
powerZone.style.width = `${ZONE_HALF_WIDTH * 2 * 100}%`

// --- Mode transitions ------------------------------------------------------
function toReady() {
  mode = 'ready'
  started = true
  aimT = 0
  pitchInput = 0
  steerInput = 0
  boostHeld = false
  boostBtn.classList.remove('on')
  fs = launch(stats, 0.8, { pos: { x: 0, y: 9, z: 0 } })
  show(hud, false)
  show(results, false)
  show(aim, true)
  setBestChip()
}

function doLaunch() {
  const power = sweepPower()
  const grade = gradeLaunch(power, AIM_CENTER, streak)
  streak = grade.streak
  fs = launch(stats, Math.max(0.5, power), { mult: grade.mult })
  mode = 'flying'
  show(aim, false)
  show(hud, true)
  // Audio comes alive on this user gesture.
  sfx.play('whoosh')
  if (grade.grade === 'perfect') {
    sfx.play('perfect')
    toast(grade.streak > 1 ? `PERFECT ×${grade.streak}` : 'PERFECT', '#ffd23f')
    navigator.vibrate?.(30)
  } else if (grade.grade === 'good') {
    toast('GOOD', '#5fd3b5')
  }
  engine.start(sfx.ctx ?? undefined)
}

function endRun(kind: string) {
  mode = 'ended'
  engine.stop()
  const d = Math.round(distance(fs))
  const isBest = d > best
  if (isBest) {
    best = d
    const data = load()
    data.bestDistance = d
    data.lifetimeFlights = (data.lifetimeFlights || 0) + 1
    data.lifetimeDistance = (data.lifetimeDistance || 0) + d
    save(data)
  }
  resHead.textContent = kind === 'crash' ? 'CRASHED' : kind === 'splash' ? 'SPLASHDOWN' : 'NICE FLIGHT'
  resDist.textContent = String(d)
  resBest.textContent = isBest ? '★ NEW BEST!' : `best ${Math.round(best)} m`
  setBestChip()
  sfx.play(kind === 'crash' ? 'impact' : 'coin')
  if (isBest) navigator.vibrate?.([20, 40, 60])
  show(hud, false)
  show(results, true)
}

/** Current swept power 0..1 (triangle wave). */
function sweepPower(): number {
  const phase = (aimT % AIM_PERIOD) / AIM_PERIOD
  return phase < 0.5 ? phase * 2 : 2 - phase * 2
}

// --- Input -----------------------------------------------------------------
boostBtn.addEventListener('pointerdown', (e) => {
  e.stopPropagation()
  boostHeld = true
  boostBtn.classList.add('on')
})
const releaseBoost = () => {
  boostHeld = false
  boostBtn.classList.remove('on')
}
boostBtn.addEventListener('pointerup', releaseBoost)
boostBtn.addEventListener('pointercancel', releaseBoost)
boostBtn.addEventListener('lostpointercapture', releaseBoost)

window.addEventListener('pointerdown', (e) => {
  if (!started) return
  if (mode === 'ready') {
    doLaunch()
    return
  }
  if (mode === 'flying') {
    dragId = e.pointerId
    dragX = e.clientX
    dragY = e.clientY
  }
})
window.addEventListener('pointermove', (e) => {
  if (mode !== 'flying' || e.pointerId !== dragId) return
  pitchInput = THREE.MathUtils.clamp((dragY - e.clientY) / 130, -1, 1)
  steerInput = THREE.MathUtils.clamp((e.clientX - dragX) / 160, -1, 1)
})
const endDrag = (e: PointerEvent) => {
  if (e.pointerId === dragId) {
    dragId = null
    pitchInput = 0
    steerInput = 0
  }
}
window.addEventListener('pointerup', endDrag)
window.addEventListener('pointercancel', endDrag)

againBtn.addEventListener('pointerdown', (e) => {
  e.stopPropagation()
  sfx.play('ui_tap')
  toReady()
})

// --- Camera ----------------------------------------------------------------
const camPos = new THREE.Vector3(0, 10, 30)
const camLook = new THREE.Vector3(0, 4, 0)
const tmpForward = new THREE.Vector3()
const tmpUp = new THREE.Vector3()
const tmpRight = new THREE.Vector3()
const tmpZ = new THREE.Vector3()
const basis = new THREE.Matrix4()
const desiredPos = new THREE.Vector3()
const desiredLook = new THREE.Vector3()

function updatePlaneTransform() {
  plane.position.set(fs.x, fs.y, fs.z)
  // Forward (nose, local +X) from yaw + pitch.
  tmpForward
    .set(-Math.sin(fs.yaw) * Math.cos(fs.a), Math.sin(fs.a), -Math.cos(fs.yaw) * Math.cos(fs.a))
    .normalize()
  tmpUp.set(0, 1, 0)
  tmpRight.crossVectors(tmpForward, tmpUp).normalize()
  tmpUp.crossVectors(tmpRight, tmpForward).normalize()
  tmpUp.applyAxisAngle(tmpForward, fs.roll)
  tmpZ.crossVectors(tmpForward, tmpUp)
  basis.makeBasis(tmpForward, tmpUp, tmpZ)
  plane.quaternion.setFromRotationMatrix(basis)
}

function updateCamera(dt: number) {
  // Chase from behind + above, looking a little ahead. Speed widens the FOV.
  const horiz = Math.max(0.0001, Math.hypot(Math.sin(fs.yaw), Math.cos(fs.yaw)))
  const bx = Math.sin(fs.yaw) / horiz
  const bz = Math.cos(fs.yaw) / horiz
  desiredPos.set(fs.x + bx * 14, fs.y + 6.5, fs.z + bz * 14)
  desiredLook.set(fs.x - bx * 8, fs.y + 1.2, fs.z - bz * 8)
  const k = 1 - Math.exp(-7 * dt)
  camPos.lerp(desiredPos, k)
  camLook.lerp(desiredLook, k)
  camera.position.copy(camPos)
  camera.lookAt(camLook)
  const targetFov = THREE.MathUtils.clamp(60 + fs.s * 0.18 + (fs.boosting ? 8 : 0), 60, 86)
  camera.fov += (targetFov - camera.fov) * k
  camera.updateProjectionMatrix()
}

function pushTrail() {
  for (let i = TRAIL - 1; i > 0; i--) {
    trailPos[i * 3] = trailPos[(i - 1) * 3]
    trailPos[i * 3 + 1] = trailPos[(i - 1) * 3 + 1]
    trailPos[i * 3 + 2] = trailPos[(i - 1) * 3 + 2]
  }
  trailPos[0] = fs.x
  trailPos[1] = fs.y
  trailPos[2] = fs.z
  trailGeo.attributes.position.needsUpdate = true
}

// --- Loop ------------------------------------------------------------------
const FIXED = 1 / 60
let acc = 0
let running = true
let rafId = 0
let last = 0

function resize() {
  const w = window.innerWidth
  const h = window.innerHeight
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(w, h, false)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
}
window.addEventListener('resize', resize)
resize()

function stepFlight() {
  simStep(fs, FIXED, { pitch: pitchInput, steer: steerInput, boost: boostHeld }, stats)
  const g = groundCheck(fs, { groundY: cliffGroundY(fs.z) })
  if (g.ended) endRun(g.kind)
}

function frame(now: number) {
  if (!running) return
  rafId = requestAnimationFrame(frame)
  const dt = Math.min(0.05, last ? (now - last) / 1000 : FIXED)
  last = now

  if (mode === 'ready') {
    aimT += dt
    powerMarker.style.left = `${sweepPower() * 100}%`
    // Idle hero spin on the pad.
    plane.position.set(0, 9.5 + Math.sin(aimT * 1.2) * 0.3, 7)
    plane.rotation.set(0, aimT * 0.5, Math.sin(aimT) * 0.08)
    camPos.lerp(desiredPos.set(10, 14, 34), 0.04)
    camLook.lerp(desiredLook.set(0, 9, 0), 0.06)
    camera.position.copy(camPos)
    camera.lookAt(camLook)
  } else if (mode === 'flying') {
    acc += dt
    let steps = 0
    while (acc >= FIXED && steps < 5) {
      stepFlight()
      acc -= FIXED
      steps++
      if (mode !== 'flying') break
    }
    updatePlaneTransform()
    updateCamera(dt)
    pushTrail()
    const thr = (fs.fuel > 0 ? 0.55 : 0) + (fs.boosting ? 0.45 : 0)
    engine.update(thr, fs.s)
    hDist.textContent = String(Math.round(distance(fs)))
    hSpeed.innerHTML = `${Math.round(fs.s)} <small>m/s</small>`
    const atBest = distance(fs) > best && best > 0
    hDist.style.color = atBest ? '#5fd3b5' : '#fff'
  } else {
    updateCamera(dt * 0.6)
  }

  renderer.render(scene, camera)
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    running = false
    cancelAnimationFrame(rafId)
    engine.stop()
  } else if (!running) {
    running = true
    last = 0
    rafId = requestAnimationFrame(frame)
  }
})

// --- Boot ------------------------------------------------------------------
rafId = requestAnimationFrame(frame)
let p = 0
const bootTimer = window.setInterval(() => {
  p = Math.min(100, p + 10 + Math.random() * 16)
  bootFill.style.width = `${p}%`
  if (p >= 100) {
    window.clearInterval(bootTimer)
    const go = () => {
      boot.classList.add('gone')
      window.setTimeout(() => boot.remove(), 650)
      toReady()
      window.removeEventListener('pointerdown', go)
    }
    boot.querySelector('.boot-tip')?.classList.add('show')
    window.addEventListener('pointerdown', go)
    window.setTimeout(go, 1600)
  }
}, 110)
