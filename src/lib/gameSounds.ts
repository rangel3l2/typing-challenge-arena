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

    // Two quick ascending notes
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

    // Noise burst via oscillator detune trick
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

    // Low thud
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

    // Three descending tones
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

    // Low rumble
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
