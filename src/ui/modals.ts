/**
 * Modals: pause, settings (sound, music, invert, quality, control scheme,
 * left-handed, large text, reduced motion, export/import), tutorial cards,
 * evolve ceremony overlay, debug stats.
 */

import { el, uiRoot, onTap } from './dom'

export interface SettingsModel {
  sound: boolean
  music: boolean
  haptics: boolean
  invert: boolean
  scheme: 'glide' | 'pilot'
  quality: 'auto' | 'low' | 'medium' | 'high'
  leftHanded: boolean
  largeText: boolean
  reducedMotion: boolean
}

export class Modals {
  private pauseEl: HTMLDivElement
  private settingsEl: HTMLDivElement
  private tutEl: HTMLDivElement
  private evolveEl: HTMLDivElement
  private statsEl: HTMLDivElement
  onResume: (() => void) | null = null
  onQuit: (() => void) | null = null
  onSettingsChange: ((s: SettingsModel) => void) | null = null
  onExport: (() => string) | null = null
  onImport: ((code: string) => string | null) | null = null
  onReset: (() => void) | null = null
  private settings: SettingsModel | null = null
  private tutStep = 0
  private tutDone: (() => void) | null = null

  constructor() {
    const root = uiRoot()
    this.pauseEl = el('div', 'screen modal hidden')
    this.settingsEl = el('div', 'screen modal hidden')
    this.tutEl = el('div', 'screen modal hidden')
    this.evolveEl = el('div', 'hidden')
    this.evolveEl.id = 'evolve'
    this.statsEl = el('div', 'stats hidden')
    root.append(this.pauseEl, this.settingsEl, this.tutEl, this.evolveEl, this.statsEl)
  }

  // --- pause ---------------------------------------------------------------
  showPause(on: boolean): void {
    this.pauseEl.classList.toggle('hidden', !on)
    if (!on) return
    this.pauseEl.innerHTML = ''
    const card = el('div', 'modal-card')
    card.appendChild(el('h2', '', 'PAUSED'))
    const resume = el('button', 'btn primary', 'RESUME')
    const settings = el('button', 'btn secondary', 'SETTINGS')
    const quit = el('button', 'btn secondary small', 'END FLIGHT')
    onTap(resume, () => this.onResume?.())
    onTap(settings, () => this.showSettings(true))
    onTap(quit, () => this.onQuit?.())
    card.append(resume, settings, quit)
    this.pauseEl.appendChild(card)
  }

  // --- settings --------------------------------------------------------------
  setSettings(s: SettingsModel): void {
    this.settings = s
  }

