// Tiny WebAudio synth. No asset files.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

export function setMuted(m: boolean) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.5;
}

/** Must be called from a user gesture on iOS. */
export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; vol?: number; slide?: number; delay?: number } = {}) {
  if (!ctx || !master || muted) return;
  const t0 = ctx.currentTime + (opts.delay ?? 0);
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = opts.type ?? 'sine';
  o.frequency.setValueAtTime(freq, t0);
  if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * opts.slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(opts.vol ?? 0.25, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise(dur: number, opts: { vol?: number; freq?: number; delay?: number; q?: number } = {}) {
  if (!ctx || !master || muted) return;
  const t0 = ctx.currentTime + (opts.delay ?? 0);
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = opts.freq ?? 1200;
  f.Q.value = opts.q ?? 0.8;
  const g = ctx.createGain();
  g.gain.value = opts.vol ?? 0.3;
  src.connect(f).connect(g).connect(master);
  src.start(t0);
}

export const sfx = {
  place: () => { tone(660, 0.12, { type: 'triangle', vol: 0.2 }); tone(990, 0.1, { type: 'sine', vol: 0.1, delay: 0.04 }); },
  remove: () => tone(440, 0.12, { type: 'triangle', vol: 0.15, slide: 0.7 }),
  nope: () => { tone(150, 0.12, { type: 'square', vol: 0.08 }); tone(120, 0.14, { type: 'square', vol: 0.08, delay: 0.08 }); },
  select: () => tone(880, 0.05, { type: 'sine', vol: 0.08 }),
  play: () => [523, 659, 784].forEach((f, k) => tone(f, 0.25, { type: 'triangle', vol: 0.15, delay: k * 0.07 })),
  step: () => tone(300 + Math.random() * 60, 0.04, { type: 'sine', vol: 0.04 }),
  home: () => { tone(784, 0.12, { type: 'triangle', vol: 0.18 }); tone(1047, 0.2, { type: 'triangle', vol: 0.18, delay: 0.1 }); },
  // Comic slide-whistle and a soft poof.
  swallow: () => { tone(1200, 0.45, { type: 'sine', vol: 0.18, slide: 0.35 }); noise(0.25, { freq: 700, vol: 0.25, delay: 0.3 }); },
  gulp: () => { tone(160, 0.25, { type: 'sine', vol: 0.35, slide: 0.5 }); noise(0.15, { freq: 400, vol: 0.3 }); tone(500, 0.08, { vol: 0.1, delay: 0.25 }); },
  burnout: () => noise(0.4, { freq: 3000, vol: 0.12, q: 0.4 }),
  win: () => [523, 659, 784, 1047].forEach((f, k) => tone(f, 0.35, { type: 'triangle', vol: 0.16, delay: k * 0.11 })),
  lose: () => [392, 370, 349, 294].forEach((f, k) => tone(f, k === 3 ? 0.6 : 0.25, { type: 'sawtooth', vol: 0.06, delay: k * 0.22, slide: k === 3 ? 0.8 : 1 })),
};
