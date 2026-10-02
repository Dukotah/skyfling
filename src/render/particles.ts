/**
 * Particles (ARCHITECTURE §7): one GPU point pool for sparks/dust/confetti/smoke
 * (single draw call) and a camera-following precipitation field for rain,
 * snow, ash and sand.
 */

import * as THREE from 'three'
import { makeSoftSprite } from './textures'

export interface Particle {
  life: number
  maxLife: number
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  size: number
  grow: number
  gravity: number
  r: number
  g: number
  b: number
}

const VERT = /* glsl */ `
  attribute float aSize; attribute vec4 aColor;
  varying vec4 vColor;
  void main(){
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (300.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }`
const FRAG = /* glsl */ `
  uniform sampler2D uMap; varying vec4 vColor;
  void main(){
    vec4 t = texture2D(uMap, gl_PointCoord);
    gl_FragColor = vec4(vColor.rgb, vColor.a * t.a);
    if (gl_FragColor.a < 0.01) discard;
  }`

export class ParticlePool {
  points: THREE.Points
  private pool: Particle[] = []
  private pos: Float32Array
  private size: Float32Array
  private col: Float32Array
  private geo: THREE.BufferGeometry

  constructor(public capacity = 300) {
    this.pos = new Float32Array(capacity * 3)
    this.size = new Float32Array(capacity)
    this.col = new Float32Array(capacity * 4)
    this.geo = new THREE.BufferGeometry()
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage))
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage))
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage))
    const mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: makeSoftSprite() } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    })
    this.points = new THREE.Points(this.geo, mat)
    this.points.frustumCulled = false
    for (let i = 0; i < capacity; i++) this.pool.push({ life: 0, maxLife: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 1, grow: 0, gravity: 0, r: 1, g: 1, b: 1 })
  }

  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, color: THREE.ColorRepresentation, size: number, grow = 0, gravity = 0): void {
    let p = this.pool.find((q) => q.life <= 0)
    if (!p) p = this.pool[Math.floor(Math.random() * this.pool.length)]
    const c = new THREE.Color(color)
    p.life = p.maxLife = life
    p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz
    p.size = size; p.grow = grow; p.gravity = gravity
    p.r = c.r; p.g = c.g; p.b = c.b
  }

  /** Burst helpers */
  spark(x: number, y: number, z: number, color: THREE.ColorRepresentation, n = 10, speed = 6): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const b = Math.random() * 2 - 1
      const v = speed * (0.4 + Math.random() * 0.6)
      this.emit(x, y, z, Math.cos(a) * v, b * v, Math.sin(a) * v, 0.5 + Math.random() * 0.3, color, 0.9, 0, 0)
    }
  }

  confetti(x: number, y: number, z: number): void {
    const cols = [0xff6b4a, 0xffd23f, 0x5fd3b5, 0xffffff]
    for (let i = 0; i < 48; i++) {
      this.emit(x + (Math.random() * 4 - 2), y + 1, z + (Math.random() * 4 - 2), Math.random() * 12 - 6, 6 + Math.random() * 9, Math.random() * 12 - 6, 1.2 + Math.random() * 0.8, cols[i % 4], 0.7, 0, 9)
    }
  }

  dust(x: number, y: number, z: number, n = 6): void {
    for (let i = 0; i < n; i++) this.emit(x + (Math.random() * 2 - 1), y - 0.8, z + (Math.random() * 2 - 1), Math.random() * 6 - 3, 0.5 + Math.random() * 3, Math.random() * 4, 0.7, 0xf3ecdf, 1.6, 3, 0)
  }

  smoke(x: number, y: number, z: number, n = 4): void {
    for (let i = 0; i < n; i++) this.emit(x + (Math.random() - 0.5), y, z + (Math.random() - 0.5), Math.random() * 2 - 1, 2 + Math.random() * 2, Math.random() * 2 - 1, 1.5 + Math.random(), 0x44403c, 2.5, 4, -0.5)
  }

  update(dt: number): void {
    const pos = this.pos
    const size = this.size
    const col = this.col
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i]
      if (p.life <= 0) {
        size[i] = 0
        col[i * 4 + 3] = 0
        continue
      }
      p.life -= dt
      p.vy -= p.gravity * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.z += p.vz * dt
      const t = Math.max(0, p.life / p.maxLife)
      pos[i * 3] = p.x
      pos[i * 3 + 1] = p.y
      pos[i * 3 + 2] = p.z
      size[i] = p.size + p.grow * (1 - t)
      col[i * 4] = p.r
      col[i * 4 + 1] = p.g
      col[i * 4 + 2] = p.b
      col[i * 4 + 3] = Math.min(1, t * 2)
    }
    this.geo.attributes.position.needsUpdate = true
    this.geo.attributes.aSize.needsUpdate = true
    this.geo.attributes.aColor.needsUpdate = true
  }
}

