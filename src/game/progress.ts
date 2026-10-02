/**
 * Progression runtime (GDD §9): missions (3 slots, auto-replace, difficulty
 * from floor(completed/3), reward (30 + 0.09·best + 12·lvl)·k), daily chest
 * with streak ×1.25/day to 2.5×, achievements over lifetime stats, titles.
 * Ported from the prototype's genMission/ensureMissions/missionsTick/openChest
 * onto the registries.
 */

import { MISSIONS, ACHIEVEMENTS } from '../data/registry'
import type { MissionDef } from '../data/define'
import type { Economy } from './economy'
import type { RunStats } from './run'
import { events } from './events'
import { Rng, freshSeed } from '../world/rng'

export interface MissionSlot {
  id: string
  target: number
  progress: number
  done: boolean
}

export class Progress {
  constructor(private eco: Economy) {
    this.ensureMissions()
  }

  // --- missions --------------------------------------------------------------
  private get slots(): MissionSlot[] {
    return this.eco.data.v4.missions
  }

  private tier(): number {
    return Math.floor(this.eco.data.v4.missionsCompleted / 3)
  }

  reward(def: Readonly<MissionDef>): number {
    const best = this.eco.data.bestDistance
    return Math.round((30 + 0.09 * best + 12 * this.tier()) * def.k)
  }

  ensureMissions(): void {
    const slots = this.slots
    const rng = new Rng(freshSeed())
    const all = [...MISSIONS.values()]
    while (slots.length < 3) {
      const used = new Set(slots.map((s) => s.id))
      const candidates = all.filter((m) => !used.has(m.id))
      const def = rng.pick(candidates.length ? candidates : all)
      slots.push({ id: def.id, target: def.target({ tier: this.tier(), best: this.eco.data.bestDistance }), progress: 0, done: false })
    }
  }

  describe(slot: MissionSlot): { text: string; icon: string; reward: number } {
    const def = MISSIONS.get(slot.id)
    if (!def) return { text: slot.id, icon: '▫️', reward: 0 }
    return { text: def.describe(slot.target), icon: def.icon, reward: this.reward(def) }
  }

  /** Live progress during a run (for the HUD). Lifetime missions add the run delta to the stored progress. */
  liveProgress(slot: MissionSlot, run: RunStats): number {
    const def = MISSIONS.get(slot.id)
    if (!def) return 0
    const v = (run as unknown as Record<string, number>)[def.stat] ?? 0
    return def.mode === 'run' ? Math.max(slot.progress, v) : slot.progress + v
  }

  /** At run end: fold the run into the slots, pay out completed ones, replace them. Returns completions. */
  settleRun(run: RunStats): Array<{ id: string; title: string; reward: number }> {
    const done: Array<{ id: string; title: string; reward: number }> = []
    for (const slot of this.slots) {
      const def = MISSIONS.get(slot.id)
      if (!def || slot.done) continue
      const v = (run as unknown as Record<string, number>)[def.stat] ?? 0
      slot.progress = def.mode === 'run' ? Math.max(slot.progress, v) : slot.progress + v
      if (slot.progress >= slot.target) {
        slot.done = true
        const reward = this.reward(def)
        this.eco.addCoins(reward)
        this.eco.data.v4.missionsCompleted++
        this.eco.bump('missions', 1)
        const title = def.describe(slot.target)
        done.push({ id: slot.id, title, reward })
        events.emit('mission:complete', { id: slot.id, reward, title })
      }
    }
    // Replace completed slots.
    this.eco.data.v4.missions = this.slots.filter((s) => !s.done)
    this.ensureMissions()
    return done
  }

  // --- daily chest ---------------------------------------------------------------
  private dayKey(d = new Date()): string {
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
  }

  chestReady(): boolean {
    return this.eco.data.lastChestDate !== this.dayKey()
  }

  chestStreakNext(): number {
    const yesterday = this.dayKey(new Date(Date.now() - 864e5))
    return this.eco.data.lastChestDate === yesterday ? this.eco.data.dailyStreak + 1 : 1
  }

  chestMultiplier(streak: number): number {
    return Math.min(2.5, Math.pow(1.25, Math.max(0, streak - 1)))
  }

  chestPreview(): number {
    const base = 40 + 0.05 * this.eco.data.bestDistance + 6 * this.eco.totalLevel()
    return Math.round(base * this.chestMultiplier(this.chestStreakNext()))
  }

  untilMidnight(): string {
    const n = new Date()
    const m = new Date(n)
    m.setHours(24, 0, 0, 0)
    const mins = Math.ceil((m.getTime() - n.getTime()) / 6e4)
    return `${Math.floor(mins / 60)}h ${mins % 60}m`
  }

  openChest(): number {
    if (!this.chestReady()) return 0
    const streak = this.chestStreakNext()
    const coins = this.chestPreview()
    this.eco.data.lastChestDate = this.dayKey()
    this.eco.data.dailyStreak = streak
    this.eco.data.streakMultiplier = this.chestMultiplier(streak)
    this.eco.addCoins(coins)
    this.eco.bump('chests', 1)
    this.eco.commit()
    events.emit('chest:open', { coins, streak })
    return coins
  }

  // --- achievements ---------------------------------------------------------------
  /** Check all achievements against lifetime stats; grant new ones. */
  checkAchievements(): Array<{ id: string; title: string; reward: number }> {
    const out: Array<{ id: string; title: string; reward: number }> = []
    const flags = this.eco.data.v4.achievements
    for (const a of ACHIEVEMENTS.values()) {
      if (flags[a.id]) continue
      if (this.eco.lifetime(a.stat) >= a.threshold) {
        flags[a.id] = true
        this.eco.addCoins(a.reward)
        if (a.grantsTitle && !this.eco.data.v4.titles.includes(a.grantsTitle)) this.eco.data.v4.titles.push(a.grantsTitle)
        out.push({ id: a.id, title: a.title, reward: a.reward })
        events.emit('achievement', { id: a.id, reward: a.reward, title: a.title })
      }
    }
    if (out.length) this.eco.commit()
    return out
  }

  achievementProgress(stat: string): number {
    return this.eco.lifetime(stat)
  }

  currentTitle(): string | null {
    const t = this.eco.data.v4.titles
    return t.length ? t[t.length - 1] : null
  }
}
