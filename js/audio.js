/* Tiny synthesized sound engine (no assets). */
const Sfx = (() => {
  let ctx = null, master = null, musicGain = null, verb = null, musicTimer = null;
  const st = { sound: true, music: true };
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = ctx.createGain(); master.gain.value = .55; master.connect(ctx.destination);
    // generated reverb impulse
    verb = ctx.createConvolver();
    const len = ctx.sampleRate * 2.2, buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    verb.buffer = buf;
    const vg = ctx.createGain(); vg.gain.value = .35; verb.connect(vg); vg.connect(master);
    musicGain = ctx.createGain(); musicGain.gain.value = .0; musicGain.connect(master); musicGain.connect(verb);
    if (st.music) startMusic();
  }
  function tone(freq, dur, { type = 'sine', vol = .25, attack = .005, when = 0, slide = 0, dest = null, wet = .3 } = {}) {
    if (!ctx || !st.sound && !dest) return;
    const t = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(dest || master);
    if (!dest && wet) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w); w.connect(verb); }
    o.start(t); o.stop(t + dur + .05);
  }
  function noise(dur, { vol = .2, freq = 1200, q = 1, when = 0, sweep = 0, type = 'bandpass' } = {}) {
    if (!ctx || !st.sound) return;
    const t = ctx.currentTime + when, len = Math.floor(ctx.sampleRate * dur), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(); s.buffer = b;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(freq, t); fl.Q.value = q;
    if (sweep) fl.frequency.exponentialRampToValueAtTime(freq * sweep, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(master); s.start(t);
  }
  const PENTA = [0, 2, 4, 7, 9];
  const note = n => 440 * Math.pow(2, (n - 69) / 12);
  const api = {
    init,
    get sound() { return st.sound; }, get music() { return st.music; },
    setSound(v) { st.sound = v; },
    setMusic(v) { st.music = v; if (!ctx) return; v ? startMusic() : stopMusic(); },
    tap() { tone(880, .06, { type: 'triangle', vol: .12, wet: 0 }); },
    swap() { noise(.16, { vol: .12, freq: 900, sweep: 2.5, q: .8 }); },
    bad() { tone(180, .18, { type: 'triangle', vol: .2, slide: .7, wet: 0 }); },
    match(chain = 1) {
      const n = 72 + PENTA[(chain - 1) % 5] + 12 * Math.floor((chain - 1) / 5);
      tone(note(n), .22, { type: 'sine', vol: .22 }); tone(note(n + 12), .14, { type: 'triangle', vol: .06, when: .02 });
      noise(.06, { vol: .08, freq: 3000, q: 2 });
    },
    rocket() { noise(.45, { vol: .2, freq: 500, sweep: 6, q: 1.2 }); tone(300, .35, { type: 'sawtooth', vol: .04, slide: 3, wet: .1 }); },
    bomb() { noise(.6, { vol: .4, freq: 400, sweep: .2, q: .6, type: 'lowpass' }); tone(110, .5, { vol: .35, slide: .4, wet: .2 }); },
    flutter() { for (let i = 0; i < 4; i++) noise(.05, { vol: .08, freq: 2200, when: i * .06, q: 3 }); },
    rainbow() { [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => tone(note(76 + s), .5, { type: 'triangle', vol: .12, when: i * .05 })); },
    create() { tone(note(84), .3, { type: 'triangle', vol: .12 }); tone(note(91), .3, { type: 'sine', vol: .08, when: .06 }); },
    pot() { noise(.15, { vol: .25, freq: 1800, q: 4 }); tone(260, .12, { type: 'square', vol: .04, slide: .5, wet: 0 }); },
    moss() { noise(.12, { vol: .12, freq: 600, q: 1 }); },
    goal() { tone(note(88), .18, { type: 'sine', vol: .1 }); },
    win() { [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => { tone(note(n), .6, { type: 'triangle', vol: .16, when: i * .09 }); tone(note(n + 12), .5, { vol: .05, when: i * .09 + .02 }); }); },
    lose() { [67, 63, 60, 55].forEach((n, i) => tone(note(n), .5, { type: 'triangle', vol: .14, when: i * .16 })); },
    sparkle() { for (let i = 0; i < 8; i++) tone(note(84 + PENTA[i % 5] + (i > 4 ? 12 : 0)), .35, { type: 'sine', vol: .07, when: i * .05 }); },
    coin() { tone(note(88), .08, { type: 'square', vol: .05, wet: 0 }); tone(note(95), .2, { type: 'square', vol: .05, when: .07, wet: .1 }); }
  };
  // gentle generative greenhouse music: soft plucks over a slow pad
  function startMusic() {
    if (!ctx || musicTimer) return;
    musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.linearRampToValueAtTime(.5, ctx.currentTime + 2);
    const chords = [[57, 64, 69, 72], [53, 60, 65, 69], [55, 62, 67, 71], [52, 59, 64, 67]];
    let beat = 0;
    const tick = () => {
      const ch = chords[Math.floor(beat / 8) % chords.length];
      if (beat % 8 === 0) ch.forEach(n => tone(note(n - 12), 4.2, { type: 'sine', vol: .035, attack: 1.2, dest: musicGain }));
      if (Math.random() < .55) {
        const n = ch[Math.floor(Math.random() * ch.length)] + (Math.random() < .5 ? 12 : 0);
        tone(note(n), 1.4, { type: 'triangle', vol: .05, dest: musicGain });
      }
      beat++;
    };
    tick(); musicTimer = setInterval(tick, 520);
  }
  function stopMusic() {
    if (musicTimer) clearInterval(musicTimer); musicTimer = null;
    if (musicGain) { musicGain.gain.cancelScheduledValues(ctx.currentTime); musicGain.gain.linearRampToValueAtTime(0, ctx.currentTime + .6); }
  }
  return api;
})();
