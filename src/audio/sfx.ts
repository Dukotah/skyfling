/**
 * src/audio/sfx.ts
 *
 * Synthesised sound-effects bank.
 *
 * All sounds are built from oscillators, gain envelopes and noise — zero
 * external assets required.  The AudioContext is lazily created on the first
 * call to play() so iOS autoplay restrictions are never violated.
 *
 * Public API
 * ----------
 *  sfx.play(id)      – fire-and-forget a one-shot effect
 *  sfx.muted         – get/set mute state (persists while the page is open)
 *  sfx.setMaster(v)  – set master volume 0..1 (default 0.7)
 *  sfx.ctx           – the shared AudioContext (null before first play)
 */

export type SfxId =
  | 'coin'
  | 'whoosh'
  | 'boost'
  | 'impact'
  | 'perfect'
  | 'evolve'
  | 'ui_tap'
  | 'ui_back'
  | 'ring'
  | 'fuel'
  | 'shield'
  | 'star'
  | 'pop'
  | 'crate'
  | 'fountain'
  | 'thermal'
  | 'bird'
  | 'cable'
  | 'ice'
  | 'thunder'
  | 'drone'
  | 'geyser'
  | 'land'
  | 'splash'
  | 'bounce'
  | 'chest'
  | 'buy'
  | 'mission'
  | 'warn'
  | 'roll'
  | 'storm_break'
  | 'gate'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

let _ctx: AudioContext | null = null
let _master: GainNode | null = null
let _muted = false
let _masterVol = 0.7

/** The AudioContext constructor, with the Safari/iOS webkit fallback. */
const ACtor: typeof AudioContext | undefined =
  typeof AudioContext !== 'undefined'
    ? AudioContext
    : (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

/** True on devices that actually have WebAudio. */
export const audioAvailable = !!ACtor

/** Lazily boot the AudioContext. Must be called from a user-gesture path. */
function ctx(): AudioContext {
  if (!_ctx) {
    _ctx = new ACtor!()
    _master = _ctx.createGain()
    _master.gain.setValueAtTime(_muted ? 0 : _masterVol, _ctx.currentTime)
    _master.connect(_ctx.destination)
  }
  if (_ctx.state === 'suspended') {
    void _ctx.resume()
  }
  return _ctx
}

function master(): GainNode {
  ctx() // ensure created
  return _master!
}

/** Create a GainNode already wired to master. */
function gainToMaster(initialGain = 0): GainNode {
  const g = ctx().createGain()
  g.gain.setValueAtTime(initialGain, ctx().currentTime)
  g.connect(master())
  return g
}

/**
 * One-pole lowpass biquad shorthand.
 */
function lpf(frequency: number): BiquadFilterNode {
  const f = ctx().createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.setValueAtTime(frequency, ctx().currentTime)
  return f
}

/**
 * Generate a short buffer of white noise.
 * duration in seconds, optional sampleRate override.
 */
function noiseBuffer(duration: number): AudioBuffer {
  const ac = ctx()
  const length = Math.ceil(ac.sampleRate * duration)
  const buf = ac.createBuffer(1, length, ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1
  }
  return buf
}

/**
 * Play a noise burst with an amplitude envelope.
 * Returns when the sound will have fully ended (seconds from now).
 */
function noiseShot(
  duration: number,
  peakGain: number,
  attackTime: number,
  releaseStart: number,
  filterHz: number,
): void {
  const ac = ctx()
  const now = ac.currentTime
  const buf = noiseBuffer(duration + 0.02)
  const src = ac.createBufferSource()
  src.buffer = buf

  const filt = lpf(filterHz)
  const env = gainToMaster(0)

  src.connect(filt)
  filt.connect(env)

  env.gain.linearRampToValueAtTime(peakGain, now + attackTime)
  env.gain.setValueAtTime(peakGain, now + releaseStart)
  env.gain.linearRampToValueAtTime(0, now + duration)

  src.start(now)
  src.stop(now + duration + 0.01)
}

// ---------------------------------------------------------------------------
// Individual synthesisers
// ---------------------------------------------------------------------------

/** Coin pickup: short pitched blip with shimmer. */
function playCoin(): void {
  const ac = ctx()
  const now = ac.currentTime

  // Two quick ascending tones
  const freqs = [880, 1320]
  freqs.forEach((freq, i) => {
    const osc = ac.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq * 0.85, now + i * 0.05)
    osc.frequency.linearRampToValueAtTime(freq, now + i * 0.05 + 0.04)

    const env = gainToMaster(0)
    env.gain.linearRampToValueAtTime(0.28, now + i * 0.05 + 0.005)
    env.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.18)

    osc.connect(env)
    osc.start(now + i * 0.05)
    osc.stop(now + i * 0.05 + 0.2)
  })
}

