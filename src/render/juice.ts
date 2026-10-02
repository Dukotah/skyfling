/**
 * Juice (GDD §12): screen flash, slow-mo, shake, FOV punch, confetti and
 * shockwave, all as event-bus subscribers. UI callouts live in ui/callouts.ts.
 */

import * as THREE from 'three'
import { events } from '../core/events'
import type { CameraRig } from './camera'
import type { ParticlePool } from './particles'
import type { PostStack } from './post'

export class Juice {
  /** Time scale for slow-mo (1 = normal). */
  timeScale = 1
  private slowT = 0
  private flashEl: HTMLDivElement
  shockwave: THREE.Mesh
  private shockT = 0
  private offs: Array<() => void> = []

  constructor(private cam: CameraRig, private particles: ParticlePool, private post: PostStack, scene: THREE.Scene) {
    this.flashEl = document.createElement('div')
    this.flashEl.className = 'flash'
    document.getElementById('app')!.appendChild(this.flashEl)
    this.shockwave = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }))
    this.shockwave.rotation.x = -Math.PI / 2
    this.shockwave.visible = false
    scene.add(this.shockwave)
    this.bind()
  }

  flash(color: string, alpha = 0.6): void {
    this.flashEl.style.transition = 'none'
    this.flashEl.style.background = color
    this.flashEl.style.opacity = String(alpha)
    void this.flashEl.offsetWidth
    this.flashEl.style.transition = 'opacity .55s ease-out'
    this.flashEl.style.opacity = '0'
  }

  slowMo(seconds: number, scale = 0.3): void {
    this.slowT = seconds
    this.timeScale = scale
  }

  shock(pos: THREE.Vector3): void {
    this.shockwave.position.copy(pos)
    this.shockwave.position.y += 0.3
    this.shockwave.scale.setScalar(1)
    this.shockT = 0.8
    this.shockwave.visible = true
  }

  private bind(): void {
    const on = events.on.bind(events)
    this.offs.push(
      on('launch', (e) => {
        if (e.grade === 'perfect') {
          this.flash('#ffd23f', 0.5)
          this.slowMo(0.35, 0.35)
          this.cam.kick(1)
        } else if (e.grade === 'good') {
          this.flash('#5fd3b5', 0.25)
        }
      }),
      on('boost', (e) => {
        if (e.on) this.cam.kick(0.6)
        this.post.punch = e.on ? 0.6 : 0
      }),
      on('land', (e) => {
        const p = new THREE.Vector3(e.pos.x, e.pos.y, e.pos.z)
        if (e.kind === 'crash') {
          this.flash('#ff6b4a', 0.7)
          this.cam.shake(1.4, 0.6)
          this.shock(p)
          this.particles.spark(p.x, p.y, p.z, 0xff6b4a, 24, 10)
          this.particles.smoke(p.x, p.y, p.z, 10)
          this.post.punch = 1
        } else if (e.kind === 'bounce') {
          this.flash('#9fdfff', 0.4)
          this.cam.shake(0.8, 0.4)
          this.particles.spark(p.x, p.y, p.z, 0x9fdfff, 16, 8)
        } else if (e.kind === 'splash') {
          this.flash('#bfe3ff', 0.3)
          this.particles.spark(p.x, p.y, p.z, 0xbfe3ff, 30, 7)
          this.cam.shake(0.5, 0.3)
        } else {
          this.particles.confetti(p.x, p.y, p.z)
          this.particles.dust(p.x, p.y, p.z, 10)
        }
      }),
      on('softwall:break', () => {
        this.flash('#ffffff', 0.45)
        this.cam.kick(0.8)
        this.cam.shake(0.4, 0.3)
      }),
      on('hazard', (e) => {
        this.cam.shake(e.shieldAbsorbed ? 0.5 : 0.9, 0.35)
        this.flash(e.shieldAbsorbed ? '#9fdfff' : '#ff6b4a', 0.3)
        this.particles.spark(e.pos.x, e.pos.y, e.pos.z, e.shieldAbsorbed ? 0x9fdfff : 0xff6b4a, 12, 7)
      }),
      on('pickup', (e) => {
        const color = e.kind === 'coin' ? 0xffd23f : e.kind === 'fuel-can' ? 0xff6b4a : e.kind === 'shield-orb' ? 0x9fdfff : 0xffffff
        this.particles.spark(e.pos.x, e.pos.y, e.pos.z, color, e.kind === 'coin' ? 6 : 12, 5)
      }),
      on('ring', (e) => {
        this.particles.spark(e.pos.x, e.pos.y, e.pos.z, e.kind === 'golden' ? 0xffd23f : 0x5fd3b5, 18, 8)
        this.cam.kick(0.3)
      }),
      on('evolve', () => {
        this.flash('#ffffff', 0.8)
      }),
    )
  }

  update(dt: number): void {
    if (this.slowT > 0) {
      this.slowT -= dt
      if (this.slowT <= 0) this.timeScale = 1
    }
    if (this.shockT > 0) {
      this.shockT -= dt
      const t = 1 - this.shockT / 0.8
      this.shockwave.scale.setScalar(1 + t * 40)
      ;(this.shockwave.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.6
      if (this.shockT <= 0) this.shockwave.visible = false
    }
    // Decay post punch when not boosting.
    if (this.post.punch > 0.6) this.post.punch = Math.max(0.6, this.post.punch - dt * 1.5)
  }

  dispose(): void {
    this.offs.forEach((f) => f())
  }
}
