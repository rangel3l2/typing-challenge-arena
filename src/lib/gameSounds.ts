// Procedural sound effects using Web Audio API — no external files needed

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

/** Happy "ding" when hitting the correct duck / answer */
export function playCorrectSound() {
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;
    [660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.25, now + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.35);
    });
  } catch { /* silent fallback */ }
}

/** Short "pop / burst" when clicking a balloon (penalty) */
export function playBalloonPopSound() {
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 200;
    osc.detune.setValueAtTime(1200, now);
    osc.detune.linearRampToValueAtTime(-600, now + 0.08);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(150, now);
    osc2.frequency.exponentialRampToValueAtTime(40, now + 0.12);
    gain2.gain.setValueAtTime(0.2, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc2.connect(gain2).connect(ctx.destination);
    osc2.start(now);
    osc2.stop(now + 0.2);
  } catch { /* silent fallback */ }
}

/** Descending "wah-wah" for game over */
export function playGameOverSound() {
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;
    [440, 350, 260].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.25);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.7, now + i * 0.25 + 0.25);
      gain.gain.setValueAtTime(0.3, now + i * 0.25);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.25 + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.25);
      osc.stop(now + i * 0.25 + 0.4);
    });
    const rumble = ctx.createOscillator();
    const rGain = ctx.createGain();
    rumble.type = 'sawtooth';
    rumble.frequency.value = 55;
    rGain.gain.setValueAtTime(0.15, now);
    rGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    rumble.connect(rGain).connect(ctx.destination);
    rumble.start(now);
    rumble.stop(now + 1);
  } catch { /* silent fallback */ }
}

/** Quick "quack" when selecting a duck */
export function playDuckSelectSound() {
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(500, now + 0.06);
    osc.frequency.setValueAtTime(900, now + 0.06);
    osc.frequency.exponentialRampToValueAtTime(550, now + 0.12);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  } catch { /* silent fallback */ }
}

/** Celebratory fanfare when completing a phase */
export function playPhaseCompleteSound() {
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.2, now + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.45);
    });
  } catch { /* silent fallback */ }
}

// ── Racing sound engine ──────────────────────────────────────────────

/** Continuous engine acceleration sound — call on each correct letter.
 *  Returns a stop function. Sound fades out after ~300ms automatically
 *  or you can call stop() early. */
let _engineNodes: { osc: OscillatorNode; gain: GainNode; osc2: OscillatorNode; gain2: GainNode; stopTimer: number } | null = null;

export function playAccelerateSound() {
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;

    // If engine is already running, just "rev" it higher
    if (_engineNodes) {
      clearTimeout(_engineNodes.stopTimer);
      const { osc, gain, osc2, gain2 } = _engineNodes;
      // Bump frequency up for rev feel
      const curFreq = osc.frequency.value;
      const newFreq = Math.min(curFreq + 15, 280);
      osc.frequency.setValueAtTime(newFreq, now);
      osc2.frequency.setValueAtTime(newFreq * 2.02, now);
      // Reset gain
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      gain2.gain.cancelScheduledValues(now);
      gain2.gain.setValueAtTime(0.04, now);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      // Auto-stop after idle
      _engineNodes.stopTimer = window.setTimeout(() => stopEngineSound(), 500);
      return;
    }

    // Base engine tone — low rumble
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);

    // Harmonic overtone for richness
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(242, now);
    gain2.gain.setValueAtTime(0.04, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc2.connect(gain2).connect(ctx.destination);
    osc2.start(now);

    const stopTimer = window.setTimeout(() => stopEngineSound(), 500);
    _engineNodes = { osc, gain, osc2, gain2, stopTimer };
  } catch { /* silent fallback */ }
}

export function stopEngineSound() {
  if (_engineNodes) {
    try {
      _engineNodes.osc.stop();
      _engineNodes.osc2.stop();
    } catch { /* already stopped */ }
    _engineNodes = null;
  }
}

/** Tire skid / screech sound on error — short and punchy */
export function playSkidSound() {
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;

    // White-noise-like burst via detuned sawtooth
    const noise = ctx.createOscillator();
    const nGain = ctx.createGain();
    noise.type = 'sawtooth';
    noise.frequency.setValueAtTime(3000, now);
    noise.frequency.exponentialRampToValueAtTime(800, now + 0.25);
    noise.detune.setValueAtTime(1200, now);
    noise.detune.linearRampToValueAtTime(-400, now + 0.2);
    nGain.gain.setValueAtTime(0.12, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    // Bandpass filter for that rubbery screech
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2000, now);
    filter.frequency.exponentialRampToValueAtTime(600, now + 0.3);
    filter.Q.value = 3;

    noise.connect(filter).connect(nGain).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.4);

    // Low thud for impact feel
    const thud = ctx.createOscillator();
    const tGain = ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(100, now);
    thud.frequency.exponentialRampToValueAtTime(30, now + 0.15);
    tGain.gain.setValueAtTime(0.15, now);
    tGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    thud.connect(tGain).connect(ctx.destination);
    thud.start(now);
    thud.stop(now + 0.25);
  } catch { /* silent fallback */ }
}
