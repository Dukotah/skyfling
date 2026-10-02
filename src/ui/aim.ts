/**
 * Aim screen: pull the slingshot (drag down), aim yaw (drag sideways), release
 * to fling. Power bar with a moving gold zone (GDD §3). Also hosts the top
 * chips (coins, best) and the HANGAR button.
 */

import { el, uiRoot, fmt, onTap } from './dom'
import { ZONE_HALF_WIDTH, zoneCenter } from '../sim/flight'

export interface AimState {
  /** 0..1 pull (power). */
  power: number
  /** −1..1 yaw aim. */
  yaw: number
  pulling: boolean
}

export class AimScreen {
  root: HTMLDivElement
  private zone: HTMLDivElement
  private marker: HTMLDivElement
  private fill: HTMLDivElement
  private title: HTMLDivElement
  private sub: HTMLDivElement
  private coins: HTMLDivElement
  private best: HTMLDivElement
  hangarBtn: HTMLButtonElement
  state: AimState = { power: 0, yaw: 0, pulling: false }
  private pid: number | null = null
  private sx = 0
  private sy = 0
  onRelease: ((power: number, yaw: number, zoneC: number) => void) | null = null
  private t = 0
  enabled = false
  private hint: HTMLDivElement

  constructor(private canvas: HTMLCanvasElement) {
    this.root = el('div', 'hidden')
    this.root.id = 'aim'
    const top = el('div', 'aim-top')
    this.coins = el('div', 'chip coin', '0')
    this.hangarBtn = el('button', 'hangar-btn', '🛠 HANGAR')
    const chips = el('div', 'hud-right')
    this.best = el('div', 'chip', 'best 0 m')
    chips.append(this.coins, this.best)
    top.append(chips, this.hangarBtn)
    this.title = el('div', 'aim-title display', 'PULL TO FLING')
    this.sub = el('div', 'aim-sub shadow', 'drag down to pull · sideways to aim · release in the gold zone')
    const power = el('div', 'power')
    this.fill = el('div', 'fill')
    this.zone = el('div', 'zone')
    this.marker = el('div', 'marker')
    power.append(this.fill, this.zone, this.marker)
    this.hint = el('div', 'aim-hint shadow', 'then: hold anywhere to climb · let go to glide · hold BOOST through storms')
    this.root.append(top, this.title, this.sub, power, this.hint)
    uiRoot().appendChild(this.root)
    this.zone.style.width = `${ZONE_HALF_WIDTH * 2 * 100}%`
    this.bind()
  }

  private bind(): void {
    const c = this.canvas
    c.addEventListener('pointerdown', (e) => {
      if (!this.enabled || this.pid !== null) return
      this.pid = e.pointerId
      this.sx = e.clientX
      this.sy = e.clientY
      this.state.pulling = true
      c.setPointerCapture(e.pointerId)
    })
    c.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.pid) return
      const dy = e.clientY - this.sy
      const dx = e.clientX - this.sx
      const R = Math.min(window.innerWidth, window.innerHeight) * 0.32
      this.state.power = Math.max(0, Math.min(1, dy / R))
      this.state.yaw = Math.max(-1, Math.min(1, dx / R))
    })
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.pid) return
      this.pid = null
      this.state.pulling = false
      if (this.state.power > 0.12) {
        this.onRelease?.(this.state.power, this.state.yaw, zoneCenter(this.t))
      }
      this.state.power = 0
      this.state.yaw = 0
    }
    c.addEventListener('pointerup', end)
    c.addEventListener('pointercancel', end)
    // Keyboard: hold space to pull, release to fling.
    let holding = false
    window.addEventListener('keydown', (e) => {
      if (!this.enabled || e.code !== 'Space' || holding) return
      holding = true
      this.state.pulling = true
      this.state.power = 0
    })
    window.addEventListener('keyup', (e) => {
      if (!this.enabled || e.code !== 'Space' || !holding) return
      holding = false
      this.state.pulling = false
      this.onRelease?.(this.state.power, 0, zoneCenter(this.t))
      this.state.power = 0
    })
    this.keyboardPull = () => {
      if (holding) this.state.power = Math.min(1, this.state.power + 0.9 / 60)
    }
  }
  private keyboardPull: () => void = () => {}

  show(on: boolean, coins = 0, best = 0): void {
    this.root.classList.toggle('hidden', !on)
    this.enabled = on
    this.coins.textContent = fmt(coins)
    this.best.textContent = `best ${fmt(best)} m`
    if (on) this.t = 0
    this.pid = null
    this.state = { power: 0, yaw: 0, pulling: false }
  }

  setTutorialHint(text: string | null): void {
    this.hint.textContent = text ?? 'then: hold anywhere to climb · let go to glide · hold BOOST through storms'
  }

  update(dt: number): void {
    this.t += dt
    this.keyboardPull()
    const c = zoneCenter(this.t)
    this.zone.style.left = `${(c - ZONE_HALF_WIDTH) * 100}%`
    this.marker.style.left = `${this.state.power * 100}%`
    this.fill.style.width = `${this.state.power * 100}%`
    this.title.textContent = this.state.pulling ? (Math.abs(this.state.power - c) <= ZONE_HALF_WIDTH ? 'RELEASE!' : 'PULL…') : 'PULL TO FLING'
    this.title.style.color = this.state.pulling && Math.abs(this.state.power - c) <= ZONE_HALF_WIDTH ? 'var(--butter)' : '#fff'
  }

  bindHangar(fn: () => void): void {
    onTap(this.hangarBtn, fn)
  }
}
