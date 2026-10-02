import './style.css'
import * as THREE from 'three'
import { Sky } from 'three/examples/jsm/objects/Sky.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { registerSW } from 'virtual:pwa-register'

// PWA: keep the installed app up to date silently.
registerSW({ immediate: true })

/**
 * Phase 0 boot scene: an HDRI-style lit sky with a stylized low-poly plane
 * rotating over soft ground. This is the "Duke opens the URL and sees a
 * spinning plane over a sky" checkpoint. Real HDRI, terrain and gameplay
 * arrive in later phases (see docs/ROADMAP.md).
 */

const canvas = document.getElementById('scene') as HTMLCanvasElement
const boot = document.getElementById('boot') as HTMLDivElement
const bootFill = document.getElementById('bootFill') as HTMLDivElement
const bootTip = boot.querySelector('.boot-tip') as HTMLDivElement

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
})
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

const scene = new THREE.Scene()
scene.fog = new THREE.Fog(0x9fc4e8, 60, 320)

const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 2000)
camera.position.set(0, 3.2, 9)
camera.lookAt(0, 1.4, 0)

// Environment lighting from a procedural room (stand-in until the Phase 1 HDRI).
const pmrem = new THREE.PMREMGenerator(renderer)
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture

// Visible sky dome (Preetham). Driven by a sun elevation that reads as morning.
const sky = new Sky()
sky.scale.setScalar(10000)
scene.add(sky)
const sun = new THREE.Vector3()
{
  const u = sky.material.uniforms
  u.turbidity.value = 6
  u.rayleigh.value = 1.8
  u.mieCoefficient.value = 0.005
  u.mieDirectionalG.value = 0.8
  const phi = THREE.MathUtils.degToRad(90 - 22) // elevation 22°
  const theta = THREE.MathUtils.degToRad(-50) // azimuth
  sun.setFromSphericalCoords(1, phi, theta)
  u.sunPosition.value.copy(sun)
}

// Key light following the sun, plus soft fill.
const sunLight = new THREE.DirectionalLight(0xfff2d8, 2.6)
sunLight.position.copy(sun).multiplyScalar(60)
sunLight.castShadow = true
sunLight.shadow.mapSize.set(1024, 1024)
sunLight.shadow.camera.near = 1
sunLight.shadow.camera.far = 160
sunLight.shadow.camera.left = -30
sunLight.shadow.camera.right = 30
sunLight.shadow.camera.top = 30
sunLight.shadow.camera.bottom = -30
sunLight.shadow.bias = -0.0004
scene.add(sunLight)
scene.add(new THREE.HemisphereLight(0xbfe3ff, 0x4a5a3a, 0.5))

// Soft ground so the plane casts a shadow and the scene reads as a world.
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(220, 48),
  new THREE.MeshStandardMaterial({ color: 0x6fb36a, roughness: 1, metalness: 0 }),
)
ground.rotation.x = -Math.PI / 2
ground.position.y = -6
ground.receiveShadow = true
scene.add(ground)

/** Build a chunky, readable low-poly plane in the Skyfling palette. */
function makePlane(): THREE.Group {
  const g = new THREE.Group()
  const coral = new THREE.MeshStandardMaterial({ color: 0xff6b4a, roughness: 0.45, metalness: 0.1, flatShading: true })
  const butter = new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.4, metalness: 0.15, flatShading: true })
  const navy = new THREE.MeshStandardMaterial({ color: 0x1f2a44, roughness: 0.3, metalness: 0.3, flatShading: true })
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fdfff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.55 })

  // Fuselage: a stretched, tapered body (cone + nose).
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.32, 4.2, 10), coral)
  body.rotation.z = Math.PI / 2
  g.add(body)
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.1, 10), coral)
  nose.rotation.z = -Math.PI / 2
  nose.position.x = 2.5
  g.add(nose)

  // Canopy.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), glass)
  canopy.scale.set(1.4, 0.7, 0.9)
  canopy.position.set(0.7, 0.42, 0)
  g.add(canopy)

  // Main wings.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 6.4), butter)
  wing.position.set(0.1, -0.05, 0)
  wing.castShadow = true
  g.add(wing)

  // Tail plane + fin.
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 2.4), butter)
  tail.position.set(-1.9, 0.05, 0)
  g.add(tail)
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.12), coral)
  fin.position.set(-2.0, 0.55, 0)
  g.add(fin)

  // Spinner / prop hub.
  const hub = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 8), navy)
  hub.rotation.z = -Math.PI / 2
  hub.position.x = 3.1
  g.add(hub)

  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true
  })
  g.scale.setScalar(1.15)
  g.position.y = 1.2
  return g
}

const plane = makePlane()
scene.add(plane)

// --- Loop with visibility pause and DPR clamping ----------------------------
const clock = new THREE.Clock()
let running = true
let rafId = 0

function resize() {
  const w = window.innerWidth
  const h = window.innerHeight
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  renderer.setPixelRatio(dpr)
  renderer.setSize(w, h, false)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
}
window.addEventListener('resize', resize)
resize()

function frame() {
  if (!running) return
  rafId = requestAnimationFrame(frame)
  const t = clock.getElapsedTime()
  // Gentle hero rotation + bob so it feels alive, not static.
  plane.rotation.y = t * 0.6
  plane.rotation.z = Math.sin(t * 1.3) * 0.12
  plane.position.y = 1.2 + Math.sin(t * 0.9) * 0.25
  renderer.render(scene, camera)
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    running = false
    cancelAnimationFrame(rafId)
  } else if (!running) {
    running = true
    clock.getDelta() // discard the gap
    frame()
  }
})

// --- Boot sequence ----------------------------------------------------------
frame()
let p = 0
const bootTimer = window.setInterval(() => {
  p = Math.min(100, p + 8 + Math.random() * 14)
  bootFill.style.width = `${p}%`
  if (p >= 100) {
    window.clearInterval(bootTimer)
    bootTip.classList.add('show')
    const dismiss = () => {
      boot.classList.add('gone')
      window.setTimeout(() => boot.remove(), 650)
      window.removeEventListener('pointerdown', dismiss)
    }
    window.addEventListener('pointerdown', dismiss)
    // Auto-dismiss after a moment if they don't tap.
    window.setTimeout(dismiss, 2200)
  }
}, 120)