/** Ring whoosh: swept bandpass noise. */
function playWhoosh(): void {
  const ac = ctx()
  const now = ac.currentTime
  const dur = 0.45

  const buf = noiseBuffer(dur + 0.05)
  const src = ac.createBufferSource()
  src.buffer = buf

  const band = ac.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.setValueAtTime(300, now)
  band.frequency.exponentialRampToValueAtTime(3200, now + dur * 0.6)
  band.frequency.exponentialRampToValueAtTime(800, now + dur)
  band.Q.setValueAtTime(2.5, now)

  const env = gainToMaster(0)
  env.gain.linearRampToValueAtTime(0.45, now + 0.03)
  env.gain.setValueAtTime(0.45, now + dur * 0.5)
  env.gain.linearRampToValueAtTime(0, now + dur)

  src.connect(band)
  band.connect(env)
  src.start(now)
  src.stop(now + dur + 0.02)
}

/** Boost: rising sawtooth + noise swell. */
function playBoost(): void {
  const ac = ctx()
  const now = ac.currentTime
  const dur = 0.55

  // Sawtooth sweep
  const osc = ac.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(110, now)
  osc.frequency.exponentialRampToValueAtTime(440, now + dur)

  const filt = lpf(1800)
  const env = gainToMaster(0)

  env.gain.linearRampToValueAtTime(0.22, now + 0.02)
  env.gain.setValueAtTime(0.22, now + dur - 0.1)
  env.gain.linearRampToValueAtTime(0, now + dur)

  osc.connect(filt)
  filt.connect(env)
  osc.start(now)
  osc.stop(now + dur + 0.02)

  // Noise layer
  noiseShot(dur * 0.7, 0.12, 0.01, dur * 0.4, 2400)
}

/** Impact / crash: noise thud + low pitch drop. */
function playImpact(): void {
  const ac = ctx()
  const now = ac.currentTime

  // Thud from noise
  noiseShot(0.35, 0.6, 0.002, 0.06, 600)

  // Sub tone
  const osc = ac.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(160, now)
  osc.frequency.exponentialRampToValueAtTime(45, now + 0.3)

  const env = gainToMaster(0)
  env.gain.linearRampToValueAtTime(0.55, now + 0.003)
  env.gain.exponentialRampToValueAtTime(0.001, now + 0.35)

  osc.connect(env)
  osc.start(now)
  osc.stop(now + 0.38)
}

/** Perfect launch sting: quick bright major arpeggio. */
function playPerfect(): void {
  const ac = ctx()
  const now = ac.currentTime

  const notes = [523.25, 659.25, 783.99, 1046.5] // C5 E5 G5 C6
  notes.forEach((freq, i) => {
    const t = now + i * 0.07
    const osc = ac.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(freq, t)

    const env = gainToMaster(0)
    env.gain.linearRampToValueAtTime(0.3, t + 0.01)
    env.gain.setValueAtTime(0.3, t + 0.06)
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.28)

    osc.connect(env)
    osc.start(t)
    osc.stop(t + 0.3)
  })

  // Shimmer noise at the top
  noiseShot(0.35, 0.08, 0.01, 0.15, 6000)
}

