/**
 * src/audio/engine.ts
 *
 * Procedural propeller / engine loop.
 *
 * The sound is a detuned sawtooth stack run through a resonant lowpass filter.
 * Throttle (0..1) drives pitch and filter cutoff.
 * Speed (m/s, typically 0..300) adds a wind-noise layer that swells with
 * velocity.
 *
 * The AudioContext is created on the FIRST call to start() — which must come
 * from a user gesture — satisfying iOS autoplay policy.  Subsequent start()
 * calls are no-ops if already running.
 *
 * Public API
 * ----------
 *  engine.start(ctx?)        – begin loop; optionally reuse an existing
 *                               AudioContext (e.g. from sfx.ctx)
 *  engine.stop()             – fade out and disconnect
 *  engine.update(throttle, speed) – call every frame; both args 0..1 / 0..∞
 *  engine.muted              – get / set mute (ramps gain, not stop/start)
 *  engine.setMaster(v)       – set volume 0..1 (default 0.65)
 *  engine.ctx                – the AudioContext, or null before start()
 */

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let _ac: AudioContext | null = null

// Oscillator stack
let _osc1: OscillatorNode | null = null   // fundamental
let _osc2: OscillatorNode | null = null   // +1 octave, slightly detuned
let _osc3: OscillatorNode | null = null   // sub (-octave), quiet

// Wind noise
let _noiseNode: AudioBufferSourceNode | null = null
let _noiseGain: GainNode | null = null

// Envelope / filter chain
let _filt: BiquadFilterNode | null = null
let _engineGain: GainNode | null = null   // internal amp envelope
let _masterGain: GainNode | null = null   // master vol + mute

let _running = false
let _muted = false
let _masterVol = 0.65

// Current parameter targets (updated per frame, smoothed by AudioParam ramps)
let _throttle = 0
let _speed = 0

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build a looping white-noise buffer (2 s at the context sample rate).
 */
function makeNoiseBuffer(ac: AudioContext): AudioBuffer {
  const len = ac.sampleRate * 2
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  return buf
}

/**
 * Map throttle 0..1 → engine fundamental Hz.
 * Idle at ~55 Hz (contra-bass), full throttle at ~180 Hz (low E guitar-ish).
 */
function throttleToHz(t: number): number {
  const idle = 55
  const full = 180
  // Exponential curve feels more like a real RPM response
  return idle * Math.pow(full / idle, t)
}

/**
 * Map throttle 0..1 → lowpass cutoff Hz.
 * Closed throttle is muffled (400 Hz), open is bright (3 400 Hz).
 */
function throttleToCutoff(t: number): number {
  return 400 * Math.pow(3400 / 400, t)
}

/**
 * Map speed (m/s) → wind-noise gain.
 * Essentially inaudible under 20 m/s, peaks around 0.18 at 150 m/s.
 */
