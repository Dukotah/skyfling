/**
 * Hangar screen: tabs Upgrades / Planes / Paint / Missions / More. Renders
 * from a model object the game provides and calls back on actions. The 3D
 * hangar view (plane on a turntable) is rendered by the game behind it.
 */

import { el, uiRoot, fmt, onTap } from './dom'
import type { UpgradeDef, PlaneDef, PaintDef, AchievementDef } from '../data/define'

export interface HangarModel {
  coins: number
  totalLevel: number
  plane: Readonly<PlaneDef>
  nextPlane: Readonly<PlaneDef> | null
  upgrades: Array<{ def: Readonly<UpgradeDef>; level: number; cost: number; affordable: boolean }>
  planes: Array<{ def: Readonly<PlaneDef>; unlocked: boolean; equipped: boolean }>
  paints: Array<{ def: Readonly<PaintDef>; unlocked: boolean; equipped: boolean; costText: string }>
  missions: Array<{ id: string; text: string; progress: number; target: number; reward: number; done: boolean; icon: string }>
  chest: { ready: boolean; streak: number; nextIn: string; preview: number }
  achievements: Array<{ def: Readonly<AchievementDef>; done: boolean; progress: number }>
  title: string | null
  best: number
  flights: number
  prestige: number
  canPrestige: boolean
}

export interface HangarActions {
  buy(id: string): void
  equipPlane(id: string): void
  equipPaint(id: string): void
  buyPaint(id: string): void
  openChest(): void
  fly(): void
  settings(): void
  prestige(): void
}

type Tab = 'upgrades' | 'planes' | 'paint' | 'missions' | 'more'

export class HangarScreen {
  root: HTMLDivElement
  private tab: Tab = 'upgrades'
  private panel: HTMLDivElement
  private tabs: HTMLDivElement
  private coinsEl: HTMLDivElement
  private title: HTMLDivElement
  private sub: HTMLDivElement
  private planeName: HTMLDivElement
  private evolveFill: HTMLDivElement
  private evolveLabel: HTMLDivElement
  private model: HangarModel | null = null

  constructor(private actions: HangarActions) {
    this.root = el('div', 'screen hangar hidden')
    const head = el('div', 'hangar-head')
    const titleWrap = el('div')
    this.title = el('div', 'title display', 'HANGAR')
    this.sub = el('div', 'sub', '')
    titleWrap.append(this.title, this.sub)
    this.coinsEl = el('div', 'chip coin', '0')
    head.append(titleWrap, this.coinsEl)
    this.planeName = el('div', 'plane-name shadow')
    const evolve = el('div')
    const bar = el('div', 'evolve-bar')
    this.evolveFill = el('div')
    bar.appendChild(this.evolveFill)
    this.evolveLabel = el('div', 'evolve-label')
    evolve.append(this.evolveLabel, bar)
    this.tabs = el('div', 'tabs')
    const tabDefs: Array<[Tab, string]> = [['upgrades', 'UPGRADES'], ['planes', 'PLANES'], ['paint', 'PAINT'], ['missions', 'MISSIONS'], ['more', 'MORE']]
    for (const [t, label] of tabDefs) {
      const b = el('button', t === this.tab ? 'on' : '', label)
      b.dataset.tab = t
      onTap(b, () => {
        this.tab = t
        this.render()
      })
      this.tabs.appendChild(b)
    }
    this.panel = el('div', 'panel')
    const foot = el('div', 'hangar-foot')
    const settings = el('button', 'btn secondary small', '⚙ SETTINGS')
    const fly = el('button', 'btn primary', 'FLY')
    onTap(settings, () => actions.settings())
    onTap(fly, () => actions.fly())
    foot.append(settings, fly)
    const spacer = el('div')
    spacer.style.flex = '0 0 24vh'
    this.root.append(head, spacer, this.planeName, evolve, this.tabs, this.panel, foot)
    uiRoot().appendChild(this.root)
  }

  show(on: boolean): void {
    this.root.classList.toggle('hidden', !on)
  }

  set(model: HangarModel): void {
    this.model = model
    this.render()
  }