/** Evolve fanfare: ascending maj-7 chord swell + sparkle tail. */
function playEvolve(): void {
  const ac = ctx()
  const now = ac.currentTime
  const dur = 1.6

  // Chord voices: C4 E4 G4 B4 E5
  const voices = [261.63, 329.63, 392.0, 493.88, 659.25]
  voices.forEach((freq, i) => {
    const t = now + i * 0.06
    const osc = ac.createOscillator()
    osc.type = i % 2 === 0 ? 'sine' : 'triangle'
    osc.frequency.setValueAtTime(freq * 0.98, t)
    osc.frequency.linearRampToValueAtTime(freq, t + 0.12)

    // Slight vibrato on upper voices
    if (i > 1) {
      const lfo = ac.createOscillator()
      lfo.frequency.setValueAtTime(5.5, t)
      const lfoGain = ac.createGain()
      lfoGain.gain.setValueAtTime(0, t)
      lfoGain.gain.linearRampToValueAtTime(3, t + 0.3)
      lfo.connect(lfoGain)
      lfoGain.connect(osc.frequency)
      lfo.start(t)
      lfo.stop(t + dur)
    }

    const env = gainToMaster(0)
    env.gain.linearRampToValueAtTime(0.18, t + 0.08)
    env.gain.setValueAtTime(0.18, t + dur - 0.4)
    env.gain.linearRampToValueAtTime(0, t + dur)

    osc.connect(env)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  })

  // Sparkle: rapid noise bursts at high freq
  for (let k = 0; k < 4; k++) {
    const t2 = now + 0.5 + k * 0.22
    const buf = noiseBuffer(0.12)
    const src = ac.createBufferSource()
    src.buffer = buf

    const hp = ac.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.setValueAtTime(5000 + k * 800, t2)

    const ge = gainToMaster(0)
    ge.gain.linearRampToValueAtTime(0.07, t2 + 0.01)
    ge.gain.linearRampToValueAtTime(0, t2 + 0.1)

    src.connect(hp)
    hp.connect(ge)
    src.start(t2)
    src.stop(t2 + 0.14)
  }
}

/** UI tap / confirm blip. */
function playUiTap(): void {
  const ac = ctx()
  const now = ac.currentTime

  const osc = ac.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(1050, now)
  osc.frequency.linearRampToValueAtTime(1200, now + 0.04)

  const env = gainToMaster(0)
  env.gain.linearRampToValueAtTime(0.18, now + 0.005)
  env.gain.exponentialRampToValueAtTime(0.001, now + 0.1)

  osc.connect(env)
  osc.start(now)
  osc.stop(now + 0.12)
}

/** UI back / cancel blip — descending. */
function playUiBack(): void {
  const ac = ctx()
  const now = ac.currentTime

  const osc = ac.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(800, now)
  osc.frequency.linearRampToValueAtTime(520, now + 0.07)

  const env = gainToMaster(0)
  env.gain.linearRampToValueAtTime(0.15, now + 0.005)
  env.gain.exponentialRampToValueAtTime(0.001, now + 0.1)

  osc.connect(env)
  osc.start(now)
  osc.stop(now + 0.12)
}

// ---------------------------------------------------------------------------
// Dispatch table
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Extra sounds (pickups, hazards, UI) built from the same helpers.
// ---------------------------------------------------------------------------

/** Simple oscillator blip with pitch slide and exponential decay. */
function blip(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.12, slideTo?: number, delay = 0, filterHz = 6000): void {
  const ac = ctx()
  const t0 = ac.currentTime + delay
  const o = ac.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(freq, t0)
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur)
  const f = lpf(filterHz)
  const g = gainToMaster(0)
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(vol, t0 + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur)
  o.connect(f)
  f.connect(g)
  o.start(t0)
  o.stop(t0 + dur + 0.02)
}

function arp(notes: number[], step: number, dur: number, type: OscillatorType = 'triangle', vol = 0.1): void {
  notes.forEach((n, i) => blip(n, dur, type, vol, undefined, i * step))
}

