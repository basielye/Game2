/* The simulation brain: routing, action execution, social interactions, autonomy (free will),
   failure states and careers. Time is measured in sim-minutes. */
const Brain = (() => {
  const { NEEDS, SOCIAL, CAREERS, PROMO_SKILL, ASPIRATIONS, mult, likes, addMoodlet, level } = Simfolk;
  const SPEED = 2.4;               // tiles per sim-minute
  const CURB = [6, 17];
  const first = s => s.name.split(' ')[0];
  const tileOf = s => [Math.floor(s.x), Math.floor(s.y)];
  const objByUid = (g, uid) => g.L.objects.find(o => o.uid === uid);
  const actOf = (o, id) => World.defOf(o).actions.find(a => a.id === id);
  const resKey = (uid, i) => uid + ':' + i;

  /* ───────────── queueing (player commands) ───────────── */
  function order(g, s, a) {
    if (s.atWork) { g.notify(`${first(s)} is at work right now.`, s, '💼'); return; }
    if (s.cur && s.cur.auto) cancel(g, s);
    if (s.queue.length + (s.cur ? 1 : 0) >= 6) { g.notify(`${first(s)}'s action queue is full.`, s, '⏳'); return; }
    s.queue.push(a);
  }
  function cancel(g, s) {
    if (!s.cur) return;
    release(g, s);
    if (s.cur.kind === 'social') { const t = g.simById(s.cur.target); if (t && t.listen && t.listen.with === s.id) t.listen = null; }
    s.cur = null; s.anim = 'stand';
  }
  function release(g, s) { if (s.cur && s.cur.res) { delete g.reserved[s.cur.res]; s.cur.res = null; } }

  /* ───────────── starting actions ───────────── */
  function start(g, s, a) {
    s.idle = 0;
    if (a.kind === 'obj') {
      const o = objByUid(g, a.uid); if (!o) return;
      const act = actOf(o, a.act); if (!act) return;
      if (act.instant) { g.instant(act.instant, s, o); return; }
      const spots = World.spotsFor(o, act);
      let best = null;
      for (const sp of spots) {
        const k = resKey(o.uid, sp.i);
        if (g.reserved[k] && g.reserved[k] !== s.id) continue;
        const goal = sp.approach || sp.tile;
        if (!World.inLot(goal[0], goal[1])) continue;
        if (sp.approach && g.grid[goal[1]] && g.grid[goal[1]][goal[0]]) continue;
        const path = World.findPath(g.L, tileOf(s), goal, g.grid);
        if (path && (!best || path.length < best.path.length)) best = { sp, path, k };
      }
      if (!best) { if (!a.auto) g.notify(`${first(s)} can't reach the ${World.defOf(o).name}.`, s, '🚧'); return; }
      g.reserved[best.k] = s.id;
      s.cur = Object.assign({}, a, { o: o.uid, label: act.label, spot: best.sp, path: best.path, state: 'route', elapsed: 0, phase: 0, res: best.k, def: act });
    } else if (a.kind === 'social') {
      const t = g.simById(a.target), soc = SOCIAL.find(x => x.id === a.act);
      if (!t || t.atWork) { if (!a.auto) g.notify(`${t ? first(t) : 'They'} isn't home.`, s, '🏠'); return; }
      const path = pathNextTo(g, s, t);
      if (!path) { if (!a.auto) g.notify(`${first(s)} can't get to ${first(t)}.`, s, '🚧'); return; }
      s.cur = Object.assign({}, a, { label: soc.label + ' with ' + first(t), path, state: 'route', elapsed: 0, def: soc, tries: 0 });
    } else if (a.kind === 'goto') {
      const path = World.findPath(g.L, tileOf(s), a.tile, g.grid);
      if (path) s.cur = Object.assign({}, a, { label: 'Go Here', path, state: 'route', elapsed: 0 });
    } else if (a.kind === 'work') {
      const path = World.findPath(g.L, tileOf(s), CURB, g.grid) || [];
      s.cur = { kind: 'work', label: 'Go to Work', path, state: 'route', elapsed: 0 };
    }
  }
  function pathNextTo(g, s, t) {
    const [tx, ty] = tileOf(t); let best = null;
    for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const nx = tx + dx, ny = ty + dy;
      if (!World.inLot(nx, ny) || g.grid[ny][nx]) continue;
      if (Math.abs(dx) + Math.abs(dy) === 1 && !World.edgeOpen(g.L, tx, ty, nx, ny)) continue;
      const p = World.findPath(g.L, tileOf(s), [nx, ny], g.grid);
      if (p && (!best || p.length < best.length)) best = p;
    }
    return best;
  }

  /* ───────────── per-tick update ───────────── */
  function tick(g, s, dt) {
    if (s.atWork) { if (g.T >= s.workUntil) returnFromWork(g, s); return; }
    const sleeping = s.anim === 'sleep' || s.anim === 'faint';
    const resting = ['sit', 'sleep', 'bath', 'watch', 'type'].includes(s.anim);
    for (const n of NEEDS) {
      if (!n.decay) continue;
      let d = n.decay * mult(s, 'decay', n.k) * dt;
      if (sleeping && (n.k === 'hunger' || n.k === 'bladder' || n.k === 'fun' || n.k === 'social')) d *= .4;
      if (n.k === 'comfort' && resting) d = 0;
      if (n.k === 'energy' && sleeping) d = 0;
      s.needs[n.k] = U.clamp(s.needs[n.k] - d, 0, 100);
    }
    const rs = g.roomScoreAt(s.x, s.y);
    s.needs.room += (rs - s.needs.room) * Math.min(1, dt * .08);
    // conditional moodlets
    s.moodlets = s.moodlets.filter(m => m.until > g.T);
    if (s.needs.room > 72) addMoodlet(s, 'beautiful', g.T); else if (s.needs.room < 28) addMoodlet(s, 'ugly', g.T);
    if (s.needs.hunger < 8) addMoodlet(s, 'starving', g.T);
    if (s.needs.hygiene < 12) addMoodlet(s, 'stinky', g.T);
    if (s.needs.energy < 10 && !sleeping) addMoodlet(s, 'exhausted', g.T);
    // listening to someone
    if (s.listen) {
      if (g.T >= s.listen.until) s.listen = null;
      else { const o = g.simById(s.listen.with); s.anim = 'talk'; if (o) faceTo(s, o.x, o.y); applyGains(s, s.listen.soc.gains, dt); return; }
    }
    // failure states
    if (s.needs.bladder <= 0 && !(s.cur && s.cur.act === 'pee' && s.cur.state === 'do')) {
      cancel(g, s); s.queue = [];
      g.L.puddles.push({ x: s.x, y: s.y, until: g.T + 360 }); g.dirtyRooms();
      s.needs.bladder = 100; s.needs.hygiene = Math.max(0, s.needs.hygiene - 40); addMoodlet(s, 'embarrassed', g.T);
      g.notify(`${first(s)} couldn't hold it any longer. How embarrassing!`, s, '😳'); g.sfx('bad');
    }
    if (s.needs.energy <= 0 && !sleeping) {
      cancel(g, s); s.queue = [];
      s.cur = { kind: 'faint', label: 'Passed Out', state: 'do', elapsed: 0, dur: 150 };
      addMoodlet(s, 'fainted', g.T); g.notify(`${first(s)} was so exhausted they fell asleep on the spot.`, s, '😵');
    }
    // careers: carpool at 8:00 on weekdays
    if (s.job && !s.atWork && g.weekday() < 5 && g.hour() >= 8 && g.hour() < 9.5 && s.workDay !== g.day() && !(s.cur && s.cur.kind === 'work')) {
      if (g.hour() >= 9.25) { s.workDay = g.day(); s.job.perf = Math.max(0, s.job.perf - 15); g.notify(`${first(s)} missed the carpool! Work performance dropped.`, s, '🚗'); }
      else { cancel(g, s); s.queue = []; start(g, s, { kind: 'work' }); g.notify(`The carpool is here for ${first(s)}.`, s, '🚗'); g.sfx('honk'); }
    }
    if (!s.cur) {
      if (s.queue.length) start(g, s, s.queue.shift());
      else {
        s.idle += dt; s.anim = 'stand';
        if (g.freeWill && s.idle > 2) autonomy(g, s);
      }
    }
    if (s.cur) run(g, s, dt);
  }
  function applyGains(s, gains, dt, actId) {
    for (const k in gains) {
      let v = gains[k] * dt;
      if (v > 0) v *= mult(s, 'gain', k);
      s.needs[k] = U.clamp(s.needs[k] + v, 0, 100);
    }
    if (actId && likes(s, actId)) s.needs.fun = U.clamp(s.needs.fun + .5 * dt, 0, 100);
  }
  function addSkill(g, s, sk, dt) {
    for (const k in sk) {
      const before = level(s.skills[k]);
      s.skills[k] += sk[k] * mult(s, 'skill', k) * dt;
      const after = level(s.skills[k]);
      if (after > before) { addMoodlet(s, 'skill', g.T); g.notify(`${first(s)} reached ${Simfolk.SKILLS.find(x => x.k === k).label} level ${after}!`, s, '💡'); g.sfx('skill'); }
    }
  }
  function faceTo(s, x, y) { const dx = x - s.x, dy = y - s.y; if (Math.abs(dx) + Math.abs(dy) > .01) s.face = Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)]; }
  function moveAlong(s, path, dt) {
    let step = SPEED * dt;
    while (step > 0 && path.length) {
      const [tx, ty] = path[0], cx = tx + .5, cy = ty + .5, dx = cx - s.x, dy = cy - s.y, d = Math.hypot(dx, dy);
      if (d <= step) { s.x = cx; s.y = cy; step -= d; path.shift(); }
      else { s.x += dx / d * step; s.y += dy / d * step; step = 0; }
      if (d > .01) s.face = [dx / d, dy / d];
    }
    s.walkT += dt * 1.2; s.anim = 'walk';
    return !path.length;
  }
  function run(g, s, dt) {
    const c = s.cur;
    if (c.kind === 'faint') {
      s.anim = 'faint'; c.elapsed += dt; applyGains(s, { energy: .55 }, dt);
      if (c.elapsed >= c.dur || s.needs.energy > 60) { s.cur = null; }
      return;
    }
    if (c.state === 'route') {
      if (c.kind === 'social') {
        const t = g.simById(c.target);
        if (!t || t.atWork) { s.cur = null; return; }
        if (c.path.length && Math.hypot(t.x - (c.path[c.path.length - 1][0] + .5), t.y - (c.path[c.path.length - 1][1] + .5)) > 1.6) {
          if (++c.tries > 4) { s.cur = null; return; }
          c.path = pathNextTo(g, s, t) || [];
        }
      }
      if (!moveAlong(s, c.path, dt)) return;
      if (c.kind === 'obj' && c.spot.approach) {
        const [px, py] = c.def.anim === 'sleep' || c.def.anim === 'bath' ? c.spot.lie : c.spot.pos;
        const d = Math.hypot(px - s.x, py - s.y);
        if (d > .04) { const st = Math.min(d, SPEED * dt); s.x += (px - s.x) / d * st; s.y += (py - s.y) / d * st; s.anim = 'walk'; return; }
      }
      if (c.kind === 'work') { s.atWork = true; s.workDay = g.day(); s.workUntil = g.day() * 1440 + 16 * 60; s.cur = null; s.queue = []; g.notify(`${first(s)} headed off to work as a ${CAREERS[s.job.career].titles[s.job.level]}.`, s, '💼'); return; }
      if (c.kind === 'goto') { s.cur = null; return; }
      if (c.kind === 'social') {
        const t = g.simById(c.target);
        if (!t || t.atWork || t.anim === 'sleep' || t.anim === 'shower' || t.anim === 'bath' || t.anim === 'faint' || t.listen) { g.notify(`${t ? first(t) : 'They'} is busy right now.`, s, '✋'); s.cur = null; return; }
        const soc = c.def, ok = !soc.risky || Math.random() < .65 + level(s.skills.charisma) * .04;
        c.ok = ok;
        t.listen = { with: s.id, until: g.T + soc.dur, soc: ok ? soc : Object.assign({}, soc, { gains: { social: 1, fun: -1 } }) };
        if (t.cur && t.cur.state === 'do' && t.cur.def && t.cur.def.dur > 0) t.cur.elapsed = Math.max(0, t.cur.elapsed - soc.dur);
        faceTo(s, t.x, t.y); faceTo(t, s.x, s.y);
      }
      c.state = 'do'; c.elapsed = 0;
      if (c.kind === 'obj') s.face = c.spot.face;
      return;
    }
    // doing
    c.elapsed += dt;
    if (c.kind === 'social') {
      const t = g.simById(c.target), soc = c.def;
      s.anim = 'talk'; if (t) faceTo(s, t.x, t.y);
      applyGains(s, c.ok ? soc.gains : { social: 1, fun: -1 }, dt, soc.id);
      if (soc.skill) addSkill(g, s, soc.skill, dt);
      const dr = (c.ok ? soc.rel : -1) * dt;
      if (t) {
        const before = s.rel[t.id] || 0;
        s.rel[t.id] = U.clamp(before + dr, -100, 100); t.rel[s.id] = U.clamp((t.rel[s.id] || 0) + dr, -100, 100);
        if (before < 50 && s.rel[t.id] >= 50) g.notify(`${first(s)} and ${first(t)} are now good friends!`, s, '💞');
      }
      if (c.elapsed >= soc.dur) {
        if (soc.moodlet && c.ok) { addMoodlet(s, soc.moodlet, g.T); if (t) addMoodlet(t, soc.moodlet, g.T); }
        if (soc.risky && !c.ok) g.notify(`${first(s)}'s joke fell flat…`, s, '😬');
        s.cur = null;
      }
      return;
    }
    const act = c.def, phases = act.phases;
    let ph = phases ? phases[Math.min(c.phase, phases.length - 1)] : act;
    if (phases) { let acc = 0; for (let i = 0; i < phases.length; i++) { acc += phases[i].dur; if (c.elapsed < acc) { c.phase = i; break; } c.phase = phases.length - 1; } ph = phases[c.phase]; }
    s.anim = ph.anim || act.anim;
    if (s.anim === 'run') s.walkT += dt * 1.5;
    applyGains(s, ph.gains || {}, dt, act.id);
    if (ph.skill || act.skill) addSkill(g, s, ph.skill || act.skill, dt);
    const fullDone = act.full && s.needs[act.full] >= 99.5 && c.elapsed > 3;
    if (c.elapsed >= act.dur || fullDone) finish(g, s, c, act);
  }
  function finish(g, s, c, act) {
    if (act.moodlet) addMoodlet(s, act.moodlet === 'tasty' && level(s.skills.cooking) < 2 ? 'goodchat' : act.moodlet, g.T);
    if (act.id === 'sleep' && s.needs.energy > 90) addMoodlet(s, 'rested', g.T);
    if (act.id === 'water' || (act.id === 'tend' && act.skill && act.skill.gardening)) addMoodlet(s, 'pride', g.T);
    if (act.id === 'run') addMoodlet(s, 'pumped', g.T);
    if (act.id === 'paint') addMoodlet(s, 'inspired', g.T);
    if (act.money) {
      const L = k => level(s.skills[k]);
      const amt = act.money === 'painting' ? Math.round((25 + L('creativity') * 38) * (.8 + Math.random() * .5))
        : act.money === 'blog' ? Math.round(12 + L('creativity') * 14) : Math.round(15 + L('gardening') * 18);
      g.addFunds(amt);
      g.notify(act.money === 'painting' ? `${first(s)} sold a painting for §${amt}.` : act.money === 'blog' ? `${first(s)}'s plant blog earned §${amt} in ad revenue.` : `${first(s)} sold the harvest for §${amt}.`, s, '§');
    }
    release(g, s); s.cur = null; s.idle = 0;
  }

  /* ───────────── free will ───────────── */
  const w = v => Math.pow(1 - v / 100, 2) * 2.6 + .04;
  function totalGains(act) {
    const t = {};
    const add = (gains, dur) => { for (const k in gains) t[k] = (t[k] || 0) + gains[k] * dur; };
    if (act.phases) act.phases.forEach(p => add(p.gains || {}, p.dur)); else add(act.gains, act.full ? Math.min(act.dur, 60) : act.dur);
    return t;
  }
  function score(g, s, gains, id, skill) {
    let v = 0;
    for (const k in gains) { if (k === 'room') continue; const room = 100 - s.needs[k]; v += w(s.needs[k]) * U.clamp(gains[k], -40, room); }
    if (id === 'sleep' && (g.hour() >= 22 || g.hour() < 6) && !Simfolk.trait(s, 'nightowl') && s.needs.energy < 75) v *= 1.6;
    if (skill) { v += 6; const asp = ASPIRATIONS.find(a => a.id === s.aspiration); for (const k in skill) { if (s.job && CAREERS[s.job.career].skill === k) v += 10; if (asp && asp.desc.toLowerCase().includes(k)) v += 8; } }
    if (likes(s, id)) v = v * 1.35 + 6;
    return v;
  }
  function autonomy(g, s) {
    const cands = [], [sx, sy] = [s.x, s.y];
    for (const o of g.L.objects) {
      const d = World.defOf(o);
      for (const act of d.actions) {
        if (act.auto === false || act.instant) continue;
        const spots = World.spotsFor(o, act);
        if (spots.every(sp => g.reserved[resKey(o.uid, sp.i)])) continue;
        let v = score(g, s, totalGains(act), act.id, act.skill || (act.phases && act.phases[0].skill));
        const c = World.cells(o)[0], dist = Math.hypot(c[0] - sx, c[1] - sy);
        v /= 1 + dist / 16;
        cands.push({ v, a: { kind: 'obj', uid: o.uid, act: act.id, auto: true } });
      }
    }
    for (const t of g.sims) {
      if (t === s || t.atWork || t.listen || ['sleep', 'shower', 'bath', 'faint'].includes(t.anim) || (t.cur && t.cur.kind === 'social')) continue;
      const rel = s.rel[t.id] || 0;
      for (const soc of SOCIAL) {
        if (soc.auto === false || (soc.min != null && rel < soc.min)) continue;
        const gains = {}; for (const k in soc.gains) gains[k] = soc.gains[k] * soc.dur;
        let v = score(g, s, gains, soc.id) * (1 + rel / 250);
        v /= 1 + Math.hypot(t.x - sx, t.y - sy) / 16;
        cands.push({ v, a: { kind: 'social', target: t.id, act: soc.id, auto: true } });
      }
    }
    cands.sort((a, b) => b.v - a.v);
    if (!cands.length || cands[0].v < 1.2) {
      if (s.idle > 25) { s.idle = 0; const [tx, ty] = [Math.floor(sx + (Math.random() - .5) * 6), Math.floor(sy + (Math.random() - .5) * 6)]; if (World.inLot(tx, ty) && !g.grid[ty][tx]) start(g, s, { kind: 'goto', tile: [tx, ty], auto: true }); }
      return;
    }
    const top = cands.slice(0, 3), tot = top.reduce((a, c) => a + c.v, 0);
    let r = Math.random() * tot;
    for (const c of top) { r -= c.v; if (r <= 0) { start(g, s, c.a); return; } }
    start(g, s, top[0].a);
  }

  /* ───────────── careers ───────────── */
  function returnFromWork(g, s) {
    s.atWork = false; s.x = CURB[0] + .5; s.y = CURB[1] + .5; s.anim = 'stand';
    for (const [k, v] of [['hunger', 28], ['energy', 26], ['fun', 22], ['social', 10], ['hygiene', 18], ['bladder', 30]]) s.needs[k] = Math.max(5, s.needs[k] - v);
    const C = CAREERS[s.job.career], m = Simfolk.mood(s), sk = level(s.skills[C.skill]);
    const pay = Math.round(C.pay[s.job.level] * 7 * (1 + s.job.perf / 200));
    g.addFunds(pay);
    s.job.perf = U.clamp(s.job.perf + (m - 45) / 2.5 + sk * 2.5 + 8, 0, 100);
    let msg = `${first(s)} is home from work and earned §${pay}.`;
    if (s.job.perf >= 100 && s.job.level < 4) {
      if (sk >= PROMO_SKILL[s.job.level + 1]) { s.job.level++; s.job.perf = 25; addMoodlet(s, 'promoted', g.T); msg = `Promotion! ${first(s)} is now a ${C.titles[s.job.level]} and earned §${pay} today.`; g.sfx('win'); }
      else msg += ` Needs ${C.skill} level ${PROMO_SKILL[s.job.level + 1]} for a promotion.`;
    }
    g.notify(msg, s, C.icon);
  }
  function checkAspirations(g) {
    for (const s of g.sims) {
      if (s.aspDone) continue;
      const a = ASPIRATIONS.find(x => x.id === s.aspiration);
      if (a && a.prog(s, g.sims) >= 1) { s.aspDone = true; g.addFunds(1500); addMoodlet(s, 'promoted', g.T); g.notify(`${first(s)} fulfilled the aspiration "${a.name}"! Reward: §1,500.`, s, '🏆'); g.sfx('win'); }
    }
  }

  return { order, cancel, tick, start, checkAspirations, release, SPEED };
})();