  showSettings(on: boolean): void {
    this.settingsEl.classList.toggle('hidden', !on)
    if (!on || !this.settings) return
    const s = this.settings
    this.settingsEl.innerHTML = ''
    const card = el('div', 'modal-card')
    card.style.maxHeight = '86vh'
    card.style.overflow = 'auto'
    card.appendChild(el('h2', '', 'SETTINGS'))
    const toggle = (label: string, key: keyof SettingsModel) => {
      const row = el('div', 'setting')
      row.appendChild(el('span', '', label))
      const t = el('button', `toggle ${s[key] ? 'on' : ''}`)
      onTap(t, () => {
        ;(s as unknown as Record<string, unknown>)[key] = !s[key]
        t.classList.toggle('on', !!s[key])
        this.onSettingsChange?.(s)
      })
      row.appendChild(t)
      card.appendChild(row)
    }
    const seg = <K extends keyof SettingsModel>(label: string, key: K, options: Array<[SettingsModel[K], string]>) => {
      const row = el('div', 'setting')
      row.appendChild(el('span', '', label))
      const wrap = el('div', 'seg')
      for (const [v, text] of options) {
        const b = el('button', s[key] === v ? 'on' : '', text)
        onTap(b, () => {
          s[key] = v
          wrap.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b))
          this.onSettingsChange?.(s)
        })
        wrap.appendChild(b)
      }
      row.appendChild(wrap)
      card.appendChild(row)
    }
    toggle('Sound', 'sound')
    toggle('Music', 'music')
    seg('Controls', 'scheme', [['glide', 'GLIDE'], ['pilot', 'PILOT']])
    toggle('Invert pitch', 'invert')
    toggle('Left-handed boost', 'leftHanded')
    seg('Quality', 'quality', [['auto', 'AUTO'], ['low', 'LOW'], ['medium', 'MED'], ['high', 'HIGH']])
    toggle('Large text', 'largeText')
    toggle('Reduced motion', 'reducedMotion')
    toggle('Haptics (Android)', 'haptics')
    // Export / import
    const exp = el('div')
    exp.appendChild(el('p', '', '<b>Save code</b> — copy this to move your progress to another device.'))
    const ta = el('textarea', 'code')
    ta.readOnly = false
    ta.value = this.onExport?.() ?? ''
    ta.addEventListener('pointerdown', (e) => e.stopPropagation())
    exp.appendChild(ta)
    const row = el('div', 'res-actions')
    const copy = el('button', 'btn secondary small', 'COPY')
    const imp = el('button', 'btn mint small', 'IMPORT PASTED CODE')
    onTap(copy, async () => {
      try {
        await navigator.clipboard.writeText(ta.value)
        copy.textContent = 'COPIED'
      } catch {
        ta.select()
      }
    })
    onTap(imp, () => {
      const err = this.onImport?.(ta.value) ?? 'Import not available'
      imp.textContent = err ? 'INVALID CODE' : 'IMPORTED ✓'
      if (!err) setTimeout(() => this.showSettings(false), 600)
    })
    row.append(copy, imp)
    exp.appendChild(row)
    card.appendChild(exp)
    const reset = el('button', 'btn secondary small', 'RESET PROGRESS')
    onTap(reset, () => {
      if (confirm('Erase all progress on this device?')) this.onReset?.()
    })
    const close = el('button', 'btn primary', 'DONE')
    onTap(close, () => this.showSettings(false))
    card.append(reset, close)
    this.settingsEl.appendChild(card)
  }

  // --- tutorial ---------------------------------------------------------------
  showTutorial(onDone: () => void): void {
    this.tutStep = 0
    this.tutDone = onDone
    this.renderTut()
    this.tutEl.classList.remove('hidden')
  }

  private renderTut(): void {
    const steps = [
      { pic: '🏹', h: 'PULL & TIME IT', p: 'Drag down to pull the slingshot. Release when the marker is in the gold zone for a PERFECT launch.' },
      { pic: '👆', h: 'HOLD TO CLIMB', p: 'Hold anywhere to pull the nose up. Let go to glide. Drag sideways while holding to bank.' },
      { pic: '⛈️', h: 'BOOST THROUGH STORMS', p: 'Storm walls slow you down. Hold BOOST to punch through, grab rings and coins, then upgrade in the hangar.' },
    ]
    const s = steps[this.tutStep]
    this.tutEl.innerHTML = ''
    const card = el('div', 'modal-card tut')
    card.innerHTML = `<div class="pic">${s.pic}</div><h2>${s.h}</h2><p>${s.p}</p><div class="dots">${steps.map((_, i) => `<i class="${i === this.tutStep ? 'on' : ''}"></i>`).join('')}</div>`
    const next = el('button', 'btn primary', this.tutStep === steps.length - 1 ? "LET'S FLY" : 'NEXT')
    onTap(next, () => {
      this.tutStep++
      if (this.tutStep >= steps.length) {
        this.tutEl.classList.add('hidden')
        this.tutDone?.()
      } else this.renderTut()
    })
    card.appendChild(next)
    this.tutEl.appendChild(card)
  }

  // --- evolve ---------------------------------------------------------------
  showEvolve(name: string, trait: string, onDone: () => void): void {
    this.evolveEl.classList.remove('hidden')
    this.evolveEl.innerHTML = `<div class="big">EVOLVED</div><div class="name">${name}</div><div class="trait">${trait}</div>`
    const b = el('button', 'btn primary', 'CONTINUE')
    onTap(b, () => {
      this.evolveEl.classList.add('hidden')
      onDone()
    })
    this.evolveEl.appendChild(b)
  }

  // --- stats ------------------------------------------------------------------
  showStats(on: boolean): void {
    this.statsEl.classList.toggle('hidden', !on)
  }
  setStats(text: string): void {
    this.statsEl.textContent = text
  }
}
