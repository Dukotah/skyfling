/**
 * In-flight HUD: distance + best bar + mission tracker left; coins/speed/
 * chips right; fuel + shields bottom-left; boost ring bottom-right (owned by
 * Controls); storm warning chip; combo and multiplier readouts.
 */

import { el, uiRoot, fmt } from './dom'

export interface HudState {
  distance: number
  best: number
  coins: number
  speed: number
  fuelFrac: number
  shields: number
  combo: number
  mult: number
  multT: number
  warning: string | null
  missions: Array<{ text: string; progress: number; target: number; done: boolean }>
  ghostDelta: number | null
  biome: string
}

export class Hud {
  root: HTMLDivElement
  private dist: HTMLSpanElement
  private bestBar: HTMLDivElement
  private bestLabel: HTMLDivElement
  private coins: HTMLDivElement
  private speed: HTMLDivElement
  private ghost: HTMLDivElement
  private fuelBar: HTMLDivElement
  private shields: HTMLDivElement
  private warn: HTMLDivElement
  private combo: HTMLDivElement
  private mult: HTMLDivElement
  private missions: HTMLDivElement
  pauseBtn: HTMLButtonElement
  private lastMissionsKey = ''

  constructor() {
    this.root = el('div', 'hidden')
    this.root.id = 'hud'
    const top = el('div', 'hud-top')
    const left = el('div')
    const distWrap = el('div', 'hud-dist display')
    this.dist = el('span', '', '0')
    distWrap.append(this.dist, el('small', '', 'm'))
    this.bestBar = el('div', 'hud-best', '<div></div>')
    this.bestLabel = el('div', 'hud-best-label shadow', 'best 0 m')
    left.append(distWrap, this.bestBar, this.bestLabel)
    const right = el('div', 'hud-right')
    this.coins = el('div', 'chip coin', '0')
    this.speed = el('div', 'chip', '0 <small>m/s</small>')
    this.ghost = el('div', 'chip hidden')
    right.append(this.coins, this.speed, this.ghost)
    top.append(left, right)
    this.missions = el('div', 'hud-mission shadow')
    this.pauseBtn = el('button', 'pause')
    this.pauseBtn.setAttribute('aria-label', 'Pause')
    const bottom = el('div', 'hud-bottom')
    const fuel = el('div', 'fuel')
    fuel.append(el('label', '', 'FUEL'))
    this.fuelBar = el('div', 'bar', '<div></div>')
    this.shields = el('div', 'shields')
    fuel.append(this.fuelBar, this.shields)
    bottom.append(fuel, el('div'))
    this.warn = el('div', 'warn hidden')
    this.combo = el('div', 'combo')
    this.mult = el('div', 'mult')
    this.root.append(top, this.missions, this.pauseBtn, bottom, this.warn, this.combo, this.mult)
    uiRoot().appendChild(this.root)
  }

  show(on: boolean): void {
    this.root.classList.toggle('hidden', !on)
  }

  update(s: HudState): void {
    this.dist.textContent = fmt(s.distance)
    const atBest = s.best > 0 && s.distance > s.best
    this.dist.style.color = atBest ? 'var(--mint)' : '#fff'
    ;(this.bestBar.firstElementChild as HTMLElement).style.width = `${s.best > 0 ? Math.min(100, (s.distance / s.best) * 100) : 0}%`
    this.bestLabel.textContent = atBest ? `+${fmt(s.distance - s.best)} m past best` : `best ${fmt(s.best)} m`
    this.coins.textContent = fmt(s.coins)
    this.speed.innerHTML = `${fmt(s.speed)} <small>m/s</small>`
    if (s.ghostDelta === null) this.ghost.classList.add('hidden')
    else {
      this.ghost.classList.remove('hidden')
      this.ghost.textContent = `${s.ghostDelta >= 0 ? '+' : ''}${fmt(s.ghostDelta)} m vs ghost`
      this.ghost.style.color = s.ghostDelta >= 0 ? 'var(--mint)' : 'var(--coral)'
    }
    ;(this.fuelBar.firstElementChild as HTMLElement).style.width = `${Math.max(0, Math.min(100, s.fuelFrac * 100))}%`
    if (this.shields.childElementCount !== s.shields) {
      this.shields.innerHTML = ''
      for (let i = 0; i < s.shields; i++) this.shields.appendChild(el('i'))
    }
    if (s.warning) {
      this.warn.textContent = s.warning
      this.warn.classList.remove('hidden')
    } else this.warn.classList.add('hidden')
    this.combo.textContent = `×${s.combo}`
    this.combo.classList.toggle('on', s.combo >= 2)
    this.mult.textContent = `×${s.mult} ${s.multT.toFixed(0)}s`
    this.mult.classList.toggle('on', s.mult > 1)
    const key = s.missions.map((m) => `${m.text}|${Math.floor(m.progress)}|${m.done}`).join('/')
    if (key !== this.lastMissionsKey) {
      this.lastMissionsKey = key
      this.missions.innerHTML = s.missions
        .slice(0, 3)
        .map((m) => `<div>${m.done ? '✅' : '▫️'} ${m.text} <b>${fmt(Math.min(m.progress, m.target))}/${fmt(m.target)}</b></div>`)
        .join('')
    }
  }
}
