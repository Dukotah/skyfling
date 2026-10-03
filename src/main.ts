import './style.css'
import * as THREE from 'three'
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
  ZONE_HALF_WIDTH,
  type FlightState,
  type PlaneStats,
} from './sim/flight.ts'
import { Terrain, heightAt, slopeAt, isWaterAt, GROUND_BASE, bandAt } from './world/terrain.ts'
import { BiomeEnv } from './world/biomeEnv.ts'
import { Scenery } from './world/scenery.ts'
import { Collectibles } from './world/collectibles.ts'
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
const hCoins = $<HTMLDivElement>('hCoins')
const hCoinN = $<HTMLSpanElement>('hCoinN')
const biomeTag = $<HTMLDivElement>('biomeTag')
const resCoins = $<HTMLDivElement>('resCoins')

// --- Renderer / scene ------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

const scene = new THREE.Scene()
// scene.fog is installed and driven per-biome by BiomeEnv.

const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 4500)

const pmrem = new THREE.PMREMGenerator(renderer)
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture

// Sun direction (used to place the shadow-casting directional light). The sky
// itself is a gradient dome owned by BiomeEnv and recoloured per biome below.
const sunDir = new THREE.Vector3()
sunDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 24), THREE.MathUtils.degToRad(-50))

const sunLight = new THREE.DirectionalLight(0xfff2d8, 2.6)
sunLight.position.copy(sunDir).multiplyScalar(80)
sunLight.castShadow = true
sunLight.shadow.mapSize.set(1024, 1024)
sunLight.shadow.camera.near = 1
sunLight.shadow.camera.far = 240
sunLight.shadow.camera.left = -60
sunLight.shadow.camera.right = 60
sunLight.shadow.camera.top = 60
sunLight.shadow.camera.bottom = -60
sunLight.shadow.bias = -0.0004
scene.add(sunLight)
// The shadow frustum follows the plane so shadows stay crisp down the course.
const sunTarget = new THREE.Object3D()
scene.add(sunTarget)
sunLight.target = sunTarget

// --- World layers (terrain, atmosphere, scenery, collectibles) ------------
const env = new BiomeEnv(scene, sunLight)
const terrain = new Terrain()
scene.add(terrain.mesh)
const scenery = new Scenery()
scene.add(scenery.group)
const collectibles = new Collectibles()
scene.add(collectibles.group)

// Launch pad / cliff block at the origin so the drop reads.
{
  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(26, 64, 30),
    new THREE.MeshStandardMaterial({ color: 0x8a9472, roughness: 1, flatShading: true }),
  )
  pad.position.set(0, GROUND_BASE, 7)
  pad.receiveShadow = true
  pad.castShadow = true
  scene.add(pad)
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
let runCoins = 0
let lastBand = -1
let biomeTagTimer = 0

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
  runCoins = 0
  lastBand = -1
  collectibles.reset()
  hCoinN.textContent = '0'
  biomeTag.classList.remove('show')
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
  if (isBest) best = d
  // Bank the run: best distance, coins collected, and lifetime stats.
  const data = load()
  data.bestDistance = Math.max(data.bestDistance || 0, d)
  data.coins = (data.coins || 0) + runCoins
  data.lifetimeCoins = (data.lifetimeCoins || 0) + runCoins
  data.lifetimeFlights = (data.lifetimeFlights || 0) + 1
  data.lifetimeDistance = (data.lifetimeDistance || 0) + d
  save(data)
  resHead.textContent = kind === 'crash' ? 'CRASHED' : kind === 'splash' ? 'SPLASHDOWN' : 'NICE FLIGHT'
  resDist.textContent = String(d)
  resCoins.innerHTML = `<span class="coin-dot"></span>+${runCoins}`
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
  desiredPos.set(fs.x + bx * 11, fs.y + 5.2, fs.z + bz * 11)
  desiredLook.set(fs.x - bx * 9, fs.y + 1.4, fs.z - bz * 9)
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
  const g = groundCheck(fs, {
    groundY: heightAt(fs.x, fs.z),
    slope: slopeAt(fs.x, fs.z),
    water: isWaterAt(fs.x, fs.z),
  })
  if (g.ended) endRun(g.kind)
}

/** Fade in the current biome's nameplate when the plane crosses into a new zone. */
function updateBiomeTag(d: number) {
  const band = bandAt(d)
  if (band.index === lastBand) return
  lastBand = band.index
  biomeTag.textContent = band.cur.name
  biomeTag.classList.remove('show')
  void biomeTag.offsetWidth // restart transition
  biomeTag.classList.add('show')
  window.clearTimeout(biomeTagTimer)
  biomeTagTimer = window.setTimeout(() => biomeTag.classList.remove('show'), 2600)
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

    // Collect coins / thread rings / ride thermals, and react with juice.
    const ev = collectibles.update(fs, stats.magnet, dt)
    if (ev.coins > 0) {
      runCoins += ev.coins
      hCoinN.textContent = String(runCoins)
      hCoins.classList.remove('bump')
      void hCoins.offsetWidth
      hCoins.classList.add('bump')
      sfx.play('coin')
    }
    if (ev.ring) {
      sfx.play('whoosh')
      toast('BOOST!', '#5fd3ff')
      navigator.vibrate?.(20)
    }

    const d = distance(fs)
    updateBiomeTag(d)
    const thr = (fs.fuel > 0 ? 0.55 : 0) + (fs.boosting ? 0.45 : 0)
    engine.update(thr, fs.s)
    hDist.textContent = String(Math.round(d))
    hSpeed.innerHTML = `${Math.round(fs.s)} <small>m/s</small>`
    const atBest = d > best && best > 0
    hDist.style.color = atBest ? '#5fd3b5' : '#fff'
  } else {
    updateCamera(dt * 0.6)
  }

  // Keep the world (terrain patch, sky, sea, shadows) centred on the action.
  const wx = mode === 'ready' ? 0 : fs.x
  const wz = mode === 'ready' ? 0 : fs.z
  terrain.update(wx, wz)
  env.update(mode === 'ready' ? 0 : distance(fs), wx, wz, dt)
  scenery.update(dt)
  sunTarget.position.set(wx, 0, wz)
  sunLight.position.copy(sunDir).multiplyScalar(80).add(sunTarget.position)

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