  private render(): void {
    const m = this.model
    if (!m) return
    this.coinsEl.textContent = fmt(m.coins)
    this.sub.textContent = `${m.title ? m.title + ' · ' : ''}best ${fmt(m.best)} m · ${m.flights} flights${m.prestige ? ` · prestige ${m.prestige}` : ''}`
    this.planeName.innerHTML = `<div class="n">${m.plane.name}</div><div class="t">${m.plane.trait.blurb}</div>`
    if (m.nextPlane) {
      const span = m.nextPlane.unlockAt - m.plane.unlockAt
      const p = Math.min(1, (m.totalLevel - m.plane.unlockAt) / Math.max(1, span))
      this.evolveFill.style.width = `${p * 100}%`
      this.evolveLabel.innerHTML = `<span>Evolves into <b>${m.nextPlane.name}</b></span><span>Lv ${m.totalLevel} / ${m.nextPlane.unlockAt}</span>`
    } else {
      this.evolveFill.style.width = '100%'
      this.evolveLabel.innerHTML = `<span>Final form</span><span>Lv ${m.totalLevel}</span>`
    }
    this.tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.tab === this.tab))
    this.panel.innerHTML = ''
    switch (this.tab) {
      case 'upgrades':
        for (const u of m.upgrades) {
          const row = el('div', 'upg')
          row.innerHTML = `<div class="ic">${u.def.icon}</div><div class="body"><div class="name">${u.def.name}<small>Lv ${u.level}/${u.def.maxLevel}</small></div><div class="desc">${u.def.blurb}</div><div class="pips">${Array.from({ length: u.def.maxLevel }, (_, i) => `<i class="${i < u.level ? 'on' : ''}"></i>`).join('')}</div></div>`
          const buy = el('button', `buy ${u.level >= u.def.maxLevel ? 'max' : ''}`)
          if (u.level >= u.def.maxLevel) buy.textContent = 'MAX'
          else {
            buy.innerHTML = `<i class="coin"></i>${fmt(u.cost)}`
            buy.disabled = !u.affordable
          }
          onTap(buy, () => this.actions.buy(u.def.id))
          row.appendChild(buy)
          this.panel.appendChild(row)
        }
        break
      case 'planes': {
        const grid = el('div', 'grid')
        for (const p of m.planes) {
          const t = el('div', `tile plane-tile ${p.equipped ? 'on' : ''} ${p.unlocked ? '' : 'locked'}`)
          t.innerHTML = `<div class="tier">TIER ${p.def.tier}</div><div>${p.unlocked ? p.def.name : '🔒 ' + p.def.name}</div><div class="tier">${p.unlocked ? p.def.trait.id.replace('_', ' ') : `Lv ${p.def.unlockAt}`}</div>`
          if (p.unlocked) onTap(t, () => this.actions.equipPlane(p.def.id))
          grid.appendChild(t)
        }
        this.panel.appendChild(grid)
        break
      }
      case 'paint': {
        const grid = el('div', 'grid')
        for (const p of m.paints) {
          const t = el('div', `tile ${p.equipped ? 'on' : ''} ${p.unlocked ? '' : 'locked'}`)
          const sw = el('div', 'swatch')
          sw.style.background = `linear-gradient(135deg, ${p.def.primary} 0 50%, ${p.def.secondary} 50% 80%, ${p.def.accent} 80%)`
          t.appendChild(sw)
          t.appendChild(el('div', '', p.def.name))
          t.appendChild(el('div', 'tier', p.unlocked ? (p.equipped ? 'equipped' : 'tap to equip') : p.costText))
          onTap(t, () => (p.unlocked ? this.actions.equipPaint(p.def.id) : this.actions.buyPaint(p.def.id)))
          grid.appendChild(t)
        }
        this.panel.appendChild(grid)
        break
      }
      case 'missions': {
        const chest = el('div', `chest ${m.chest.ready ? 'ready' : ''}`)
        chest.innerHTML = `<div>${m.chest.ready ? '🎁 Daily chest ready!' : `📦 Next chest in ${m.chest.nextIn}`}<div style="font-size:11px;opacity:.8">streak ${m.chest.streak} · ×${(1.25 ** Math.min(4, Math.max(0, m.chest.streak - 1))).toFixed(2)} · ~${fmt(m.chest.preview)} coins</div></div>`
        const open = el('button', '', 'OPEN')
        open.disabled = !m.chest.ready
        onTap(open, () => this.actions.openChest())
        chest.appendChild(open)
        this.panel.appendChild(chest)
        for (const ms of m.missions) {
          const row = el('div', `mission ${ms.done ? 'done' : ''}`)
          row.innerHTML = `<div class="ic">${ms.icon}</div><div class="txt">${ms.text}<div class="bar"><div style="width:${Math.min(100, (ms.progress / ms.target) * 100)}%"></div></div></div><div class="rew"><i class="coin"></i>${fmt(ms.reward)}</div>`
          this.panel.appendChild(row)
        }
        break
      }
      case 'more': {
        const done = m.achievements.filter((a) => a.done).length
        this.panel.appendChild(el('div', 'setting', `<span>Achievements</span><span>${done} / ${m.achievements.length}</span>`))
        if (m.canPrestige) {
          const p = el('button', 'btn mint', 'RE-FOLD (PRESTIGE)')
          onTap(p, () => this.actions.prestige())
          this.panel.appendChild(p)
        }
        for (const a of m.achievements) {
          const row = el('div', `ach ${a.done ? 'done' : ''}`)
          row.innerHTML = `<div class="ic">${a.def.icon}</div><div><div class="t">${a.def.title}${a.def.grantsTitle ? ` · <i>${a.def.grantsTitle}</i>` : ''}</div><div class="d">${a.def.blurb} ${a.done ? '✓' : `(${fmt(Math.min(a.progress, a.def.threshold))}/${fmt(a.def.threshold)})`}</div></div>`
          this.panel.appendChild(row)
        }
        break
      }
    }
  }
}