function playRing(): void { arp([660, 880, 1320], 0.05, 0.25, 'sine', 0.11) }
function playFuel(): void { blip(220, 0.18, 'square', 0.08, 330); blip(440, 0.2, 'triangle', 0.07, 660, 0.08) }
function playShield(): void { blip(520, 0.35, 'sine', 0.1, 1040); blip(780, 0.3, 'sine', 0.06, 1560, 0.05) }
function playStar(): void { arp([784, 988, 1175, 1568, 1976], 0.045, 0.3, 'sine', 0.09) }
function playPop(): void { blip(300, 0.08, 'square', 0.14, 120); noiseShot(0.06, 0.08, 0.002, 0.01, 3000) }
function playCrate(): void { blip(160, 0.12, 'square', 0.1, 90); blip(640, 0.15, 'triangle', 0.07, 900, 0.06) }
function playFountain(): void { for (let i = 0; i < 8; i++) blip(900 + i * 90, 0.12, 'sine', 0.06, undefined, i * 0.04) }
function playThermal(): void { blip(180, 0.6, 'sine', 0.06, 420); noiseShot(0.5, 0.03, 0.1, 0.3, 900) }
function playBird(): void { blip(1400, 0.08, 'square', 0.06, 1900); blip(1600, 0.07, 'square', 0.05, 1100, 0.09); noiseShot(0.08, 0.05, 0.002, 0.02, 2500) }
function playCable(): void { blip(90, 0.3, 'sawtooth', 0.09, 60); noiseShot(0.15, 0.08, 0.002, 0.04, 1500) }
function playIce(): void { arp([2200, 1800, 2600], 0.03, 0.12, 'sine', 0.07); noiseShot(0.1, 0.05, 0.002, 0.03, 5000) }
function playThunder(): void { noiseShot(0.9, 0.25, 0.005, 0.2, 700); blip(60, 0.8, 'sawtooth', 0.12, 35) }
function playDrone(): void { blip(240, 0.25, 'sawtooth', 0.07, 180); blip(360, 0.2, 'square', 0.04, 300, 0.02) }
function playGeyser(): void { noiseShot(0.6, 0.18, 0.02, 0.2, 1200); blip(120, 0.5, 'triangle', 0.08, 70) }
function playLand(): void { noiseShot(0.25, 0.12, 0.002, 0.05, 1200); blip(140, 0.2, 'sine', 0.1, 90) }
function playSplash(): void { noiseShot(0.5, 0.16, 0.01, 0.15, 2200); blip(300, 0.3, 'sine', 0.06, 120) }
function playBounce(): void { blip(200, 0.18, 'square', 0.1, 420); noiseShot(0.1, 0.06, 0.002, 0.03, 2000) }
function playChest(): void { arp([523, 659, 784, 1047], 0.08, 0.35, 'triangle', 0.1); setTimeout(() => playFountain(), 320) }
function playBuy(): void { blip(660, 0.1, 'square', 0.07, 880); blip(1320, 0.14, 'sine', 0.07, undefined, 0.06) }
function playMission(): void { arp([587, 740, 880, 1175], 0.07, 0.3, 'sine', 0.1) }
function playWarn(): void { blip(440, 0.12, 'square', 0.07, 330); blip(440, 0.12, 'square', 0.07, 330, 0.18) }
function playRoll(): void { blip(300, 0.3, 'sawtooth', 0.07, 900); noiseShot(0.3, 0.05, 0.01, 0.1, 2500) }
function playStormBreak(): void { noiseShot(0.5, 0.2, 0.005, 0.1, 2500); arp([392, 523, 659, 784], 0.06, 0.4, 'triangle', 0.12) }
function playGate(): void { arp([880, 1109, 1319, 1760], 0.04, 0.3, 'sine', 0.1); noiseShot(0.2, 0.06, 0.01, 0.05, 3000) }

const _synths: Record<SfxId, () => void> = {
  coin: playCoin,
  whoosh: playWhoosh,
  boost: playBoost,
  impact: playImpact,
  perfect: playPerfect,
  evolve: playEvolve,
  ui_tap: playUiTap,
  ui_back: playUiBack,
  ring: playRing,
  fuel: playFuel,
  shield: playShield,
  star: playStar,
  pop: playPop,
  crate: playCrate,
  fountain: playFountain,
  thermal: playThermal,
  bird: playBird,
  cable: playCable,
  ice: playIce,
  thunder: playThunder,
  drone: playDrone,
  geyser: playGeyser,
  land: playLand,
  splash: playSplash,
  bounce: playBounce,
  chest: playChest,
  buy: playBuy,
  mission: playMission,
  warn: playWarn,
  roll: playRoll,
  storm_break: playStormBreak,
  gate: playGate,
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const sfx = {
  /**
   * Play a sound effect by id.
   * Safe to call before any user gesture — the AudioContext is created lazily
   * on first call (which should itself be inside a gesture handler).
   */
  play(id: SfxId): void {
    if (_muted || !audioAvailable) return
    try {
      _synths[id]()
    } catch {
      // Never let an audio hiccup break the game loop.
    }
  },

  /** Mute / unmute all SFX. */
  get muted(): boolean {
    return _muted
  },
  set muted(v: boolean) {
    _muted = v
    if (_master) {
      _master.gain.setTargetAtTime(
        v ? 0 : _masterVol,
        ctx().currentTime,
        0.02,
      )
    }
  },

  /**
   * Set master SFX volume (0..1, default 0.7).
   * Has no effect while muted; the volume is remembered and applied on unmute.
   */
  setMaster(vol: number): void {
    _masterVol = Math.max(0, Math.min(1, vol))
    if (_master && !_muted) {
      _master.gain.setTargetAtTime(_masterVol, ctx().currentTime, 0.02)
    }
  },

  /** The underlying AudioContext, or null before the first play() call. */
  get ctx(): AudioContext | null {
    return _ctx
  },
} as const
