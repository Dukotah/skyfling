/**
 * Flight controls (GDD §3). Default "Glide" scheme: one thumb anywhere —
 * hold = climb (pitch ramps 0→+1 over 0.25 s), release = glide/dive (ramps to
 * −0.35 over 0.4 s, then auto-trim); horizontal drag while holding = bank.
 * "Pilot" scheme: floating joystick. BOOST is a separate button with its own
 * pointer capture so two thumbs work. Keyboard mirrors for desktop.
 */

import type { FlightInput } from '../sim/flight'
import { el, uiRoot } from './dom'

export type ControlScheme = 'glide' | 'pilot'

export class Controls {
  scheme: ControlScheme = 'glide'
  invert = false
  leftHanded = false
  /** Raw targets; `input()` smooths them. */
  private holdId: number | null = null
  private holdX = 0
  private holdY = 0
  private dragX = 0
  private dragY = 0
  private pitchT = 0
  private pitch = -0.35
  private steer = 0
  private boostHeld = false
  private keyUp = false
  private keyDown = false
  private keyLeft = false
  private keyRight = false
  private keyBoost = false
  enabled = false
  /** Emits boost on/off changes. */
  onBoost: ((on: boolean) => void) | null = null
  /** Tap-while-banking → snap roll hook (Hornet trait). */
  onBoostTap: (() => void) | null = null
  private joy: HTMLDivElement
  private knob: HTMLDivElement
  boostBtn: HTMLButtonElement
  private ring: SVGCircleElement
  private holdStart = 0

  constructor(private canvas: HTMLCanvasElement) {
    const root = uiRoot()
    this.joy = el('div', 'joy')
    this.knob = el('div', 'knob')
    this.joy.appendChild(this.knob)
    root.appendChild(this.joy)
    this.boostBtn = el('button', 'boost hidden', 'BOOST')
    this.boostBtn.setAttribute('aria-label', 'Boost')
    const svgNS = 'http://www.w3.org/2000/svg'
    const svg = document.createElementNS(svgNS, 'svg')
    svg.setAttribute('viewBox', '0 0 100 100')
    const track = document.createElementNS(svgNS, 'circle')
    track.setAttribute('class', 'track')
    track.setAttribute('cx', '50')
    track.setAttribute('cy', '50')
    track.setAttribute('r', '46')
    this.ring = document.createElementNS(svgNS, 'circle')
    this.ring.setAttribute('class', 'ring')
    this.ring.setAttribute('cx', '50')
    this.ring.setAttribute('cy', '50')
    this.ring.setAttribute('r', '46')
    const circ = 2 * Math.PI * 46
    this.ring.setAttribute('stroke-dasharray', String(circ))
    this.ring.setAttribute('stroke-dashoffset', '0')
    svg.appendChild(track)
    svg.appendChild(this.ring)
    this.boostBtn.appendChild(svg)
    root.appendChild(this.boostBtn)
    this.bind()
  }

