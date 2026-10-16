/* Choreography: turns an action into a sequence of vivid beats (poses + hand props + facial expression),
   makes objects react while they are used, and spawns particles and floating captions. */
const Choreo = (() => {
  const PI = Math.PI, sin = Math.sin, cos = Math.cos, abs = Math.abs;
  const sw = (t, f, a = 1) => sin(t * f) * a;
  const up = ctxFn => (ctx, len, ang, t, p, s) => { ctx.save(); ctx.translate(0, len); ctx.rotate(-ang); ctxFn(ctx, t, p, s); ctx.restore(); };

  /* ───────────── hand props (drawn upright at the hand) ───────────── */
  const PROP = {
    bowl: (ctx, t) => { ctx.fillStyle = '#e8e2d6'; ctx.beginPath(); ctx.ellipse(0, 2, 7, 2.6, 0, 0, PI); ctx.lineTo(-7, 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(0, 2, 7, 2, 0, 0, 7); ctx.fillStyle = '#f2d9a0'; ctx.fill(); ctx.strokeStyle = '#c9a050'; ctx.lineWidth = .6; ctx.beginPath(); ctx.arc(sw(t, 9, 2), 2, 1.8, 0, 7); ctx.stroke(); },
    whisk: (ctx, t) => { ctx.rotate(-.4 + sw(t, 12, .5)); ctx.strokeStyle = '#b9b9b9'; ctx.lineWidth = .8; for (const dx of [-1.2, 0, 1.2]) { ctx.beginPath(); ctx.ellipse(dx * .6, 6, 1.4, 4, 0, 0, 7); ctx.stroke(); } ctx.fillStyle = '#8a5a32'; ctx.fillRect(-.8, -3, 1.6, 5); },
    tiltBowl: (ctx, t) => { ctx.rotate(.9); PROP.bowl(ctx, t); },
    pan: (ctx, t, p) => { ctx.fillStyle = '#2e2e30'; ctx.beginPath(); ctx.ellipse(6, 2, 8, 3, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#4a4a4c'; ctx.beginPath(); ctx.ellipse(6, 1.5, 7, 2.3, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#5a3a22'; ctx.fillRect(-6, .8, 7, 2); },
    flipPan: (ctx, t) => {
      // the pancake goes up, spins and lands back in the pan
      const cyc = (t * .9) % 1, h = cyc < .6 ? sin(cyc / .6 * PI) * 22 : 0, jerk = cyc > .55 && cyc < .7 ? -3 : 0;
      ctx.translate(0, jerk); PROP.pan(ctx, t);
      ctx.save(); ctx.translate(6, 1 - h); ctx.scale(1, cyc < .6 ? cos(cyc / .6 * PI * 2) : 1);
      ctx.fillStyle = '#e8b062'; ctx.beginPath(); ctx.ellipse(0, 0, 5.2, 2, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#c98a3a'; ctx.beginPath(); ctx.ellipse(0, .3, 3.6, 1.2, 0, 0, 7); ctx.fill(); ctx.restore();
    },
    plateStack: (ctx, t) => {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, 3, 8, 2.6, 0, 0, 7); ctx.fill();
      for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? '#e2a85a' : '#eab76a'; ctx.beginPath(); ctx.ellipse(0, 1.5 - i * 1.8, 5.5, 1.8, 0, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#7a3a12'; ctx.beginPath(); ctx.ellipse(0, -4.2, 4.2, 1.2, 0, 0, 7); ctx.fill(); ctx.fillRect(2.5, -4, 1, 3 + abs(sw(t, 3, 1.5)));
      ctx.fillStyle = '#fff6c0'; ctx.fillRect(-1.2, -5.6, 2.4, 1.6);
    },
    fork: (ctx, t) => { ctx.strokeStyle = '#c9c9c9'; ctx.lineWidth = .9; ctx.beginPath(); ctx.moveTo(0, 3); ctx.lineTo(0, -6); ctx.moveTo(-1, -6); ctx.lineTo(-1, -9); ctx.moveTo(1, -6); ctx.lineTo(1, -9); ctx.stroke(); ctx.fillStyle = '#e2a85a'; ctx.fillRect(-1.5, -9.5, 3, 2); },
    knife: (ctx, t) => { ctx.fillStyle = '#5a3a22'; ctx.fillRect(-1, -1, 2, 5); ctx.fillStyle = '#d8dde0'; ctx.beginPath(); ctx.moveTo(-1, 4); ctx.lineTo(1.4, 4); ctx.lineTo(.4, 13); ctx.closePath(); ctx.fill(); },
    board: (ctx, t) => { ctx.fillStyle = '#c9965e'; ctx.fillRect(-9, 2, 16, 3.4); ctx.fillStyle = '#e8573a'; ctx.beginPath(); ctx.arc(-4, 1.2, 2.4, 0, 7); ctx.fill(); ctx.fillStyle = '#7cc35a'; for (let i = 0; i < 4; i++) ctx.fillRect(1 + i * 1.7, .5, 1.2, 1.6); },
    ladle: (ctx, t) => { ctx.rotate(sw(t, 5, .5)); ctx.strokeStyle = '#8a5a32'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(0, 7); ctx.stroke(); ctx.fillStyle = '#b9b9b9'; ctx.beginPath(); ctx.ellipse(0, 8, 2.4, 1.4, 0, 0, 7); ctx.fill(); },
    spoon: (ctx) => { ctx.strokeStyle = '#c9c9c9'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(0, -5); ctx.stroke(); ctx.fillStyle = '#c9c9c9'; ctx.beginPath(); ctx.ellipse(0, -6.5, 1.8, 2.4, 0, 0, 7); ctx.fill(); },
    meal: (ctx, t) => { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, 2, 8, 2.8, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#d98a3a'; ctx.beginPath(); ctx.ellipse(-2, 1, 3.4, 1.6, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#7cc35a'; ctx.beginPath(); ctx.ellipse(3, 1, 2.6, 1.3, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#f2e6b0'; ctx.beginPath(); ctx.ellipse(1, -.4, 2.2, 1.1, 0, 0, 7); ctx.fill(); },
    apple: (ctx, t, p) => { const bites = Math.min(3, Math.floor(p * 4)); ctx.fillStyle = '#d83a3a'; ctx.beginPath(); ctx.arc(0, 0, 3.6, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; for (let i = 0; i < bites; i++) { ctx.beginPath(); ctx.arc(3 - i * .6, -1.5 + i * 1.6, 1.6, 0, 7); ctx.fill(); } ctx.strokeStyle = '#5a3a22'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(0, -3.4); ctx.lineTo(.6, -5.4); ctx.stroke(); ctx.fillStyle = '#5aae36'; ctx.beginPath(); ctx.ellipse(1.8, -4.6, 1.6, .8, -.4, 0, 7); ctx.fill(); },
    glass: (ctx, t) => { ctx.fillStyle = 'rgba(220,240,250,.8)'; ctx.fillRect(-2.4, -6, 4.8, 8); ctx.fillStyle = '#f2a33a'; ctx.fillRect(-2, -3 + abs(sw(t, 1.5, 1)), 4, 4.6); ctx.fillStyle = '#e8f6ff'; ctx.fillRect(-2, -6, 1, 7); },
    paper: (ctx, t) => { ctx.rotate(sw(t, .8, .05)); ctx.fillStyle = '#efece2'; ctx.fillRect(-9, -8, 18, 12); ctx.fillStyle = '#9a9a9a'; for (let i = 0; i < 5; i++) ctx.fillRect(-7, -6 + i * 2.2, i === 0 ? 14 : 6, .8); for (let i = 1; i < 5; i++) ctx.fillRect(1, -6 + i * 2.2, 6, .8); ctx.fillStyle = '#3a3a3a'; ctx.fillRect(-7, -6.6, 14, 1.4); },
    book: (ctx, t, p, s) => { const f = (t * .5) % 1; ctx.fillStyle = (s && s._bookCol) || '#8a3a3a'; ctx.fillRect(-7.5, -4, 15, 9); ctx.fillStyle = '#f7f3e6'; ctx.fillRect(-7, -4.5, 6.6, 8.5); ctx.fillRect(.4, -4.5, 6.6, 8.5); if (f > .85) { ctx.fillStyle = '#e8e2d0'; ctx.beginPath(); ctx.moveTo(.2, -4.5); ctx.lineTo(.2 + 6.6 * cos((f - .85) / .15 * PI), -5.5); ctx.lineTo(.2 + 6.6 * cos((f - .85) / .15 * PI), 3); ctx.lineTo(.2, 4); ctx.fill(); } ctx.fillStyle = '#b9b0a0'; for (let i = 0; i < 4; i++) { ctx.fillRect(-6, -3 + i * 1.8, 5, .5); ctx.fillRect(1.2, -3 + i * 1.8, 5, .5); } },
    plantBook: (ctx, t, p) => { PROP.book(ctx, t, p, { _bookCol: '#3f6a4a' }); ctx.fillStyle = '#5aae36'; ctx.beginPath(); ctx.ellipse(-3.6, -.5, 1.8, 2.6, .4, 0, 7); ctx.fill(); },
    brush: (ctx, t) => { ctx.rotate(-.6 + sw(t, 7, .45)); ctx.fillStyle = '#c9a54a'; ctx.fillRect(-.6, -10, 1.2, 12); ctx.fillStyle = ['#c94a4a', '#3a6ab0', '#f2c230', '#4f9a3f'][Math.floor(t * .4) % 4]; ctx.fillRect(-1, -13, 2, 3.5); },
    palette: (ctx) => { ctx.fillStyle = '#c9965e'; ctx.beginPath(); ctx.ellipse(0, 2, 7, 4, 0, 0, 7); ctx.fill(); [['#c94a4a', -3, 0], ['#3a6ab0', 0, -1], ['#f2c230', 3, 0], ['#4f9a3f', 1, 3]].forEach(([c, x, y]) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y + 2, 1.2, 0, 7); ctx.fill(); }); },
    can: (ctx, t) => { ctx.rotate(.35 + sw(t, 2, .1)); ctx.fillStyle = '#5f8a7a'; ctx.fillRect(-5, -3, 9, 7); ctx.beginPath(); ctx.moveTo(4, -1); ctx.lineTo(11, -5); ctx.lineTo(12, -4); ctx.lineTo(4, 2); ctx.fill(); ctx.strokeStyle = '#4a6e60'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(-.5, -3, 4, PI, 0); ctx.stroke(); },
    trowel: (ctx, t) => { ctx.rotate(.5 + sw(t, 6, .4)); ctx.fillStyle = '#8a5a32'; ctx.fillRect(-.9, -4, 1.8, 5); ctx.fillStyle = '#9aa2a4'; ctx.beginPath(); ctx.moveTo(-2.4, 1); ctx.lineTo(2.4, 1); ctx.lineTo(0, 8); ctx.closePath(); ctx.fill(); },
    phone: (ctx, t) => { ctx.fillStyle = '#1a1a1c'; ctx.fillRect(-2.6, -4.5, 5.2, 9); ctx.fillStyle = `hsl(${(t * 40) % 360},55%,62%)`; ctx.fillRect(-2, -3.8, 4, 7.2); },
    mic: (ctx) => { ctx.fillStyle = '#2e2e30'; ctx.fillRect(-.8, -1, 1.6, 6); ctx.fillStyle = '#9a9a9a'; ctx.beginPath(); ctx.arc(0, -2, 2, 0, 7); ctx.fill(); },
    piece: (ctx, t) => { ctx.fillStyle = '#f4f4f2'; ctx.beginPath(); ctx.moveTo(-1.6, 2); ctx.lineTo(1.6, 2); ctx.lineTo(.8, -2); ctx.lineTo(-.8, -2); ctx.fill(); ctx.beginPath(); ctx.arc(0, -3, 1.4, 0, 7); ctx.fill(); },
    sponge: (ctx, t) => { ctx.fillStyle = '#f2c230'; ctx.fillRect(-3, -2 + sw(t, 10, 1), 6, 4); ctx.fillStyle = 'rgba(255,255,255,.9)'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-2 + i * 2, -3 + sw(t + i, 6, 1), 1.2, 0, 7); ctx.fill(); } }
  };

  /* ───────────── poses: base body, arm angles [L, R, lenL, lenR], props, face, bob ─────────────
     Arm angle 0 hangs straight down; negative left / positive right brings the hand forward. */
  const P = (base, arms, o = {}) => Object.assign({ base, arms }, o);
  const POSES = {
    mix: P('stand', t => [-.75, .9 + sw(t, 11, .35), 15, 15], { holdL: up(PROP.bowl), holdR: up(PROP.whisk), face: 'focus' }),
    pour: P('stand', t => [-1.15, .7, 14, 16], { holdL: up(PROP.tiltBowl), holdR: up(PROP.pan), face: 'focus' }),
    flip: P('stand', t => { const c = (t * .9) % 1; return [-.45, c > .55 && c < .7 ? 1.25 : 1.0, 18, 15]; }, { holdR: up(PROP.flipPan), face: 'focus', bob: t => { const c = (t * .9) % 1; return c > .55 && c < .7 ? -1 : 0; } }),
    plate: P('stand', t => [-.9, .9, 14, 14], { holdL: up(PROP.plateStack), face: 'proud' }),
    eatStack: P('stand', t => [-.85, .5 - Math.max(0, sin(t * 2.6)) * 1.5, 14, 16], { holdL: up(PROP.plateStack), holdR: up(PROP.fork), face: t => sin(t * 2.6) > .3 ? 'chew' : 'yum' }),
    chop: P('stand', t => [-.75, .75 + abs(sw(t, 9, .35)), 15, 15], { holdL: up(PROP.board), holdR: up(PROP.knife), face: 'focus' }),
    stir: P('stand', t => [-.35, .95 + sw(t, 4, .25), 19, 15], { holdR: up(PROP.ladle) }),
    taste: P('stand', t => [-.3, 2.3, 19, 12], { holdR: up(PROP.spoon), face: 'yum' }),
    eatMeal: P('stand', t => [-.85, .5 - Math.max(0, sin(t * 2.6)) * 1.5, 14, 16], { holdL: up(PROP.meal), holdR: up(PROP.fork), face: t => sin(t * 2.6) > .3 ? 'chew' : 'yum' }),
    fridge: P('stand', t => [.1, 1.5 + sw(t, 2, .1), 22, 18], { face: 'curious' }),
    apple: P('stand', t => [.12, .4 - Math.max(0, sin(t * 2.2)) * 1.9, 22, 15], { holdR: (ctx, l, a, t, p) => up((c) => PROP.apple(c, t, p))(ctx, l, a, t, p), face: t => sin(t * 2.2) > .3 ? 'chew' : 'yum' }),
    drink: P('stand', t => [.12, -.6 - Math.max(0, sin(t * 1.6)) * 1.6, 22, 15], { holdR: up(PROP.glass), face: 'yum' }),
    wash: P('stand', t => [-.85 + sw(t, 12, .15), .85 - sw(t, 12, .15), 15, 15], { holdR: up(PROP.sponge) }),
    newspaper: P('sit', t => [-.9, .9, 14, 14], { holdL: up(PROP.paper), face: 'curious' }),
    shower: P('stand', t => [PI - .3 + sw(t, 6, .3), -PI + .3 + sw(t, 6, .3), 18, 18], { face: 'sing' }),
    watch: P('stand', t => [.2, -.2, 21, 21], { face: t => (t % 7) < 1.4 ? 'laugh' : 'curious', bob: t => (t % 7) < 1.4 ? sw(t, 20, .8) : 0 }),
    gaming: P('stand', t => [-.95 + sw(t, 18, .08), .95 + sw(t, 15, .08), 15, 15], { face: t => (t % 9) < 1.2 ? 'laugh' : 'focus' }),
    typing: P('stand', t => [-.95 + sw(t, 22, .06), .95 + sw(t, 19, .06), 15, 15], { face: 'focus' }),
    reading: P('stand', t => [-.9, .9, 14, 14], { holdL: up((c, tt, p, s) => PROP.book(c, tt, p, s)), face: t => (t % 11) < 1 ? 'idea' : 'curious' }),
    studyPlants: P('stand', t => [-.9, .9, 14, 14], { holdL: up(PROP.plantBook), face: 'curious' }),
    dance: P('stand', t => { const m = Math.floor(t / 2.4) % 3; return m === 0 ? [PI + .5 + sw(t, 8, .4), -PI - .5 - sw(t + 1, 8, .4), 21, 21] : m === 1 ? [.8 + sw(t, 6, .6), -.8 - sw(t, 6, .6), 20, 20] : [-1.2, 2.6 + sw(t, 7, .3), 18, 19]; }, { face: 'sing', bob: t => sw(t, 9, 2.4) - 1, flipEvery: 2.4 }),
    painting: P('stand', t => [-.55, 1.3 + sw(t, 6, .3), 16, 19], { holdL: up(PROP.palette), holdR: up(PROP.brush), face: 'focus' }),
    chessMove: P('stand', t => { const c = (t * .4) % 1; return [-.2, c < .4 ? 1.2 : .3, 21, c < .4 ? 16 : 20]; }, { holdR: (ctx, l, a, t, p) => { if ((t * .4) % 1 < .4) up(PROP.piece)(ctx, l, a, t, p); }, face: t => (t * .4) % 1 < .4 ? 'focus' : 'curious' }),
    orate: P('stand', t => [.2, -.4 - abs(sw(t, 3, 1.1)), 21, 19], { holdL: up(PROP.mic), face: 'talk' }),
    admire: P('stand', t => [.3, -.3, 21, 21], { face: 'curious' }),
    watering: P('stand', t => [.2, .95, 21, 17], { holdR: up(PROP.can), face: 'proud' }),
    plantTalk: P('kneel', t => [.2, -.5 - abs(sw(t, 3, .7)), 20, 19], { face: 'talk' }),
    dig: P('kneel', t => [-.8, .8 + abs(sw(t, 6, .4)), 16, 15], { holdR: up(PROP.trowel), face: 'focus' }),
    phone: P('stand', t => [.15, 1.6, 22, 14], { holdR: up(PROP.phone), face: t => (t % 6) < 1 ? 'laugh' : 'curious' }),
    stretch: P('stand', t => [PI - .2, -PI + .2, 21, 21], { face: 'yawn', bob: () => -1.5 }),
    yawn: P('stand', t => [.15, 2.5, 22, 13], { face: 'yawn' }),
    tapFoot: P('stand', t => [-.6, .6, 13, 13], { face: 'bored', bob: t => abs(sw(t, 6, .6)) }),
    hum: P('stand', t => [.15 + sw(t, 2, .1), -.15 - sw(t, 2, .1), 22, 22], { face: 'sing', bob: t => sw(t, 3, .6) }),
    hug: P('stand', t => [-1.45, 1.45, 20, 20], { face: 'yum' }),
    laugh: P('stand', t => [-.5, .5, 14, 14], { face: 'laugh', bob: t => sw(t, 18, .8) }),
    argue: P('stand', t => [.1, -.9 - abs(sw(t, 6, .9)), 21, 18], { face: 'angry', bob: t => sw(t, 12, .5) }),
    compliment: P('stand', t => [.2, 1.35, 22, 11], { face: 'yum' }),
    chat: P('stand', t => [.12, -.4 - abs(sw(t, 4, .8)), 22, 20], { face: 'talk' }),
    thinkChat: P('stand', t => [.12, 2.5, 22, 13], { face: 'curious' })
  };

  /* ───────────── action timelines (sim-minutes into the action) ───────────── */
  const SEQ = {
    quick: [{ to: 4, pose: 'mix', say: 'Whisk whisk!' }, { to: 6, pose: 'pour', say: 'Pour…' }, { to: 13, pose: 'flip', say: 'Flip!' }, { to: 15, pose: 'plate', say: 'Pancake stack! 🥞' }, { to: 999, pose: 'eatStack', say: 'Yum!' }],
    cook: [{ to: 8, pose: 'chop', say: 'Chop chop' }, { to: 22, pose: 'stir', say: 'Simmering…' }, { to: 27, pose: 'taste', say: 'Mmm, needs salt' }, { to: 30, pose: 'plate', say: 'Dinner is served!' }, { to: 999, pose: 'eatMeal', say: 'Delicious!' }],
    snack: [{ to: 2.5, pose: 'fridge', say: 'What’s in here…' }, { to: 999, pose: 'apple', say: 'Crunch!' }],
    juice: [{ to: 2, pose: 'fridge' }, { to: 999, pose: 'drink', say: 'Refreshing!' }],
    wash: [{ to: 999, pose: 'wash' }],
    pee: [{ to: 999, pose: 'newspaper' }],
    shower: [{ to: 999, pose: 'shower', say: '♪ La la la ♪' }],
    watch: [{ to: 999, pose: 'watch' }],
    play: [{ to: 999, pose: 'gaming', say: 'Just one more level!' }],
    browse: [{ to: 999, pose: 'typing' }], blog: [{ to: 999, pose: 'typing', say: 'Dear plant diary…' }],
    read: [{ to: 999, pose: 'reading' }], study: [{ to: 999, pose: 'studyPlants', say: 'Fascinating!' }],
    dance: [{ to: 999, pose: 'dance', say: 'Let’s dance!' }],
    paint: [{ to: 999, pose: 'painting' }],
    chess: [{ to: 999, pose: 'chessMove', say: 'Check!' }],
    speech: [{ to: 999, pose: 'orate', say: 'Ladies and gentlemen…' }],
    fish: [{ to: 999, pose: 'admire' }],
    water: [{ to: 999, pose: 'watering', say: 'There you go 🌱' }],
    talk: [{ to: 999, pose: 'plantTalk', say: 'Who’s a good plant?' }],
    tend: [{ to: 999, pose: 'dig' }]
  };
  const SOCIAL_POSE = { chat: 'chat', joke: 'chat', compliment: 'compliment', plants: 'chat', hug: 'hug', deep: 'thinkChat', argue: 'argue' };
  const LISTEN_POSE = { joke: 'laugh', hug: 'hug', argue: 'argue', compliment: 'hug' };

  /* Current beat for a Sim (or null when the default animation should be used). */
  function beat(s, t) {
    const c = s.cur;
    if (s.listen) return { pose: LISTEN_POSE[s.listen.soc.id] || 'chat' };
    if (c && c.state === 'do' && c.kind === 'social' && c.def) return { pose: c.ok === false ? 'thinkChat' : SOCIAL_POSE[c.def.id] || 'chat' };
    if (c && c.state === 'do' && c.kind === 'obj' && c.def) {
      const seq = SEQ[c.def.id]; if (!seq) return null;
      let i = seq.findIndex(b => c.elapsed < b.to); if (i < 0) i = seq.length - 1;
      const b = seq[i], from = i ? seq[i - 1].to : 0;
      return { pose: b.pose, i, say: b.say, p: Math.min(1, (c.elapsed - from) / Math.max(1, Math.min(b.to, c.def.dur || b.to) - from)), act: c.def.id, el: c.elapsed, dur: c.def.dur };
    }
    if (!c && s.anim === 'stand' && !s.atWork) return idle(s, t);
    return null;
  }
  /* Idle life: little things Sims do while deciding what to do next. */
  function idle(s, t) {
    const seed = s.id.length * 13 + s.name.length * 7, slot = Math.floor((t + seed) / 5), ph = ((t + seed) % 5) / 5;
    const opts = ['look'];
    if (s.needs.energy < 40) opts.push('yawn', 'stretch');
    if (s.needs.fun < 40) opts.push('tapFoot');
    if (s.needs.social < 50 || s.traits.includes('social')) opts.push('phone');
    if (Simfolk.mood(s) > 70) opts.push('hum');
    opts.push('look', 'stretch');
    const pick = opts[(slot * 7 + seed) % opts.length];
    if (pick === 'look') return { pose: null, lookFlip: ph > .5 };
    return { pose: pick, idle: true };
  }

  /* ───────────── particles (iso pixel space) ───────────── */
  const parts = [];
  function spawn(o) { if (parts.length < 400) parts.push(Object.assign({ vx: 0, vy: 0, g: 0, life: 1, age: 0, size: 3 }, o)); }
  function update(dt) {
    for (const q of parts) { q.age += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.g * dt; if (q.sway) q.x += sin(q.age * 4 + q.ph) * q.sway * dt; }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].age >= parts[i].life) parts.splice(i, 1);
  }
  function draw(ctx) {
    for (const q of parts) {
      const k = q.age / q.life, a = k < .15 ? k / .15 : 1 - Math.max(0, k - .5) / .5;
      ctx.globalAlpha = Math.max(0, a);
      switch (q.kind) {
        case 'steam': ctx.fillStyle = q.c || 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (1 + k * 1.6), 0, 7); ctx.fill(); break;
        case 'drop': ctx.fillStyle = q.c || '#7fc9f2'; ctx.beginPath(); ctx.ellipse(q.x, q.y, q.size * .55, q.size, 0, 0, 7); ctx.fill(); break;
        case 'spark': ctx.fillStyle = q.c || '#fff6a0'; ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.age * 4); ctx.fillRect(-q.size / 2, -.6, q.size, 1.2); ctx.fillRect(-.6, -q.size / 2, 1.2, q.size); ctx.restore(); break;
        case 'bubble': ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = .8; ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, 7); ctx.stroke(); break;
        case 'dot': ctx.fillStyle = q.c; ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, 7); ctx.fill(); break;
        case 'text': case 'emoji': {
          ctx.font = q.kind === 'text' ? `900 ${q.size}px Nunito, sans-serif` : `${q.size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          const yy = q.y - (q.kind === 'text' ? Math.min(1, k * 3) * 6 : 0);
          if (q.kind === 'text') { ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(25,40,25,.85)'; ctx.strokeText(q.s, q.x, yy); ctx.fillStyle = q.c || '#fff6d0'; }
          ctx.fillText(q.s, q.x, yy); break;
        }
      }
    }
    ctx.globalAlpha = 1;
  }
  const rnd = (a, b) => a + Math.random() * (b - a);

  /* Per-frame emitters, driven by the Sim's current beat. (sx, sy) = feet in iso pixels; dir = ±1 facing. */
  function emit(s, b, sx, sy, dir, dt, t) {
    const hand = (dx, dy) => [sx + dir * dx, sy + dy];
    const chance = r => Math.random() < r * dt * 60;
    if (b.say && s._sayBeat !== (b.act || '') + b.i) { s._sayBeat = (b.act || '') + b.i; spawn({ kind: 'text', s: b.say, x: sx, y: sy - 98, vy: -8, life: 2.4, size: 11 }); }
    switch (b.pose) {
      case 'mix': if (chance(.15)) { const [x, y] = hand(-6, -36); spawn({ kind: 'dot', c: '#f2d9a0', x, y, vx: rnd(-8, 8), vy: -14, g: 60, life: .6, size: 1.2 }); } break;
      case 'pour': if (chance(.6)) { const [x, y] = hand(8, -36); spawn({ kind: 'drop', c: '#f2d9a0', x, y, vy: 30, g: 80, life: .35, size: 1.6 }); } break;
      case 'flip': case 'stir':
        if (chance(.25)) { const [x, y] = hand(14, -46); spawn({ kind: 'steam', x: x + rnd(-4, 4), y, vy: -18, sway: 8, ph: rnd(0, 6), life: 1.6, size: 2.4 }); }
        if (b.pose === 'flip' && chance(.2)) { const [x, y] = hand(14, -40); spawn({ kind: 'spark', c: '#ffcf6a', x: x + rnd(-6, 6), y: y + rnd(-2, 2), vy: -10, life: .4, size: 2.5 }); }
        if (b.pose === 'flip' && ((t * .9) % 1) > .55 && ((t * .9) % 1) < .58 && chance(.8)) { spawn({ kind: 'emoji', s: '✨', x: sx + dir * 14, y: sy - 70, vy: -10, life: .8, size: 9 }); }
        break;
      case 'chop': if (chance(.25)) { const [x, y] = hand(8, -34); spawn({ kind: 'dot', c: Math.random() < .5 ? '#7cc35a' : '#e8573a', x, y, vx: rnd(-14, 14), vy: -20, g: 90, life: .5, size: 1.3 }); } break;
      case 'taste': if (chance(.06)) spawn({ kind: 'emoji', s: '❤️', x: sx + rnd(-6, 6), y: sy - 92, vy: -14, life: 1.4, size: 9 }); break;
      case 'eatStack': case 'eatMeal': case 'apple': if (chance(.05)) spawn({ kind: 'dot', c: '#e2a85a', x: sx + dir * 2, y: sy - 55, vx: rnd(-6, 6), vy: 0, g: 70, life: .7, size: 1 }); if (chance(.02)) spawn({ kind: 'emoji', s: '😋', x: sx + dir * 14, y: sy - 90, vy: -10, life: 1.4, size: 9 }); break;
      case 'shower':
        for (let i = 0; i < 2; i++) if (chance(.9)) spawn({ kind: 'drop', x: sx + rnd(-10, 10), y: sy - 92, vy: 90, life: .7, size: 1.4 });
        if (chance(.18)) spawn({ kind: 'steam', c: 'rgba(240,248,255,.55)', x: sx + rnd(-12, 12), y: sy - 70, vy: -12, sway: 6, ph: rnd(0, 6), life: 2.2, size: 4 });
        if (chance(.04)) spawn({ kind: 'emoji', s: '🎵', x: sx + rnd(-10, 10), y: sy - 92, vy: -14, sway: 10, ph: rnd(0, 6), life: 1.8, size: 9 });
        if (chance(.08)) spawn({ kind: 'bubble', x: sx + rnd(-8, 8), y: sy - 60, vy: -10, life: 1.4, size: rnd(1, 2.4) });
        break;
      case 'wash': if (chance(.4)) spawn({ kind: 'drop', x: sx + dir * 14, y: sy - 40, vy: 40, g: 40, life: .3, size: 1.2 }); if (chance(.1)) spawn({ kind: 'bubble', x: sx + dir * 12 + rnd(-3, 3), y: sy - 40, vy: -12, life: 1, size: rnd(1, 2) }); break;
      case 'dance': if (chance(.06)) spawn({ kind: 'emoji', s: Math.random() < .5 ? '🎵' : '🎶', x: sx + rnd(-16, 16), y: sy - 80, vy: -16, sway: 14, ph: rnd(0, 6), life: 2, size: 10 }); break;
      case 'painting': if (chance(.08)) spawn({ kind: 'dot', c: ['#c94a4a', '#3a6ab0', '#f2c230', '#4f9a3f'][Math.floor(rnd(0, 4))], x: sx + dir * 20, y: sy - 52, vx: rnd(-10, 10), vy: -6, g: 50, life: .6, size: 1.2 }); break;
      case 'gaming': if (chance(.03)) spawn({ kind: 'emoji', s: ['🌿', '💧', '🌻', '✨'][Math.floor(rnd(0, 4))], x: sx + dir * 10, y: sy - 90, vy: -12, life: 1.2, size: 9 }); break;
      case 'typing': if (chance(.04)) spawn({ kind: 'text', s: ['tap', 'tik', 'tak'][Math.floor(rnd(0, 3))], c: '#d8e6ff', x: sx + dir * 12 + rnd(-6, 6), y: sy - 46, vy: -10, life: .8, size: 7 }); break;
      case 'reading': case 'studyPlants': if (chance(.02)) spawn({ kind: 'emoji', s: b.pose === 'studyPlants' ? '🌿' : '💡', x: sx + dir * 10, y: sy - 96, vy: -10, life: 1.4, size: 9 }); break;
      case 'chessMove': if (chance(.02)) spawn({ kind: 'emoji', s: '🤔', x: sx + dir * 12, y: sy - 96, vy: -8, life: 1.4, size: 9 }); break;
      case 'orate': if (chance(.04)) spawn({ kind: 'emoji', s: '✨', x: sx + dir * 16 + rnd(-6, 6), y: sy - 80, vy: -12, life: 1, size: 8 }); break;
      case 'watering': if (chance(.9)) { const [x, y] = hand(30, -40); spawn({ kind: 'drop', x: x + rnd(-1, 1), y, vx: dir * 18, vy: 10, g: 140, life: .5, size: 1.4 }); } if (chance(.05)) spawn({ kind: 'spark', c: '#bfffa0', x: sx + dir * 38 + rnd(-8, 8), y: sy - 30 + rnd(-10, 10), vy: -8, life: .8, size: 3 }); break;
      case 'plantTalk': if (chance(.04)) spawn({ kind: 'emoji', s: ['💚', '🌿', '🌱'][Math.floor(rnd(0, 3))], x: sx + dir * 18, y: sy - 70, vy: -10, life: 1.4, size: 9 }); break;
      case 'dig': if (chance(.25)) spawn({ kind: 'dot', c: '#6a4a2a', x: sx + dir * 14, y: sy - 18, vx: rnd(-16, 16), vy: -24, g: 110, life: .5, size: 1.4 }); if (chance(.02)) spawn({ kind: 'emoji', s: '🥕', x: sx + dir * 16, y: sy - 50, vy: -14, life: 1.2, size: 9 }); break;
      case 'laugh': if (chance(.06)) spawn({ kind: 'text', s: Math.random() < .5 ? 'HA HA!' : 'hehe', c: '#ffe27a', x: sx + rnd(-10, 10), y: sy - 92, vy: -12, life: 1.2, size: 9 }); break;
      case 'hug': if (chance(.1)) spawn({ kind: 'emoji', s: '❤️', x: sx + rnd(-10, 10), y: sy - 80, vy: -16, sway: 8, ph: rnd(0, 6), life: 1.6, size: rnd(7, 11) }); break;
      case 'argue': if (chance(.05)) spawn({ kind: 'emoji', s: '💢', x: sx + rnd(-8, 8), y: sy - 92, vy: -6, life: 1, size: 10 }); if (chance(.1)) spawn({ kind: 'steam', c: 'rgba(255,120,100,.45)', x: sx + rnd(-6, 6), y: sy - 86, vy: -16, life: 1, size: 2 }); break;
      case 'compliment': if (chance(.05)) spawn({ kind: 'emoji', s: '💐', x: sx + dir * 14, y: sy - 80, vy: -10, life: 1.2, size: 9 }); break;
      case 'yawn': if (chance(.02)) spawn({ kind: 'text', s: 'Yaaawn…', c: '#cfd8ff', x: sx, y: sy - 96, vy: -8, life: 1.6, size: 8 }); break;
      case 'hum': if (chance(.025)) spawn({ kind: 'emoji', s: '🎵', x: sx + rnd(-8, 8), y: sy - 92, vy: -12, sway: 10, ph: rnd(0, 6), life: 1.6, size: 8 }); break;
      case 'tapFoot': if (chance(.015)) spawn({ kind: 'emoji', s: '😒', x: sx + 14, y: sy - 92, vy: -6, life: 1.2, size: 8 }); break;
    }
    if (s.anim === 'run' && chance(.12)) spawn({ kind: 'drop', c: '#bfe6ff', x: sx + rnd(-8, 8), y: sy - 72, vx: rnd(-10, 10), vy: -8, g: 60, life: .6, size: 1.3 });
    if (s.anim === 'bath' && chance(.12)) spawn({ kind: 'bubble', x: sx + rnd(-14, 14), y: sy - 20, vy: -14, sway: 6, ph: rnd(0, 6), life: 1.6, size: rnd(1.2, 3) });
  }

  /* ───────────── objects reacting while in use ───────────── */
  function objectFx(ctx, o, use, t, W2S) {
    const id = o.id, b = use && use.beat;
    if (id === 'aquarium') {
      for (let i = 0; i < 3; i++) { const u = .2 + ((t * (.08 + i * .03) + i * .33) % 1) * .6, [x, y] = W2S(u, .5, 36 + i * 6 + sin(t * 2 + i) * 2); ctx.fillStyle = ['#f28a1e', '#3ab0f2', '#f2d23a'][i]; ctx.beginPath(); ctx.ellipse(x, y, 3, 1.6, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.lineTo(x - 5.5, y - 1.8); ctx.lineTo(x - 5.5, y + 1.8); ctx.fill(); }
      if (Math.random() < .05) { const [x, y] = W2S(.3 + Math.random() * .4, .5, 30); spawn({ kind: 'bubble', x, y, vy: -14, life: 1.4, size: 1.2 }); }
    }
    if (!use) return;
    if (id === 'stove') {
      for (const [u, v] of [[.3, .35], [.7, .35], [.3, .7], [.7, .7]]) { const [x, y] = W2S(u, v, 35); const f = .7 + sin(t * 18 + u * 9) * .3; ctx.fillStyle = `rgba(255,${120 + f * 60},40,${.55 * f})`; ctx.beginPath(); ctx.ellipse(x, y, 6, 3, 0, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(80,140,255,.6)'; ctx.beginPath(); ctx.ellipse(x, y, 4, 2, 0, 0, 7); ctx.fill(); }
      if (b && (b.pose === 'stir' || b.pose === 'chop' || b.pose === 'taste')) { const [x, y] = W2S(.5, .5, 35); ctx.fillStyle = '#5a5a5e'; ctx.beginPath(); ctx.ellipse(x, y - 6, 9, 4.5, 0, 0, 7); ctx.fill(); ctx.fillRect(x - 9, y - 12, 18, 6); ctx.fillStyle = '#c96a2a'; ctx.beginPath(); ctx.ellipse(x, y - 12, 8, 3.6, 0, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(x - 2 + sin(t * 4) * 2, y - 12.5, 2, .9, 0, 0, 7); ctx.fill(); if (Math.random() < .3) spawn({ kind: 'steam', x: x + (Math.random() - .5) * 10, y: y - 16, vy: -20, sway: 8, ph: Math.random() * 6, life: 1.8, size: 3 }); }
    }
    if (id === 'fridge' && b && b.pose === 'fridge') {
      const [a1, a2, a3, a4] = [W2S(.12, .9, 2), W2S(.12, .9, 70), W2S(-.45, 1.25, 70), W2S(-.45, 1.25, 2)];
      const glow = ctx.createRadialGradient(...W2S(.5, 1, 36), 2, ...W2S(.5, 1, 36), 46); glow.addColorStop(0, 'rgba(220,240,255,.75)'); glow.addColorStop(1, 'rgba(220,240,255,0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(...W2S(.5, 1, 36), 46, 0, 7); ctx.fill();
      Iso.poly(ctx, [a1, a2, a3, a4], '#e8f2ee', 'rgba(0,0,0,.25)', .8);
      for (const z of [18, 36, 54]) { const [x, y] = W2S(.5, .9, z); ctx.fillStyle = ['#d83a3a', '#7cc35a', '#f2c230'][z / 18 - 1]; ctx.beginPath(); ctx.arc(x - 3, y, 2.4, 0, 7); ctx.arc(x + 4, y, 2, 0, 7); ctx.fill(); }
    }
    if (id === 'tv' || id === 'computer') {
      const scr = id === 'tv' ? [[.12, .53, 21], [.88, .53, 49]] : [[.32, .33, 37], [.68, .33, 56]];
      const [[u0, v0, z0], [u1, v1, z1]] = scr;
      const q = [W2S(u0, v0, z0), W2S(u1, v1, z0), W2S(u1, v1, z1), W2S(u0, v0, z1)];
      ctx.save(); ctx.beginPath(); ctx.moveTo(...q[0]); q.slice(1).forEach(p => ctx.lineTo(...p)); ctx.closePath(); ctx.clip();
      const hue = (t * 30) % 360;
      if (id === 'tv') { const g2 = ctx.createLinearGradient(q[0][0], q[3][1], q[1][0], q[0][1]); g2.addColorStop(0, `hsl(${hue},60%,55%)`); g2.addColorStop(1, `hsl(${(hue + 120) % 360},60%,45%)`); ctx.fillStyle = g2; ctx.fillRect(q[0][0] - 40, q[2][1] - 40, 120, 120); ctx.fillStyle = 'rgba(255,255,255,.5)'; const [cx, cy] = W2S(.5 + sin(t) * .25, .53, 30 + cos(t * 1.3) * 8); ctx.beginPath(); ctx.arc(cx, cy, 3, 0, 7); ctx.fill(); }
      else if (b && b.pose === 'gaming') { const cols = ['#4fa43a', '#4696e6', '#f2c230', '#f27aa8']; for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { const [x, y] = W2S(.36 + i * .085, .33, 40 + j * 5); ctx.fillStyle = cols[(i + j + Math.floor(t * 2)) % 4]; ctx.fillRect(x - 1.6, y - 1.6, 3.2, 3.2); } }
      else { ctx.fillStyle = '#e8f0ff'; ctx.fillRect(q[0][0] - 30, q[2][1] - 30, 80, 80); ctx.fillStyle = '#7a8aa8'; for (let j = 0; j < 4; j++) { const [x, y] = W2S(.37, .33, 52 - j * 4 - ((t * 3) % 4)); ctx.fillRect(x, y, 8 + (j * 5) % 7, .9); } }
      ctx.restore();
      const glow = ctx.createRadialGradient(...W2S(.5, 1.2, 10), 2, ...W2S(.5, 1.2, 10), 40); glow.addColorStop(0, id === 'tv' ? `hsla(${hue},70%,70%,.28)` : 'rgba(170,200,255,.25)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(...W2S(.5, 1.2, 10), 40, 0, 7); ctx.fill();
    }
    if (id === 'stereo') {
      const [x, y] = W2S(.5, .55, 29); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + cos(t * 6) * 9, y + sin(t * 6) * 4.5); ctx.stroke();
      if (Math.random() < .08) spawn({ kind: 'emoji', s: Math.random() < .5 ? '🎵' : '🎶', x: x + (Math.random() - .5) * 10, y: y - 10, vy: -18, sway: 12, ph: Math.random() * 6, life: 2, size: 9 });
    }
    if (id === 'easel') {
      const prog = b ? Math.min(1, (b.el || 0) / Math.max(1, b.dur || 120)) : 0, R = U.rng(o.uid * 97 + Math.floor((use.sim && use.sim.paintNo) || 0));
      const strokes = Math.floor(prog * 26), cols = ['#6f9a5a', '#e8a06a', '#3a6ab0', '#f2c230', '#c94a4a', '#2f6a4a'];
      for (let i = 0; i < strokes; i++) { const u = .26 + R() * .48, z = 36 + R() * 30, [x, y] = W2S(u, .51, z); ctx.fillStyle = cols[Math.floor(R() * cols.length)]; ctx.beginPath(); ctx.ellipse(x, y, 2.5 + R() * 3, 1.2 + R() * 2, R() * 3, 0, 7); ctx.fill(); }
    }
    if (id === 'treadmill') { for (let i = 0; i < 6; i++) { const v = .35 + (((i / 6) + t * 1.4) % 1) * 1.45, [a, b2] = [W2S(.22, v, 11.2), W2S(.78, v, 11.2)]; ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b2); ctx.stroke(); } }
    if (id === 'kitchensink' || id === 'basin') { const [x, y] = id === 'basin' ? W2S(.5, .3, 46) : W2S(.5, .42, 48); ctx.strokeStyle = 'rgba(160,210,240,.85)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 12); ctx.stroke(); if (Math.random() < .3) spawn({ kind: 'drop', x, y: y + 12, vx: (Math.random() - .5) * 20, vy: -10, g: 120, life: .3, size: 1 }); }
    if (id === 'chess' && b) { const [x, y] = W2S(.4 + sin(t * .4) * .1, .45, 33); ctx.fillStyle = '#111'; ctx.fillRect(x - 1.5, y - 5, 3, 5); }
    if (id === 'bathtub') { for (let i = 0; i < 10; i++) { const [x, y] = W2S(.25 + (i % 5) * .13, .5 + Math.floor(i / 5) * .9, 31 + sin(t * 2 + i) * 1.2); ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.beginPath(); ctx.arc(x, y, 4 + (i % 3), 0, 7); ctx.fill(); } const [dx, dy] = W2S(.6 + sin(t * .6) * .15, 1.3, 32 + sin(t * 2.4) * 1.4); ctx.fillStyle = '#f2d23a'; ctx.beginPath(); ctx.ellipse(dx, dy, 3.6, 2.6, 0, 0, 7); ctx.arc(dx + 2.4, dy - 3, 2, 0, 7); ctx.fill(); ctx.fillStyle = '#f28a1e'; ctx.fillRect(dx + 4, dy - 3.4, 2, 1); }
    if (id.startsWith('plant:') && b && b.pose === 'watering' && Math.random() < .2) { const [x, y] = W2S(.5, .5, 30 + Math.random() * 30); spawn({ kind: 'spark', c: '#d8ffb0', x: x + (Math.random() - .5) * 20, y, vy: -6, life: .7, size: 3 }); }
  }

  return { POSES, SEQ, beat, emit, update, draw, objectFx, spawn };
})();
