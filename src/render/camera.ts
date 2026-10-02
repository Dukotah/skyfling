/**
 * Camera rig (ARCHITECTURE §7): chase with speed-scaled FOV, bank-following
 * roll, boost punch, shake, crash orbit, landing dolly, aim orbit, hangar.
 */

import * as THREE from 'three'

export type CamMode = 'hangar' | 'aim' | 'chase' | 'crash' | 'land' | 'fly-debug'

export interface CamTarget {
  pos: THREE.Vector3
  /** Forward unit vector (where the plane points). */
  fwd: THREE.Vector3
  speed: number
  roll: number
  boosting: boolean
}

const UP = new THREE.Vector3(0, 1, 0)

export class CameraRig {
  camera: THREE.PerspectiveCamera
  mode: CamMode = 'aim'
  private pos = new THREE.Vector3(10, 14, 34)
  private look = new THREE.Vector3(0, 9, 0)
  private desiredPos = new THREE.Vector3()
  private desiredLook = new THREE.Vector3()
  private shakeAmp = 0
  private shakeT = 0
  private punch = 0
  private t = 0
  private crashAnchor = new THREE.Vector3()
  private tmp = new THREE.Vector3()
  private tmp2 = new THREE.Vector3()
  baseFov = 60
  /** Debug plane viewer: frame the plane centred and close. */
  hangarClose = false
  /** Lateral offset for landscape/portrait framing: portrait wants the plane lower in frame. */
  portrait = true

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.3, 6000)
    this.camera.position.copy(this.pos)
    this.camera.lookAt(this.look)
  }

  setMode(mode: CamMode, anchor?: THREE.Vector3): void {
    this.mode = mode
    this.t = 0
    if (anchor) this.crashAnchor.copy(anchor)
  }

  shake(amp: number, seconds = 0.4): void {
    this.shakeAmp = Math.max(this.shakeAmp, amp)
    this.shakeT = Math.max(this.shakeT, seconds)
  }

  /** FOV punch (boost start, perfect launch). */
  kick(amount = 1): void {
    this.punch = Math.max(this.punch, amount)
  }

  /** Snap to the desired position immediately (state transitions). */
  snap(): void {
    this.pos.copy(this.desiredPos)
    this.look.copy(this.desiredLook)
  }

  update(dt: number, target: CamTarget): void {
    this.t += dt
    const cam = this.camera
    let k = 1 - Math.exp(-7 * dt)
    let fov = this.baseFov

    switch (this.mode) {
      case 'hangar': {
        // Slow orbit around the plane on the pad (pad height ~9.6), slightly above, plane in the upper third.
        const a = this.t * 0.22 + 0.6
        const r = this.hangarClose ? 7.5 : 10
        this.desiredPos.set(target.pos.x + Math.sin(a) * r, target.pos.y + 1.8 + Math.sin(this.t * 0.7) * 0.2, target.pos.z + Math.cos(a) * r)
        this.desiredLook.set(target.pos.x, target.pos.y - (this.portrait && !this.hangarClose ? 4.2 : 0.3), target.pos.z)
        k = 1 - Math.exp(-3 * dt)
        fov = this.portrait ? 46 : 38
        break
      }
      case 'aim': {
        // Hero orbit on the pad; slightly above and behind so the cliff edge reads.
        const a = -0.55 + Math.sin(this.t * 0.35) * 0.18
        this.desiredPos.set(target.pos.x + Math.sin(a) * 15, target.pos.y + 5.5, target.pos.z + Math.cos(a) * 15)
        this.desiredLook.set(target.pos.x, target.pos.y + (this.portrait ? 1.5 : 0.8), target.pos.z - 10)
        k = 1 - Math.exp(-4 * dt)
        fov = this.portrait ? 64 : 54
        break
      }
      case 'chase': {
        const f = target.fwd
        // Horizontal back vector from the heading only (pitch doesn't swing the camera).
        const hx = f.x
        const hz = f.z
        const hl = Math.max(1e-4, Math.hypot(hx, hz))
        const bx = -hx / hl
        const bz = -hz / hl
        const back = 13 + target.speed * 0.045
        const up = this.portrait ? 6.5 : 5.2
        this.desiredPos.set(target.pos.x + bx * back, target.pos.y + up, target.pos.z + bz * back)
        const ahead = this.portrait ? 9 : 14
        this.desiredLook.set(target.pos.x - bx * ahead, target.pos.y + (this.portrait ? 0.4 : 1.2) + f.y * 6, target.pos.z - bz * ahead)
        fov = THREE.MathUtils.clamp(this.baseFov + target.speed * 0.17 + (target.boosting ? 9 : 0) + this.punch * 10, this.baseFov, 86)
        break
      }
      case 'crash': {
        // Slow orbit around the wreck, rising.
        const a = this.t * 0.6 + 1.2
        const r = 14 + this.t * 2.5
        this.desiredPos.set(this.crashAnchor.x + Math.sin(a) * r, this.crashAnchor.y + 5 + this.t * 2, this.crashAnchor.z + Math.cos(a) * r)
        this.desiredLook.copy(this.crashAnchor).add(this.tmp.set(0, 1, 0))
        k = 1 - Math.exp(-2.5 * dt)
        fov = 56
        break
      }
      case 'land': {
        // Dolly: slide to the side and settle.
        const f = target.fwd
        const hl = Math.max(1e-4, Math.hypot(f.x, f.z))
        const sx = -f.z / hl
        const sz = f.x / hl
        const d = Math.min(1, this.t / 2.2)
        this.desiredPos.set(target.pos.x + sx * (10 + d * 6) - (f.x / hl) * 6, target.pos.y + 3.5 + d * 2, target.pos.z + sz * (10 + d * 6) - (f.z / hl) * 6)
        this.desiredLook.copy(target.pos).add(this.tmp.set(0, 0.8, 0))
        k = 1 - Math.exp(-3 * dt)
        fov = 50
        break
      }
      case 'fly-debug': {
        this.desiredPos.copy(target.pos)
        this.desiredLook.copy(target.pos).add(target.fwd)
        k = 1
        fov = 62
        break
      }
    }

    this.pos.lerp(this.desiredPos, k)
    this.look.lerp(this.desiredLook, k)

    // Shake: decaying noise.
    if (this.shakeT > 0) {
      this.shakeT -= dt
      const a = this.shakeAmp * Math.max(0, this.shakeT) * 2.5
      this.tmp2.set(Math.sin(this.t * 61) * a, Math.sin(this.t * 47 + 1) * a * 0.6, Math.cos(this.t * 53 + 2) * a)
      if (this.shakeT <= 0) this.shakeAmp = 0
    } else {
      this.tmp2.set(0, 0, 0)
    }
    this.punch = Math.max(0, this.punch - dt * 2.4)

    cam.position.copy(this.pos).add(this.tmp2)
    cam.up.copy(UP)
    cam.lookAt(this.look)
    // Bank-following roll in chase.
    if (this.mode === 'chase') cam.rotateZ(-target.roll * 0.35)
    cam.fov += (fov - cam.fov) * Math.min(1, dt * 6)
    cam.updateProjectionMatrix()
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect
    this.portrait = aspect < 1
    this.camera.updateProjectionMatrix()
  }
}
