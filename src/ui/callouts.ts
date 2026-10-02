/**
 * Callouts, banners and toasts (GDD §12), driven by the event bus.
 */

import { events } from '../core/events'
import { el, uiRoot, fmt } from './dom'

export class Callouts {
  private callout: HTMLDivElement
  private banner: HTMLDivElement
  private toastEl: HTMLDivElement
  private bannerTO = 0
  private toastTO = 0
  private offs: Array<() => void> = []
  haptics = true

  constructor() {
    const root = uiRoot()
    this.callout = el('div', 'callout display')
    this.banner = el('div', 'banner')
    this.toastEl = el('div', 'toast')
    root.append(this.callout, this.banner, this.toastEl)
    this.bind()
  }

  show(text: string, kind: 'gold' | 'mint' | 'coral' | 'white' = 'white'): void {
    this.callout.className = 'callout display'
    void this.callout.offsetWidth
    this.callout.textContent = text
    this.callout.className = `callout display go ${kind}`
  }

  bannerShow(text: string, coins: number): void {
    this.banner.innerHTML = `<span>${text}</span>${coins > 0 ? `<b><i class="coin"></i>+${fmt(coins)}</b>` : ''}`
    this.banner.classList.add('on')
    clearTimeout(this.bannerTO)
    this.bannerTO = window.setTimeout(() => this.banner.classList.remove('on'), 2400)
  }

  toast(text: string): void {
    this.toastEl.textContent = text
    this.toastEl.classList.add('on')
    clearTimeout(this.toastTO)
    this.toastTO = window.setTimeout(() => this.toastEl.classList.remove('on'), 1900)
  }

  private bind(): void {
    const on = events.on.bind(events)
    this.offs.push(
      on('callout', (e) => this.show(e.text, e.kind)),
      on('launch', (e) => {
        if (e.grade === 'perfect') this.show(e.streak > 1 ? `PERFECT ×${e.streak}` : 'PERFECT', 'gold')
        else if (e.grade === 'good') this.show('GOOD', 'mint')
      }),
      on('softwall:break', (e) => {
        this.show(e.kind === 'storm-front' ? 'STORM BROKEN' : e.kind === 'headwind-gate' ? 'GATE PERFECT' : 'PUSHED THROUGH', 'gold')
        if (e.bonus > 0) this.bannerShow(e.first ? 'FIRST BREAK!' : 'BREAKTHROUGH', e.bonus)
      }),
      on('hazard', (e) => {
        if (e.shieldAbsorbed) this.show('SHIELD!', 'mint')
      }),
      on('combo', (e) => {
        if (e.count >= 5 && e.count % 5 === 0) this.show(`COMBO ×${e.count}`, 'mint')
      }),
      on('trick', (e) => this.show(e.kind === 'barrel' ? 'BARREL ROLL' : 'LOOP!', 'coral')),
      on('biome:enter', () => {
        /* biome name toast is emitted by the game with the tagline */
      }),
      on('mission:complete', (e) => this.bannerShow(`MISSION: ${e.title}`, e.reward)),
      on('achievement', (e) => this.bannerShow(`ACHIEVEMENT: ${e.title}`, e.reward)),
      on('evolve', () => this.show('EVOLVED!', 'gold')),
      on('land', (e) => {
        if (e.kind === 'land' && e.bullseye > 0) this.show(e.bullseye >= 3 ? 'BULLSEYE!' : 'CLEAN LANDING', e.bullseye >= 3 ? 'gold' : 'mint')
      }),
    )
  }

  dispose(): void {
    this.offs.forEach((f) => f())
  }
}