export type PrecipKind = 'none' | 'rain' | 'snow' | 'ash' | 'sand'

/** Camera-following precipitation box. */
export class Precipitation {
  points: THREE.Points
  private kind: PrecipKind = 'none'
  private pos: Float32Array
  private geo: THREE.BufferGeometry
  private mat: THREE.PointsMaterial
  private box = 120
  private target = 0
  private intensity = 0

  constructor(public count = 900) {
    this.pos = new Float32Array(count * 3)
    this.geo = new THREE.BufferGeometry()
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage))
    this.mat = new THREE.PointsMaterial({ size: 0.7, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true, map: makeSoftSprite(32), fog: true })
    this.points = new THREE.Points(this.geo, this.mat)
    this.points.frustumCulled = false
    for (let i = 0; i < count; i++) this.reset(i, true)
  }

  private reset(i: number, anywhere: boolean): void {
    const b = this.box
    this.pos[i * 3] = (Math.random() - 0.5) * b
    this.pos[i * 3 + 1] = anywhere ? (Math.random() - 0.5) * b : b / 2
    this.pos[i * 3 + 2] = (Math.random() - 0.5) * b
  }

  set(kind: PrecipKind): void {
    if (kind === this.kind) return
    this.kind = kind
    this.target = kind === 'none' ? 0 : 1
    switch (kind) {
      case 'rain': this.mat.color.set(0xcfe0ff); this.mat.size = 0.5; break
      case 'snow': this.mat.color.set(0xffffff); this.mat.size = 0.9; break
      case 'ash': this.mat.color.set(0x8a8078); this.mat.size = 1.1; break
      case 'sand': this.mat.color.set(0xe8c98a); this.mat.size = 0.8; break
    }
  }

  update(dt: number, center: THREE.Vector3, wind: number): void {
    this.intensity += (this.target - this.intensity) * Math.min(1, dt * 1.5)
    this.mat.opacity = this.intensity * (this.kind === 'rain' ? 0.55 : 0.8)
    this.points.visible = this.intensity > 0.02
    if (!this.points.visible) return
    this.points.position.copy(center)
    const b = this.box
    const fall = this.kind === 'rain' ? 42 : this.kind === 'snow' ? 4 : this.kind === 'ash' ? 2.5 : 6
    const drift = this.kind === 'sand' ? 30 : this.kind === 'snow' ? 3 : 1
    for (let i = 0; i < this.count; i++) {
      const o = i * 3
      this.pos[o + 1] -= fall * dt
      this.pos[o] += (wind + Math.sin(i + this.pos[o + 1] * 0.1) * drift) * dt
      if (this.pos[o + 1] < -b / 2) this.reset(i, false)
      if (this.pos[o] > b / 2) this.pos[o] -= b
      if (this.pos[o] < -b / 2) this.pos[o] += b
    }
    this.geo.attributes.position.needsUpdate = true
  }
}
