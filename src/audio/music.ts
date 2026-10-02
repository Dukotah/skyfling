/**
 * Generative music beds per biome mood (WebAudio). No reachable CC music
 * source from the build container, so each mood is a small pad + arpeggio
 * generator: a chord progression, a slow filtered pad, a plucked arp, and a
 * soft kick/noise pulse for the energetic moods. Crossfades between moods.
 */

export type Mood = 'meadow' | 'canyon' | 'coast' | 'dunes' | 'alpine' | 'tundra' | 'volcano' | 'city' | 'isles' | 'jungle' | 'thunder' | 'strato' | 'hangar'

interface MoodDef {
  /** Root MIDI note. */
  root: number
  /** Scale intervals. */
  scale: number[]
  /** Chord progression as scale degrees. */
  chords: number[][]
  bpm: number
  pad: OscillatorType
  arp: OscillatorType
  arpRate: number // notes per beat
  cutoff: number
  pulse: boolean
  brightness: number
}

const MOODS: Record<Mood, MoodDef> = {
  meadow: { root: 60, scale: [0, 2, 4, 7, 9], chords: [[0, 2, 4], [3, 5, 0], [4, 6, 1], [3, 5, 0]], bpm: 92, pad: 'triangle', arp: 'sine', arpRate: 2, cutoff: 1800, pulse: false, brightness: 0.8 },
  canyon: { root: 57, scale: [0, 2, 3, 7, 10], chords: [[0, 2, 4], [2, 4, 6], [0, 2, 4], [3, 5, 0]], bpm: 100, pad: 'sawtooth', arp: 'triangle', arpRate: 2, cutoff: 1200, pulse: true, brightness: 0.6 },
  coast: { root: 62, scale: [0, 2, 4, 5, 7, 9, 11], chords: [[0, 2, 4, 6], [3, 5, 0], [4, 6, 1], [5, 0, 2]], bpm: 88, pad: 'sine', arp: 'sine', arpRate: 3, cutoff: 2400, pulse: false, brightness: 0.9 },
  dunes: { root: 55, scale: [0, 1, 4, 5, 7, 8, 10], chords: [[0, 2, 4], [1, 3, 5], [0, 2, 4], [4, 6, 1]], bpm: 84, pad: 'sawtooth', arp: 'triangle', arpRate: 1, cutoff: 900, pulse: true, brightness: 0.5 },
  alpine: { root: 64, scale: [0, 2, 4, 7, 9], chords: [[0, 2, 4], [4, 6, 1], [3, 5, 0], [0, 2, 4]], bpm: 96, pad: 'triangle', arp: 'square', arpRate: 2, cutoff: 1500, pulse: false, brightness: 0.85 },
  tundra: { root: 59, scale: [0, 2, 3, 5, 7, 8, 10], chords: [[0, 2, 4], [5, 0, 2], [3, 5, 0], [0, 2, 4]], bpm: 70, pad: 'sine', arp: 'sine', arpRate: 1, cutoff: 1400, pulse: false, brightness: 0.95 },
  volcano: { root: 50, scale: [0, 1, 3, 5, 6, 8, 10], chords: [[0, 2, 4], [1, 3, 5], [0, 2, 4], [2, 4, 6]], bpm: 108, pad: 'sawtooth', arp: 'sawtooth', arpRate: 4, cutoff: 800, pulse: true, brightness: 0.4 },
  city: { root: 57, scale: [0, 2, 3, 5, 7, 9, 10], chords: [[0, 2, 4, 6], [3, 5, 0, 2], [4, 6, 1], [1, 3, 5]], bpm: 112, pad: 'square', arp: 'square', arpRate: 4, cutoff: 1600, pulse: true, brightness: 0.7 },
  isles: { root: 65, scale: [0, 2, 4, 7, 9], chords: [[0, 2, 4], [3, 5, 0], [1, 3, 5], [4, 6, 1]], bpm: 90, pad: 'sine', arp: 'triangle', arpRate: 3, cutoff: 2600, pulse: false, brightness: 1 },
  jungle: { root: 55, scale: [0, 2, 3, 5, 7, 9, 10], chords: [[0, 2, 4], [3, 5, 0], [4, 6, 1], [3, 5, 0]], bpm: 104, pad: 'triangle', arp: 'square', arpRate: 4, cutoff: 1300, pulse: true, brightness: 0.7 },
  thunder: { root: 52, scale: [0, 2, 3, 5, 7, 8, 11], chords: [[0, 2, 4], [5, 0, 2], [3, 5, 0], [4, 6, 1]], bpm: 98, pad: 'sawtooth', arp: 'triangle', arpRate: 2, cutoff: 700, pulse: true, brightness: 0.45 },
  strato: { root: 67, scale: [0, 2, 4, 6, 7, 9, 11], chords: [[0, 2, 4, 6], [1, 3, 5], [4, 6, 1], [0, 2, 4]], bpm: 72, pad: 'sine', arp: 'sine', arpRate: 1, cutoff: 3000, pulse: false, brightness: 1 },
  hangar: { root: 60, scale: [0, 2, 4, 7, 9], chords: [[0, 2, 4], [3, 5, 0]], bpm: 80, pad: 'triangle', arp: 'sine', arpRate: 1, cutoff: 1400, pulse: false, brightness: 0.8 },
}

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12)

class Bed {
  gain: GainNode
  private filter: BiquadFilterNode
  private pads: OscillatorNode[] = []
  private padGains: GainNode[] = []
  private timer = 0
  private step = 0
  private chord = 0
  private alive = true

