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

const _synths: Record<SfxId, () => void> = {
  coin: playCoin,
  whoosh: playWhoosh,
  boost: playBoost,
  impact: playImpact,
  perfect: playPerfect,
  evolve: playEvolve,
  ui_tap: playUiTap,
  ui_back: playUiBack,
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
