// Procedural audio engine: every sound is synthesized at runtime (WebAudio). No audio files.
import { clamp, rand, pick } from '../core/math.js';

export class Audio {
  constructor(game) {
    this.game = game;
    this.ctx = null;
    this.ready = false;
    this.vol = { master: 0.8, sfx: 1, music: 0.55, ambient: 0.8 };
    this.listener = { x: 0, y: 0, z: 0, yaw: 0 };
    this.musicIntensity = 0;
    this.combatLevel = 0;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain(); this.master.gain.value = this.vol.master;
    this.masterFilter = ctx.createBiquadFilter(); this.masterFilter.type = 'lowpass'; this.masterFilter.frequency.value = 20000;
    this.comp = ctx.createDynamicsCompressor(); this.comp.threshold.value = -14; this.comp.ratio.value = 4;
    this.master.connect(this.masterFilter).connect(this.comp).connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.gain.value = this.vol.sfx; this.sfx.connect(this.master);
    this.music = ctx.createGain(); this.music.gain.value = this.vol.music; this.music.connect(this.master);
    this.amb = ctx.createGain(); this.amb.gain.value = this.vol.ambient; this.amb.connect(this.master);
    // reverb
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._impulse(2.8, 2.2);
    this.revGain = ctx.createGain(); this.revGain.gain.value = 0.35;
    this.reverb.connect(this.revGain).connect(this.master);
    // noise buffers
    const len = ctx.sampleRate * 2;
    this.white = ctx.createBuffer(1, len, ctx.sampleRate);
    const w = this.white.getChannelData(0);
    for (let i = 0; i < len; i++) w[i] = Math.random() * 2 - 1;
    this.brown = ctx.createBuffer(1, len, ctx.sampleRate);
    const b = this.brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = last * 3.5; }
    this._startAmbience();
    this._startMusic();
    this.ready = true;
  }

  _impulse(dur, decay) {
    const ctx = this.ctx, n = ctx.sampleRate * dur;
    const buf = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
    return buf;
  }

  setVolumes(v) { Object.assign(this.vol, v); if (!this.ctx) return; this.master.gain.value = this.vol.master; this.sfx.gain.value = this.vol.sfx; this.music.gain.value = this.vol.music; this.amb.gain.value = this.vol.ambient; }

  setListener(pos, yaw) { this.listener.x = pos.x; this.listener.y = pos.y; this.listener.z = pos.z; this.listener.yaw = yaw; }

  // Spatialize: returns an input node (gain → panner → filter → sfx/reverb)
  _spatial(pos, vol = 1, maxDist = 120, reverbAmt = 0.3) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    let dist = 0, pan = 0;
    if (pos) {
      const dx = pos.x - this.listener.x, dz = pos.z - this.listener.z, dy = (pos.y || 0) - this.listener.y;
      dist = Math.hypot(dx, dy, dz);
      const ang = Math.atan2(dx, dz) - this.listener.yaw;
      pan = clamp(-Math.sin(ang), -1, 1) * 0.85;
    }
    const att = pos ? clamp(1 / (1 + (dist / (maxDist * 0.12)) ** 1.6), 0, 1) : 1;
    if (att < 0.003) return null;
    g.gain.value = vol * att;
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = pos ? clamp(18000 - dist * 90, 900, 18000) : 18000;
    g.connect(p).connect(f);
    f.connect(this.sfx);
    const rv = ctx.createGain(); rv.gain.value = reverbAmt * (0.5 + Math.min(1, dist / 80)); f.connect(rv).connect(this.reverb);
    return g;
  }

  _noise(dest, t0, dur, { type = 'bandpass', freq = 1000, q = 1, gain = 1, attack = 0.002, brown = false, freqEnd = null } = {}) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = brown ? this.brown : this.white;
    src.loop = true;
    src.playbackRate.value = rand(0.9, 1.1);
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t0, rand(0, 1.5)); src.stop(t0 + dur + 0.05);
    return f;
  }
  _osc(dest, t0, dur, { type = 'sine', freq = 440, freqEnd = null, gain = 0.3, attack = 0.01, release = null, detune = 0 } = {}) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t0); o.detune.value = detune;
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + (release ?? dur));
    o.connect(g).connect(dest); o.start(t0); o.stop(t0 + dur + 0.05);
    return o;
  }

  get now() { return this.ctx.currentTime; }
  ok() { return this.ready && this.ctx.state === 'running'; }

  // ---------- weapons ----------
  gunshot(type, pos, isPlayer) {
    if (!this.ok()) return;
    const d = this._spatial(isPlayer ? null : pos, isPlayer ? 0.9 : 1.1, 400, 0.6);
    if (!d) return;
    const t = this.now;
    const rifle = type === 'rifle';
    this._noise(d, t, rifle ? 0.5 : 0.35, { type: 'lowpass', freq: rifle ? 3500 : 5000, gain: 1.4, freqEnd: 400 });
    this._noise(d, t, 0.08, { type: 'highpass', freq: 2500, gain: 0.7 });
    this._osc(d, t, rifle ? 0.35 : 0.25, { type: 'sine', freq: rifle ? 120 : 160, freqEnd: 40, gain: 1.2, attack: 0.001 });
    // echo tail over the hills
    this._noise(d, t + 0.25, 1.4, { type: 'lowpass', freq: 600, gain: 0.25, attack: 0.15, freqEnd: 150, brown: true });
    if (isPlayer && type === 'rifle') setTimeout(() => this.lever(), 380);
  }
  lever() { if (!this.ok()) return; const d = this._spatial(null, 0.4); const t = this.now; this._noise(d, t, 0.05, { freq: 3000, q: 4, gain: 0.8 }); this._noise(d, t + 0.12, 0.05, { freq: 2200, q: 4, gain: 0.8 }); }
  reload(pos) { if (!this.ok()) return; const d = this._spatial(pos || null, 0.5); if (!d) return; const t = this.now; for (let i = 0; i < 4; i++) this._noise(d, t + i * 0.25, 0.04, { freq: 2500 + i * 200, q: 6, gain: 0.7 }); this._noise(d, t + 1.2, 0.06, { freq: 1500, q: 3, gain: 0.9 }); }
  dryFire() { if (!this.ok()) return; this._noise(this._spatial(null, 0.5), this.now, 0.03, { freq: 4000, q: 8, gain: 0.8 }); }
  equip() { if (!this.ok()) return; this._noise(this._spatial(null, 0.3), this.now, 0.12, { freq: 1800, q: 2, gain: 0.5 }); }
  bowDraw() { if (!this.ok()) return; const d = this._spatial(null, 0.25); this._noise(d, this.now, 0.6, { freq: 900, q: 10, gain: 0.25, attack: 0.3, freqEnd: 1400 }); }
  bowRelease() { if (!this.ok()) return; const d = this._spatial(null, 0.6); const t = this.now; this._osc(d, t, 0.25, { type: 'triangle', freq: 180, freqEnd: 90, gain: 0.6, attack: 0.001 }); this._noise(d, t, 0.3, { freq: 2000, q: 1, gain: 0.3, freqEnd: 600 }); }
  arrowHit(pos) { if (!this.ok()) return; const d = this._spatial(pos, 0.6, 60); if (d) this._noise(d, this.now, 0.1, { freq: 700, q: 2, gain: 0.8 }); }
  swing() { if (!this.ok()) return; this._noise(this._spatial(null, 0.4), this.now, 0.25, { freq: 1200, q: 1.5, gain: 0.5, attack: 0.08, freqEnd: 400 }); }
  meleeHit() { if (!this.ok()) return; const d = this._spatial(null, 0.7); const t = this.now; this._noise(d, t, 0.15, { type: 'lowpass', freq: 800, gain: 1 }); this._osc(d, t, 0.12, { freq: 90, freqEnd: 50, gain: 0.8 }); }
  impact(pos, surface) { if (!this.ok()) return; const d = this._spatial(pos, 0.5, 80); if (!d) return; this._noise(d, this.now, 0.08, { freq: surface === 'wood' ? 900 : 1600, q: 2, gain: 0.8 }); if (Math.random() < 0.3) this.ricochet(pos); }
  ricochet(pos) { const d = this._spatial(pos, 0.25, 80); if (d) this._osc(d, this.now, 0.4, { type: 'sine', freq: rand(2500, 4000), freqEnd: rand(700, 1200), gain: 0.25 }); }
  whizz(pos) { if (!this.ok()) return; const d = this._spatial(pos, 0.5, 20); if (d) this._noise(d, this.now, 0.18, { freq: 3500, q: 6, gain: 0.6, attack: 0.05, freqEnd: 1500 }); }
  mark() { if (!this.ok()) return; this._osc(this._spatial(null, 0.25), this.now, 0.15, { type: 'triangle', freq: 1400, gain: 0.4 }); }
  deadEye(on) {
    if (!this.ok()) return;
    const t = this.now;
    this.masterFilter.frequency.cancelScheduledValues(t);
    this.masterFilter.frequency.setTargetAtTime(on ? 900 : 20000, t, 0.08);
    this._noise(this._spatial(null, 0.5), t, 0.8, { freq: on ? 300 : 1200, q: 1, gain: 0.6, freqEnd: on ? 1600 : 200 });
    clearInterval(this._heart);
    if (on) this._heart = setInterval(() => { const d = this._spatial(null, 0.7); const n = this.now; this._osc(d, n, 0.15, { freq: 55, freqEnd: 40, gain: 1 }); this._osc(d, n + 0.18, 0.15, { freq: 50, freqEnd: 38, gain: 0.7 }); }, 900);
  }

  // ---------- player / foley ----------
  footstep(surface, vol) {
    if (!this.ok()) return;
    const d = this._spatial(null, 0.22 * vol, 30, 0.05);
    const t = this.now;
    if (surface === 'water') this._noise(d, t, 0.2, { freq: 900, q: 0.8, gain: 0.8, freqEnd: 400 });
    else this._noise(d, t, 0.09, { type: surface === 'dirt' ? 'bandpass' : 'highpass', freq: surface === 'dirt' ? 600 : 2500, q: 1, gain: 0.9 });
  }
  jump() { if (!this.ok()) return; this._noise(this._spatial(null, 0.2), this.now, 0.15, { freq: 500, gain: 0.5 }); }
  land() { if (!this.ok()) return; const d = this._spatial(null, 0.4); this._noise(d, this.now, 0.15, { type: 'lowpass', freq: 400, gain: 1 }); }
  splash(pos) { if (!this.ok()) return; const d = this._spatial(pos, 0.6, 50); if (d) this._noise(d, this.now, 0.7, { freq: 1200, q: 0.6, gain: 0.8, freqEnd: 300 }); }
  hurt() { if (!this.ok()) return; const d = this._spatial(null, 0.5); const t = this.now; this._osc(d, t, 0.22, { type: 'sawtooth', freq: 320, freqEnd: 220, gain: 0.12 }); this._noise(d, t, 0.2, { freq: 800, q: 3, gain: 0.25 }); }
  human(kind, pos, female) {
    if (!this.ok()) return;
    const d = this._spatial(pos, 0.5, 60);
    if (!d) return;
    const t = this.now, base = female ? 260 : 140;
    if (kind === 'groan') {
      const o = this._osc(d, t, 1.4, { type: 'sawtooth', freq: base * 0.7, freqEnd: base * 0.45, gain: 0.16, attack: 0.25, detune: rand(-30, 30) });
      this._noise(d, t, 1.3, { freq: 500, q: 2, gain: 0.25, attack: 0.3, freqEnd: 300 });
      return;
    }
    if (kind === 'die') this._osc(d, t, 0.7, { type: 'sawtooth', freq: base * 1.4, freqEnd: base * 0.6, gain: 0.12 });
    else if (kind === 'alert') { this._osc(d, t, 0.3, { type: 'sawtooth', freq: base * 1.2, freqEnd: base * 1.6, gain: 0.1 }); this._osc(d, t + 0.32, 0.25, { type: 'sawtooth', freq: base * 1.5, freqEnd: base * 1.1, gain: 0.1 }); }
    else this._osc(d, t, 0.2, { type: 'sawtooth', freq: base * 1.3, freqEnd: base, gain: 0.1 });
  }

  // ---------- creatures ----------
  dino(kind, type, pos, scale = 1) {
    if (!this.ok()) return;
    const big = { trex: 1, brachio: 1, trike: 0.6, stego: 0.6, para: 0.5 }[kind] || 0;
    const d = this._spatial(pos, type === 'roar' ? 1.3 : 0.8, big ? 500 : 150, 0.5);
    if (!d) return;
    const t = this.now;
    const fmt = (freq, q, g) => { const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; const gg = this.ctx.createGain(); gg.gain.value = g; f.connect(gg).connect(d); return f; };
    const voice = (dur, f0, f1, formants, wave = 'sawtooth', vib = 0, gain = 0.5, attack = 0.1) => {
      const o = this.ctx.createOscillator(); o.type = wave;
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(5, f1), t + dur);
      if (vib) { const l = this.ctx.createOscillator(); l.frequency.value = vib; const lg = this.ctx.createGain(); lg.gain.value = f0 * 0.08; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur); }
      const g = this.ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.setValueAtTime(gain, t + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(g);
      for (const [fq, q, fg] of formants) g.connect(fmt(fq, q, fg));
      o.start(t); o.stop(t + dur + 0.05);
    };
    const s = 1 / Math.sqrt(scale);
    switch (kind) {
      case 'trex':
        if (type === 'roar' || type === 'call') {
          const dur = type === 'roar' ? 3.0 : 1.6;
          voice(dur, 70 * s, 38 * s, [[180, 3, 1.4], [420, 4, 0.9], [900, 5, 0.4]], 'sawtooth', 9, 0.9, 0.25);
          voice(dur, 105 * s, 52 * s, [[300, 3, 0.8], [700, 6, 0.4]], 'square', 6, 0.35, 0.3);
          this._noise(d, t, dur, { type: 'bandpass', freq: 500, q: 0.8, gain: 0.9, attack: 0.3, freqEnd: 200 });
          this._noise(d, t, dur, { type: 'lowpass', freq: 160, gain: 1.2, attack: 0.3, brown: true });
        } else if (type === 'bite') { this._noise(d, t, 0.25, { type: 'lowpass', freq: 500, gain: 1.4 }); this._osc(d, t, 0.2, { freq: 70, freqEnd: 40, gain: 1 }); }
        else if (type === 'hurt') voice(0.7, 120, 70, [[300, 3, 1]], 'sawtooth', 12, 0.6);
        else if (type === 'die') voice(3.5, 90, 30, [[200, 3, 1.2], [500, 4, 0.6]], 'sawtooth', 5, 0.8, 0.2);
        break;
      case 'raptor': case 'dilo': case 'compy': {
        const k = kind === 'compy' ? 3 : kind === 'dilo' ? 0.8 : 1;
        if (type === 'roar' || type === 'call') {
          voice(0.9, 900 * k * s, 500 * k * s, [[1500 * k, 4, 1], [3000 * k, 6, 0.5]], 'sawtooth', 25, 0.4, 0.05);
          this._noise(d, t, 0.8, { freq: 2500 * k, q: 2, gain: 0.5, attack: 0.05 });
          if (kind === 'dilo') voice(1.2, 300, 420, [[800, 5, 0.8]], 'triangle', 8, 0.3, 0.2);
        } else if (type === 'bite') this._noise(d, t, 0.12, { freq: 1200, q: 2, gain: 0.9 });
        else if (type === 'hurt') voice(0.35, 1400 * k, 700 * k, [[2000 * k, 4, 1]], 'sawtooth', 30, 0.4, 0.02);
        else if (type === 'die') voice(1.0, 1000 * k, 300 * k, [[1500 * k, 4, 1]], 'sawtooth', 15, 0.4, 0.03);
        break;
      }
      case 'gallimimus':
        voice(0.35, 600 * s, 750 * s, [[1100, 5, 1]], 'square', 0, 0.25, 0.02);
        if (type !== 'call') voice(0.4, 800, 400, [[1200, 5, 1]], 'square', 0, 0.25, 0.02);
        break;
      case 'para':
        // the haunting horn call
        voice(type === 'hurt' ? 0.6 : 2.2, 110 * s, 98 * s, [[330, 6, 1.2], [660, 8, 0.6], [990, 10, 0.3]], 'sawtooth', 4, 0.5, 0.25);
        break;
      case 'brachio':
        voice(type === 'hurt' ? 1 : 3.2, 70 * s, 85 * s, [[220, 8, 1.4], [500, 10, 0.6], [1100, 12, 0.2]], 'sawtooth', 3, 0.6, 0.6);
        voice(3, 140 * s, 150 * s, [[440, 10, 0.5]], 'triangle', 2, 0.25, 0.8);
        break;
      case 'trike': case 'stego':
        if (type === 'roar') { voice(1.2, 90 * s, 70 * s, [[250, 3, 1], [600, 5, 0.5]], 'sawtooth', 10, 0.6, 0.1); this._noise(d, t, 1.0, { type: 'lowpass', freq: 400, gain: 0.8 }); }
        else { this._noise(d, t, 0.5, { freq: 600, q: 1, gain: 0.9, attack: 0.05 }); voice(0.5, 120, 90, [[300, 3, 1]], 'sawtooth', 0, 0.3); }
        break;
      case 'ptera':
        voice(0.8, 1600, 900, [[2400, 4, 1]], 'sawtooth', 20, 0.3, 0.04);
        break;
    }
  }
  stomp(pos, size) {
    if (!this.ok()) return;
    const d = this._spatial(pos, Math.min(1.5, size * 0.3), 250, 0.4);
    if (!d) return;
    const t = this.now;
    this._osc(d, t, 0.45, { freq: 55, freqEnd: 28, gain: 1.2, attack: 0.005 });
    this._noise(d, t, 0.3, { type: 'lowpass', freq: 300, gain: 0.8 });
  }

  // ---------- UI ----------
  ui(kind = 'click') {
    if (!this.ok()) return;
    const d = this._spatial(null, 0.3, 10, 0);
    const t = this.now;
    if (kind === 'click') this._osc(d, t, 0.06, { type: 'triangle', freq: 900, gain: 0.4 });
    else if (kind === 'pickup') { this._osc(d, t, 0.12, { type: 'triangle', freq: 700, gain: 0.35 }); this._osc(d, t + 0.07, 0.15, { type: 'triangle', freq: 1050, gain: 0.35 }); }
    else if (kind === 'money') { for (let i = 0; i < 3; i++) this._osc(d, t + i * 0.06, 0.15, { type: 'square', freq: 1800 + i * 300, gain: 0.08 }); }
    else if (kind === 'quest') this.pluckChord([220, 277, 330, 440, 554], t, 0.6, 0.12);
    else if (kind === 'fail') this.pluckChord([196, 233, 294], t, 0.5, 0.1);
    else if (kind === 'discover') this.pluckChord([294, 370, 440, 587], t, 0.5, 0.15);
  }

  // Karplus-Strong plucked string — the voice of the western score.
  pluck(freq, t, gain = 0.3, dur = 2.5, dest = null) {
    const ctx = this.ctx;
    const sr = ctx.sampleRate;
    const key = Math.round(freq);
    this._plucks ||= {};
    let buf = this._plucks[key];
    if (!buf) {
      const n = Math.floor(sr * dur);
      buf = ctx.createBuffer(1, n, sr);
      const data = buf.getChannelData(0);
      const period = Math.max(2, Math.floor(sr / freq));
      const ring = new Float32Array(period);
      for (let i = 0; i < period; i++) ring[i] = Math.random() * 2 - 1;
      let idx = 0;
      for (let i = 0; i < n; i++) {
        const next = (idx + 1) % period;
        const v = (ring[idx] + ring[next]) * 0.4985;
        data[i] = ring[idx];
        ring[idx] = v;
        idx = next;
      }
      this._plucks[key] = buf;
    }
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = gain;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3200;
    src.connect(f).connect(g).connect(dest || this.music);
    const rv = ctx.createGain(); rv.gain.value = 0.35; g.connect(rv).connect(this.reverb);
    src.start(t);
  }
  pluckChord(freqs, t, gain, strum = 0.03) { freqs.forEach((f, i) => this.pluck(f, t + i * strum, gain, 3, this.sfx)); }

  // ---------- ambience ----------
  // ---- engines: sawtooth harmonics + filtered rumble; the plane adds blade-pass tremolo and wind rush ----
  engineStart(type) {
    if (!this.ok()) return;
    this.engineStop(true);
    const ctx = this.ctx, t = this.now;
    const out = ctx.createGain(); out.gain.value = 0; out.connect(this.sfx);
    out.gain.linearRampToValueAtTime(type === 'plane' ? 0.32 : 0.28, t + 0.6);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 2; lp.connect(out);
    const trem = ctx.createGain(); trem.gain.value = 1; trem.connect(lp);
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth';
    const o2 = ctx.createOscillator(); o2.type = 'square';
    const g1 = ctx.createGain(); g1.gain.value = 0.5; const g2 = ctx.createGain(); g2.gain.value = 0.18;
    o1.connect(g1).connect(trem); o2.connect(g2).connect(trem);
    const n = ctx.createBufferSource(); n.buffer = this.brown; n.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 160; nf.Q.value = 0.8;
    const ng = ctx.createGain(); ng.gain.value = 0.9; n.connect(nf).connect(ng).connect(trem);
    const wind = ctx.createBufferSource(); wind.buffer = this.white; wind.loop = true;
    const wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 900; wf.Q.value = 0.5;
    const wg = ctx.createGain(); wg.gain.value = 0; wind.connect(wf).connect(wg).connect(out);
    let lfo = null;
    if (type === 'plane') { lfo = ctx.createOscillator(); lfo.frequency.value = 30; const lg = ctx.createGain(); lg.gain.value = 0.35; lfo.connect(lg).connect(trem.gain); lfo.start(); }
    for (const x of [o1, o2, n, wind]) x.start();
    this.eng = { type, out, lp, o1, o2, nf, wg, lfo, nodes: [o1, o2, n, wind, lfo].filter(Boolean) };
    this.engineUpdate(0.1, 0);
  }
  engineUpdate(rpm, speed = 0) {
    const e = this.eng; if (!e || !this.ok()) return;
    const t = this.now;
    const f = e.type === 'plane' ? 48 + rpm * 62 : 34 + rpm * 120;
    e.o1.frequency.setTargetAtTime(f, t, 0.06); e.o2.frequency.setTargetAtTime(f * 0.5, t, 0.06);
    e.nf.frequency.setTargetAtTime(90 + rpm * 260, t, 0.08);
    e.lp.frequency.setTargetAtTime(500 + rpm * 2200, t, 0.08);
    if (e.lfo) e.lfo.frequency.setTargetAtTime(14 + rpm * 46, t, 0.1);
    e.wg.gain.setTargetAtTime(Math.min(0.5, speed / 120), t, 0.2);
  }
  engineStop(now = false) {
    const e = this.eng; if (!e) return;
    this.eng = null;
    const t = this.now;
    e.out.gain.cancelScheduledValues(t); e.out.gain.setValueAtTime(e.out.gain.value, t); e.out.gain.linearRampToValueAtTime(0, t + (now ? 0.05 : 0.8));
    for (const x of e.nodes) x.stop(t + (now ? 0.1 : 0.9));
  }
  explosion(pos) {
    if (!this.ok()) return;
    const d = this._spatial(pos, 1.4, 600, 0.6); if (!d) return;
    const t = this.now;
    this._noise(d, t, 2.2, { type: 'lowpass', freq: 900, gain: 1.4, brown: true, freqEnd: 120 });
    this._osc(d, t, 1.2, { freq: 70, freqEnd: 28, gain: 1 });
    this._noise(d, t, 0.25, { freq: 2500, q: 0.7, gain: 0.8 });
  }

  _startAmbience() {
    const ctx = this.ctx;
    const loop = (buf, type, freq, q, g) => {
      const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const gg = ctx.createGain(); gg.gain.value = g;
      s.connect(f).connect(gg).connect(this.amb); s.start();
      return { s, f, g: gg };
    };
    this.wind = loop(this.brown, 'lowpass', 500, 0.5, 0.25);
    this.surf = loop(this.brown, 'lowpass', 700, 0.4, 0);
    this.rainL = loop(this.white, 'highpass', 1200, 0.3, 0);
    this.jungle = loop(this.white, 'bandpass', 6000, 6, 0.0);
    this.ambT = 0;
  }

  updateAmbience(dt, s) {
    if (!this.ok()) return;
    const t = this.now;
    const k = Math.min(1, dt * 2);
    const set = (node, v) => node.g.gain.setTargetAtTime(v, t, 0.5);
    set(this.wind, 0.18 + s.altitude * 0.0025 + s.storm * 0.35);
    this.wind.f.frequency.setTargetAtTime(350 + Math.sin(t * 0.2) * 150 + s.storm * 400, t, 1);
    set(this.surf, s.coast * 0.55 * (0.7 + 0.3 * Math.sin(t * 0.5)));
    set(this.rainL, s.rain * 0.35);
    set(this.jungle, s.night ? 0.018 * s.jungle : 0.006 * s.jungle);
    this.ambT -= dt;
    if (this.ambT <= 0) {
      this.ambT = rand(0.4, 2.2);
      const d = this._spatial({ x: this.listener.x + rand(-40, 40), y: this.listener.y + rand(2, 12), z: this.listener.z + rand(-40, 40) }, 0.12, 80, 0.4);
      if (!d) return;
      if (s.night) {
        // crickets / night birds
        for (let i = 0; i < 4; i++) this._osc(d, t + i * 0.07, 0.04, { type: 'sine', freq: rand(4200, 4800), gain: 0.15 });
        if (Math.random() < 0.15) this._osc(d, t, 0.6, { type: 'sine', freq: 420, freqEnd: 360, gain: 0.25, attack: 0.1 });
      } else if (s.rain < 0.5) {
        const f = rand(1800, 4200);
        const n = Math.floor(rand(2, 6));
        for (let i = 0; i < n; i++) this._osc(d, t + i * rand(0.08, 0.16), 0.1, { type: 'sine', freq: f * rand(0.85, 1.25), freqEnd: f * rand(0.7, 1.3), gain: 0.3 });
      }
      // distant dinosaur calls for atmosphere
      if (Math.random() < 0.05) {
        const kind = pick(s.night ? ['raptor', 'trex', 'dilo'] : ['para', 'brachio', 'gallimimus', 'trike']);
        const ang = rand(0, 6.28);
        this.dino(kind, 'call', { x: this.listener.x + Math.sin(ang) * 220, y: 0, z: this.listener.z + Math.cos(ang) * 220 });
      }
      if (s.thunder) { this._noise(this.amb, t, 3.5, { type: 'lowpass', freq: 200, gain: 1.2, attack: 0.05, brown: true }); }
    }
  }

  // ---------- music: generative western ----------
  _startMusic() {
    this.beat = 0;
    this.nextNote = this.now + 1;
    // A minor / D minor / E — a lonesome frontier progression
    this.prog = [
      [110, 165, 220, 262, 330], [147, 220, 294, 349, 440], [98, 147, 196, 247, 294], [165, 208, 247, 330, 415],
    ];
    this.melody = [440, 494, 523, 587, 659, 587, 523, 494, 440, 392, 330];
    this.padOsc = [];
    const pg = this.ctx.createGain(); pg.gain.value = 0.0; pg.connect(this.music);
    const pf = this.ctx.createBiquadFilter(); pf.type = 'lowpass'; pf.frequency.value = 700; pf.connect(pg);
    for (const f of [110, 165, 220]) { const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = rand(-8, 8); o.connect(pf); o.start(); this.padOsc.push(o); }
    this.pad = pg;
    this.drumG = this.ctx.createGain(); this.drumG.gain.value = 0; this.drumG.connect(this.music);
  }

  updateMusic(dt, combat, menu) {
    if (!this.ok()) return;
    const t = this.now;
    this.combatLevel += ((combat ? 1 : 0) - this.combatLevel) * Math.min(1, dt * (combat ? 2 : 0.3));
    const c = this.combatLevel;
    this.pad.gain.setTargetAtTime(menu ? 0.05 : 0.02 + c * 0.03, t, 1);
    this.drumG.gain.setTargetAtTime(c * 0.9, t, 0.5);
    const bpm = 76 + c * 44;
    const step = 60 / bpm / 2;
    while (this.nextNote < t + 0.2) {
      const nt = this.nextNote;
      const bar = Math.floor(this.beat / 8) % this.prog.length;
      const chord = this.prog[bar];
      const b = this.beat % 8;
      if (b === 0) this.padOsc.forEach((o, i) => o.frequency.setTargetAtTime(chord[i] / (i === 0 ? 1 : 1), nt, 0.3));
      // fingerpicked arpeggio
      const pattern = [0, 2, 1, 3, 2, 4, 3, 2];
      const playProb = menu ? 1 : 0.55 + c * 0.45;
      if (Math.random() < playProb) this.pluck(chord[pattern[b]], nt, b === 0 ? 0.34 : 0.22);
      if (b === 0 && Math.random() < 0.6) this.pluck(chord[0] / 2, nt, 0.3);
      // lonesome lead line occasionally
      if (!menu && c < 0.3 && b % 2 === 0 && Math.random() < 0.12) this.pluck(pick(this.melody), nt, 0.18);
      if (menu && b % 4 === 2 && Math.random() < 0.4) this.pluck(pick(this.melody), nt, 0.2);
      // combat percussion
      if (c > 0.05) {
        if (b % 4 === 0) { this._osc(this.drumG, nt, 0.25, { freq: 90, freqEnd: 40, gain: 0.8, attack: 0.003 }); }
        if (b % 4 === 2) this._noise(this.drumG, nt, 0.12, { freq: 1800, q: 0.8, gain: 0.4 });
        if (b % 2 === 1) this._noise(this.drumG, nt, 0.04, { type: 'highpass', freq: 7000, gain: 0.2 });
        if (b === 7 && Math.random() < 0.5) this._osc(this.drumG, nt, 0.6, { type: 'sawtooth', freq: chord[4] * 2, freqEnd: chord[4] * 1.9, gain: 0.08 });
      }
      this.beat++;
      this.nextNote += step;
    }
  }
}