  constructor(private ctx: AudioContext, private def: MoodDef, out: AudioNode) {
    this.gain = ctx.createGain()
    this.gain.gain.value = 0
    this.filter = ctx.createBiquadFilter()
    this.filter.type = 'lowpass'
    this.filter.frequency.value = def.cutoff
    this.filter.Q.value = 0.7
    this.filter.connect(this.gain)
    this.gain.connect(out)
    // Pad: three detuned oscillators per chord note, retuned on chord change.
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator()
      o.type = def.pad
      const g = ctx.createGain()
      g.gain.value = 0.05
      o.connect(g)
      g.connect(this.filter)
      o.start()
      this.pads.push(o)
      this.padGains.push(g)
    }
    this.tuneChord(0)
    this.schedule()
  }

  private note(deg: number, octave = 0): number {
    const s = this.def.scale
    const o = Math.floor(deg / s.length)
    return this.def.root + s[((deg % s.length) + s.length) % s.length] + (o + octave) * 12
  }

  private tuneChord(i: number): void {
    const ch = this.def.chords[i % this.def.chords.length]
    const t = this.ctx.currentTime
    this.pads.forEach((o, k) => {
      const n = this.note(ch[k % ch.length], k === 0 ? -1 : 0)
      o.frequency.setTargetAtTime(midi(n) * (1 + (k - 1) * 0.0015), t, 0.4)
    })
  }

  private pluck(freq: number, when: number, vol: number, type: OscillatorType): void {
    const o = this.ctx.createOscillator()
    o.type = type
    o.frequency.value = freq
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0, when)
    g.gain.linearRampToValueAtTime(vol, when + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0005, when + 0.6)
    o.connect(g)
    g.connect(this.filter)
    o.start(when)
    o.stop(when + 0.7)
  }

  private thump(when: number): void {
    const o = this.ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(120, when)
    o.frequency.exponentialRampToValueAtTime(40, when + 0.18)
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.22, when)
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.25)
    o.connect(g)
    g.connect(this.gain)
    o.start(when)
    o.stop(when + 0.3)
  }

  private schedule(): void {
    if (!this.alive) return
    const beat = 60 / this.def.bpm
    const stepLen = beat / this.def.arpRate
    const now = this.ctx.currentTime
    // Schedule the next ~0.5 s of steps.
    const ahead = 0.5
    let t = this.timer || now
    while (t < now + ahead) {
      const stepsPerBar = 4 * this.def.arpRate
      const bar = Math.floor(this.step / stepsPerBar)
      const chordIdx = bar % this.def.chords.length
      if (chordIdx !== this.chord) {
        this.chord = chordIdx
        this.tuneChord(chordIdx)
      }
      const ch = this.def.chords[chordIdx]
      const inBar = this.step % stepsPerBar
      const deg = ch[inBar % ch.length] + (Math.floor(inBar / ch.length) % 2) * 7
      const octave = this.def.brightness > 0.75 ? 1 : 0
      if (inBar % 2 === 0 || this.def.arpRate >= 3) this.pluck(midi(this.note(deg, octave)), t, 0.07 * this.def.brightness, this.def.arp)
      if (this.def.pulse && inBar % this.def.arpRate === 0 && Math.floor(inBar / this.def.arpRate) % 2 === 0) this.thump(t)
      t += stepLen
      this.step++
    }
    this.timer = t
    setTimeout(() => this.schedule(), 200)
  }

  fade(to: number, seconds: number): void {
    const t = this.ctx.currentTime
    this.gain.gain.cancelScheduledValues(t)
    this.gain.gain.setTargetAtTime(to, t, seconds / 3)
  }

  stop(): void {
    this.alive = false
    this.fade(0, 1)
    setTimeout(() => {
      this.pads.forEach((o) => o.stop())
      this.gain.disconnect()
    }, 1500)
  }
}

export class Music {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private current: Bed | null = null
  private mood: Mood | null = null
  private _enabled = true
  private _volume = 0.5
  private duck = 1

  start(ctx: AudioContext): void {
    if (this.ctx) return
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = this._enabled ? this._volume : 0
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -18
    comp.ratio.value = 4
    this.master.connect(comp)
    comp.connect(ctx.destination)
    if (this.mood) this.play(this.mood, true)
  }

  set enabled(v: boolean) {
    this._enabled = v
    this.master?.gain.setTargetAtTime(v ? this._volume * this.duck : 0, this.ctx?.currentTime ?? 0, 0.3)
  }
  get enabled(): boolean {
    return this._enabled
  }
  set volume(v: number) {
    this._volume = v
    if (this._enabled) this.master?.gain.setTargetAtTime(v * this.duck, this.ctx?.currentTime ?? 0, 0.2)
  }

  /** Duck (e.g. crash) 0..1. */
  setDuck(d: number): void {
    this.duck = d
    if (this._enabled) this.master?.gain.setTargetAtTime(this._volume * d, this.ctx?.currentTime ?? 0, 0.15)
  }

  play(mood: Mood, force = false): void {
    if (mood === this.mood && !force) return
    this.mood = mood
    if (!this.ctx || !this.master) return
    const old = this.current
    if (old) old.stop()
    const bed = new Bed(this.ctx, MOODS[mood], this.master)
    bed.fade(1, 2.5)
    this.current = bed
  }

  stop(): void {
    this.current?.stop()
    this.current = null
    this.mood = null
  }
}

export const music = new Music()