function speedToWindGain(speed: number): number {
  return Math.min(0.18, (speed / 150) * (speed / 150) * 0.18)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const engine = {
  /**
   * Initialise and start the engine loop.
   * Pass an existing AudioContext (e.g. from the sfx module) to share it.
   * If omitted a fresh AudioContext is created.
   *
   * Must be called from inside a user-gesture handler.
   */
  start(existingCtx?: AudioContext): void {
    if (_running) return

    _ac = existingCtx ?? new AudioContext()
    if (_ac.state === 'suspended') void _ac.resume()

    const ac = _ac
    const now = ac.currentTime

    // Master gain (mute + volume)
    _masterGain = ac.createGain()
    _masterGain.gain.setValueAtTime(_muted ? 0 : _masterVol, now)
    _masterGain.connect(ac.destination)

    // Lowpass filter
    _filt = ac.createBiquadFilter()
    _filt.type = 'lowpass'
    _filt.frequency.setValueAtTime(throttleToCutoff(0), now)
    _filt.Q.setValueAtTime(1.4, now)
    _filt.connect(_masterGain)

    // Engine amplitude envelope
    _engineGain = ac.createGain()
    _engineGain.gain.setValueAtTime(0, now)
    _engineGain.gain.linearRampToValueAtTime(0.0, now)   // will ramp on update
    _engineGain.connect(_filt)

    // Fundamental sawtooth
    _osc1 = ac.createOscillator()
    _osc1.type = 'sawtooth'
    _osc1.frequency.setValueAtTime(throttleToHz(0), now)
    _osc1.connect(_engineGain)
    _osc1.start(now)

    // Second harmonic (+1 oct, -6 cents for warmth)
    _osc2 = ac.createOscillator()
    _osc2.type = 'sawtooth'
    _osc2.frequency.setValueAtTime(throttleToHz(0) * 2, now)
    _osc2.detune.setValueAtTime(-6, now)
    const osc2Gain = ac.createGain()
    osc2Gain.gain.setValueAtTime(0.45, now)
    _osc2.connect(osc2Gain)
    osc2Gain.connect(_engineGain)
    _osc2.start(now)

    // Sub octave (-1 oct), very quiet, adds body
    _osc3 = ac.createOscillator()
    _osc3.type = 'sawtooth'
    _osc3.frequency.setValueAtTime(throttleToHz(0) * 0.5, now)
    const osc3Gain = ac.createGain()
    osc3Gain.gain.setValueAtTime(0.2, now)
    _osc3.connect(osc3Gain)
    osc3Gain.connect(_engineGain)
    _osc3.start(now)

    // Wind noise (loops silently until speed rises)
    const noiseBuf = makeNoiseBuffer(ac)
    _noiseNode = ac.createBufferSource()
    _noiseNode.buffer = noiseBuf
    _noiseNode.loop = true

    const noiseHp = ac.createBiquadFilter()
    noiseHp.type = 'highpass'
    noiseHp.frequency.setValueAtTime(800, now)

    _noiseGain = ac.createGain()
    _noiseGain.gain.setValueAtTime(0, now)

    _noiseNode.connect(noiseHp)
    noiseHp.connect(_noiseGain)
    _noiseGain.connect(_masterGain)

    _noiseNode.start(now)

    // Fade engine in over 0.3 s (sounds natural when player first pulls back)
    _engineGain.gain.linearRampToValueAtTime(0.55, now + 0.3)

    _running = true
  },

  /**
   * Fade out and fully disconnect all nodes.
   * The AudioContext is NOT closed — the sfx module may still own it.
   */
  stop(): void {
    if (!_running || !_ac) return
    _running = false

    const ac = _ac
    const now = ac.currentTime
    const fadeEnd = now + 0.4

    if (_masterGain) {
      _masterGain.gain.setTargetAtTime(0, now, 0.1)
    }

    // Detach nodes after fade
    window.setTimeout(() => {
      _osc1?.stop(); _osc1?.disconnect(); _osc1 = null
      _osc2?.stop(); _osc2?.disconnect(); _osc2 = null
      _osc3?.stop(); _osc3?.disconnect(); _osc3 = null
      _noiseNode?.stop(); _noiseNode?.disconnect(); _noiseNode = null
      _noiseGain?.disconnect(); _noiseGain = null
      _filt?.disconnect(); _filt = null
      _engineGain?.disconnect(); _engineGain = null
      _masterGain?.disconnect(); _masterGain = null
    }, (fadeEnd - now + 0.05) * 1000)
  },

  /**
   * Call every animation frame.
   *
   * @param throttle  0..1   (player input / autopilot target throttle)
   * @param speed     m/s    (current aircraft speed; used for wind layer)
   */
  update(throttle: number, speed: number): void {
    if (!_running || !_ac) return

    _throttle = Math.max(0, Math.min(1, throttle))
    _speed = Math.max(0, speed)

    const ac = _ac
    const now = ac.currentTime
    // Smooth 80 ms lag so rapid changes don't click
    const hz = throttleToHz(_throttle)
    const cutoff = throttleToCutoff(_throttle)
    const windGain = speedToWindGain(_speed)

    _osc1?.frequency.setTargetAtTime(hz, now, 0.08)
    _osc2?.frequency.setTargetAtTime(hz * 2, now, 0.08)
    _osc3?.frequency.setTargetAtTime(hz * 0.5, now, 0.08)
    _filt?.frequency.setTargetAtTime(cutoff, now, 0.08)

    // Engine volume: quiet at idle, loud at full throttle
    const engVol = 0.25 + _throttle * 0.75
    _engineGain?.gain.setTargetAtTime(engVol * 0.55, now, 0.08)

    _noiseGain?.gain.setTargetAtTime(windGain, now, 0.1)
  },

  /** Mute / unmute the engine loop. */
  get muted(): boolean {
    return _muted
  },
  set muted(v: boolean) {
    _muted = v
    if (_masterGain && _ac) {
      _masterGain.gain.setTargetAtTime(
        v ? 0 : _masterVol,
        _ac.currentTime,
        0.02,
      )
    }
  },

  /**
   * Set master engine volume (0..1, default 0.65).
   * Remembered across mute/unmute cycles.
   */
  setMaster(vol: number): void {
    _masterVol = Math.max(0, Math.min(1, vol))
    if (_masterGain && _ac && !_muted) {
      _masterGain.gain.setTargetAtTime(_masterVol, _ac.currentTime, 0.02)
    }
  },

  /** Whether the engine is currently running. */
  get running(): boolean {
    return _running
  },

  /** The AudioContext, or null before start() is called. */
  get ctx(): AudioContext | null {
    return _ac
  },
} as const
