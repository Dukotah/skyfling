/**
 * Results card: headline, count-up distance, coins breakdown with bonuses and
 * mission payouts, "+X past best", FLY AGAIN / HANGAR / SHARE.
 */

import { el, uiRoot, fmt, countUp, onTap } from './dom'
import type { RunSummary } from '../core/events'

export interface ResultsExtras {
  missions: Array<{ title: string; reward: number }>
  achievements: Array<{ title: string; reward: number }>
  total: number
  multiplierNote: string | null
}

export class ResultsScreen {
  root: HTMLDivElement
  private head: HTMLDivElement
  private dist: HTMLSpanElement
  private best: HTMLDivElement
  private card: HTMLDivElement
  againBtn: HTMLButtonElement
  hangarBtn: HTMLButtonElement
  shareBtn: HTMLButtonElement

  constructor() {
    this.root = el('div', 'hidden')
    this.root.id = 'results'
    this.head = el('div', 'res-head display', 'NICE FLIGHT')
    const d = el('div', 'res-dist display')
    this.dist = el('span', '', '0')
    d.append(this.dist, el('small', '', 'm'))
    this.best = el('div', 'res-best shadow')
    this.card = el('div', 'res-card')
    const actions = el('div', 'res-actions')
    this.hangarBtn = el('button', 'btn secondary', 'HANGAR')
    this.againBtn = el('button', 'btn primary', 'FLY AGAIN')
    this.shareBtn = el('button', 'btn secondary small', 'SHARE')
    actions.append(this.hangarBtn, this.againBtn)
    this.root.append(this.head, d, this.best, this.card, actions, this.shareBtn)
    uiRoot().appendChild(this.root)
  }

  show(summary: RunSummary, extras: ResultsExtras): void {
    this.root.classList.remove('hidden')
    this.head.textContent = summary.landKind === 'crash' ? 'CRASHED' : summary.landKind === 'splash' ? 'SPLASHDOWN' : summary.newBest ? 'NEW BEST!' : summary.perfect ? 'PERFECT FLIGHT' : 'NICE FLIGHT'
    this.head.style.color = summary.newBest ? 'var(--butter)' : summary.landKind === 'crash' ? 'var(--coral)' : '#fff'
    countUp(this.dist, summary.distance, 900)
    this.best.textContent = summary.newBest ? `★ +${fmt(summary.distance - summary.prevBest)} m past your best` : `best ${fmt(summary.prevBest)} m`
    const rows: string[] = []
    const line = (k: string, v: number, cls = '') => rows.push(`<div class="row ${cls}"><span>${k}</span><span><i class="coin"></i><b data-v="${v}">0</b></span></div>`)
    line('Coins collected', summary.coinsBase)
    for (const b of summary.bonuses) line(b.label, b.coins, 'bonus')
    for (const m of extras.missions) line(`Mission: ${m.title}`, m.reward, 'mission')
    for (const a of extras.achievements) line(`Achievement: ${a.title}`, a.reward, 'mission')
    if (extras.multiplierNote) rows.push(`<div class="row"><span style="opacity:.8">${extras.multiplierNote}</span><span></span></div>`)
    line('Total', extras.total, 'total')
    this.card.innerHTML = rows.join('')
    let delay = 200
    this.card.querySelectorAll<HTMLElement>('b[data-v]').forEach((b) => {
      const v = Number(b.dataset.v)
      setTimeout(() => countUp(b, v, 700), delay)
      delay += 120
    })
  }

  hide(): void {
    this.root.classList.add('hidden')
  }

  bind(again: () => void, hangar: () => void, share: () => void): void {
    onTap(this.againBtn, again)
    onTap(this.hangarBtn, hangar)
    onTap(this.shareBtn, share)
  }
}