  private bind(): void {
    const b = this.boostBtn
    const down = (e: PointerEvent) => {
      e.stopPropagation()
      e.preventDefault()
      b.setPointerCapture(e.pointerId)
      if (!this.boostHeld) {
        this.boostHeld = true
        b.classList.add('on')
        this.onBoost?.(true)
        if (Math.abs(this.steer) > 0.5) this.onBoostTap?.()
      }
    }
    const up = (e: PointerEvent) => {
      e.stopPropagation()
      if (this.boostHeld) {
        this.boostHeld = false
        b.classList.remove('on')
        this.onBoost?.(false)
      }
    }
    b.addEventListener('pointerdown', down)
    b.addEventListener('pointerup', up)
    b.addEventListener('pointercancel', up)
    b.addEventListener('lostpointercapture', up)

    const c = this.canvas
    c.addEventListener('pointerdown', (e) => {
      if (!this.enabled || this.holdId !== null) return
      this.holdId = e.pointerId
      this.holdX = this.dragX = e.clientX
      this.holdY = this.dragY = e.clientY
      this.holdStart = performance.now()
      c.setPointerCapture(e.pointerId)
      if (this.scheme === 'pilot') {
        this.joy.style.left = `${e.clientX}px`
        this.joy.style.top = `${e.clientY}px`
        this.joy.classList.add('on')
        this.knob.style.transform = 'translate(-50%, -50%)'
      }
    })
    c.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.holdId) return
      this.dragX = e.clientX
      this.dragY = e.clientY
      if (this.scheme === 'pilot') {
        const dx = Math.max(-50, Math.min(50, e.clientX - this.holdX))
        const dy = Math.max(-50, Math.min(50, e.clientY - this.holdY))
        this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`
      }
    })
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.holdId) return
      this.holdId = null
      this.joy.classList.remove('on')
    }
    c.addEventListener('pointerup', end)
    c.addEventListener('pointercancel', end)

    window.addEventListener('keydown', (e) => this.key(e, true))
    window.addEventListener('keyup', (e) => this.key(e, false))
  }

  private key(e: KeyboardEvent, on: boolean): void {
    switch (e.code) {
      case 'ArrowUp': case 'KeyW': case 'Space': this.keyUp = on; if (on) e.preventDefault(); break
      case 'ArrowDown': case 'KeyS': this.keyDown = on; break
      case 'ArrowLeft': case 'KeyA': this.keyLeft = on; break
      case 'ArrowRight': case 'KeyD': this.keyRight = on; break
      case 'ShiftLeft': case 'ShiftRight': case 'KeyB':
        if (on !== this.keyBoost) {
          this.keyBoost = on
          this.boostBtn.classList.toggle('on', on)
          this.onBoost?.(on)
        }
        break
    }
  }

  setEnabled(on: boolean): void {
    this.enabled = on
    this.boostBtn.classList.toggle('hidden', !on)
    if (!on) {
      this.holdId = null
      this.joy.classList.remove('on')
      if (this.boostHeld) {
        this.boostHeld = false
        this.boostBtn.classList.remove('on')
      }
    }
    this.boostBtn.style.right = this.leftHanded ? 'auto' : ''
    this.boostBtn.style.left = this.leftHanded ? 'calc(var(--sal) + 14px)' : ''
  }

  reset(): void {
    this.pitch = -0.35
    this.steer = 0
    this.pitchT = 0
  }

  setNitro(frac: number, canBoost: boolean): void {
    const circ = 2 * Math.PI * 46
    this.ring.setAttribute('stroke-dashoffset', String(circ * (1 - Math.max(0, Math.min(1, frac)))))
    this.boostBtn.classList.toggle('empty', !canBoost)
  }

  get holding(): boolean {
    return this.holdId !== null
  }

  /** Seconds the thumb has been down (for tutorial hints). */
  get holdSeconds(): number {
    return this.holdId === null ? 0 : (performance.now() - this.holdStart) / 1000
  }

  /** Produce the smoothed FlightInput for this step. */
  input(dt: number, out: FlightInput): FlightInput {
    const inv = this.invert ? -1 : 1
    let targetPitch: number
    let targetSteer: number
    if (this.scheme === 'glide') {
      const holding = this.holdId !== null
      if (holding) {
        this.pitchT = Math.min(1, this.pitchT + dt / 0.25)
        targetPitch = this.pitchT * inv
        targetSteer = Math.max(-1, Math.min(1, (this.dragX - this.holdX) / 160))
      } else {
        this.pitchT = Math.max(0, this.pitchT - dt / 0.4)
        targetPitch = this.pitchT * inv - (1 - this.pitchT) * 0.35
        targetSteer = 0
      }
    } else {
      if (this.holdId !== null) {
        targetPitch = Math.max(-1, Math.min(1, (this.holdY - this.dragY) / 60)) * inv
        targetSteer = Math.max(-1, Math.min(1, (this.dragX - this.holdX) / 60))
      } else {
        targetPitch = 0
        targetSteer = 0
      }
    }
    // Keyboard overrides.
    if (this.keyUp) targetPitch = 1 * inv
    else if (this.keyDown) targetPitch = -1 * inv
    if (this.keyLeft) targetSteer = -1
    else if (this.keyRight) targetSteer = 1
    const k = Math.min(1, dt * 9)
    this.pitch += (targetPitch - this.pitch) * k
    this.steer += (targetSteer - this.steer) * k
    out.pitch = this.pitch
    out.steer = this.steer
    out.boost = this.boostHeld || this.keyBoost
    return out
  }
}
