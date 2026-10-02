/**
 * RunState — plain serialisable data for one flight (ARCHITECTURE §3), plus
 * the per-run stats missions read. No three.js.
 */

import type { FlightState } from '../sim/flight'

export interface RunStats {
  dist: number
  coins: number
  rings: number
  alt: number
  air: number
  pstreak: number
  landPast: number
  boostT: number
  cans: number
  therms: number
  balloons: number
  near: number
  bestCombo: number
  broke: number
  tricks: number
  biomeIdx: number
  shieldsUsed: number
  stars: number
  gatesPerfect: number
}

export function freshStats(): RunStats {
  return {
    dist: 0, coins: 0, rings: 0, alt: 0, air: 0, pstreak: 0, landPast: 0, boostT: 0, cans: 0, therms: 0,
    balloons: 0, near: 0, bestCombo: 0, broke: 0, tricks: 0, biomeIdx: 1, shieldsUsed: 0, stars: 0, gatesPerfect: 0,
  }
}

export interface RunState {
  seed: number
  plane: string
  flight: FlightState
  stats: RunStats
  /** Coins earned this run (raw count before multipliers are applied at results). */
  coinsRaw: number
  /** Running coin multiplier from ×2 star / golden chain and its remaining seconds. */
  mult: number
  multT: number
  /** Combo counter: consecutive pickups within the window. */
  combo: number
  comboT: number
  comboBonus: number
  /** Invulnerability seconds remaining (tricks, bounce). */
  invuln: number
  /** Storm fronts broken this run (indices). */
  broken: number[]
  /** Elapsed flight time. */
  t: number
  /** Bonuses to list on the results card. */
  bonuses: Array<{ label: string; coins: number }>
  /** Biomes entered (ids). */
  biomes: string[]
  /** Set once the run has ended. */
  ended: boolean
  endKind: 'land' | 'splash' | 'crash' | 'bounce' | null
  /** Phoenix revive used. */
  revived: boolean
  /** Launch grade (for the results headline). */
  launchGrade: 'perfect' | 'good' | 'none'
}

export function newRun(seed: number, plane: string, flight: FlightState): RunState {
  return {
    seed, plane, flight, stats: freshStats(), coinsRaw: 0, mult: 1, multT: 0, combo: 0, comboT: 0, comboBonus: 0,
    invuln: 0, broken: [], t: 0, bonuses: [], biomes: [], ended: false, endKind: null, revived: false, launchGrade: 'none',
  }
}
